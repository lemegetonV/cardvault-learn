"""Whole customer stories, across every service (spec 2, 6).

The area tests each check one rule. A journey checks that the rules work together, in the
order a real customer meets them, with the state each step leaves behind feeding the next.
When a journey fails and no area test does, the fault is in the hand-over between
services: an event not published, a projection not updated, a status not pushed.
"""

from __future__ import annotations

from cardvault_tests.checks import expect
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Card, Clearing, Dispute, Wallet, WalletCard
from cardvault_tests.transactions import wait_for_transaction
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wait_for_enrolment


def test_add_a_card_pay_with_it_and_dispute_the_charge(make_customer, card_network, enrolments):
    someone = make_customer(customer(card(limit=50_000)))
    card_id = someone.card_ids[0]

    # 1. Add the card to the wallet; the operator confirms by callback.
    expect(someone.wallet.add(card_id), 202, WalletCard)
    wait_for_enrolment(someone, card_id, "ENROLLED")
    token_ref = enrolments.record(card_id)["token_ref"]

    # 2. Pay with the wallet token. card-service learns of the token from an event.
    auth = wait_until(
        lambda: expect(card_network.purchase(card_id, 12_345, token_ref), 200, Authorization),
        lambda a: a.decision == "APPROVED",
        timeout=10,
        what="the first wallet purchase to be approved",
    )
    assert expect(someone.cards.get(card_id), 200, Card).available == 50_000 - 12_345

    # 3. The merchant settles for less (a partial shipment); the difference comes back.
    expect(card_network.settle(auth.trace_id, 10_000), 200, Clearing)
    txn = wait_for_transaction(someone, auth.trace_id, lambda t: t.status == "SETTLED")
    assert (txn.amount, txn.cleared_amount) == (12_345, 10_000)
    assert expect(someone.cards.get(card_id), 200, Card).available == 50_000 - 10_000

    # 4. The customer disputes the charge; the transaction shows the open dispute.
    dispute = expect(someone.transactions.open_dispute(txn.txn_id, "WRONG_AMOUNT"), 201, Dispute)
    assert wait_for_transaction(someone, auth.trace_id).open_dispute_id == dispute.dispute_id


def test_lose_a_card_then_get_a_new_one_and_keep_paying(make_customer, card_network, enrolments):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    token_ref = someone.new_cards[0].token_ref

    # 1. Report the card lost: the wallet suspends the token, and payments stop at once.
    expect(someone.cards.report_lost(card_id), 200, Card)
    declined = expect(card_network.purchase(card_id, 500, token_ref), 200, Authorization)
    assert (declined.decision, declined.decline_code) == ("DECLINED", "CARD_LOST")
    wait_for_enrolment(someone, card_id, "SUSPENDED")

    # 2. Reissue: a new number and expiry on the same card_id; the token resumes, carrying
    #    the new last4, and the same token pays again.
    new = expect(someone.cards.reissue(card_id), 200, Card)
    wait_until(
        lambda: wait_for_enrolment(someone, card_id, "ENROLLED"),
        lambda c: c.enrollment.last4 == new.last4,
        timeout=20,
        what="the token to resume with the new last4",
    )
    assert enrolments.record(card_id)["token_ref"] == token_ref, "the token itself is kept"
    approved = wait_until(
        lambda: expect(card_network.purchase(card_id, 500, token_ref), 200, Authorization),
        lambda a: a.decision == "APPROVED",
        timeout=10,
        what="the resumed token to pay again",
    )
    assert wait_for_transaction(someone, approved.trace_id).card_id == card_id


def test_leave_the_wallet_and_come_back(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True), card("DEBIT", enrolled=True)))
    credit, debit = someone.new_cards

    # 1. Opt out: every token stops working straight away.
    expect(someone.wallet.opt_out(), 200, Wallet)
    for own in (credit, debit):
        decision = wait_until(
            lambda own=own: expect(
                card_network.purchase(own.card_id, 100, own.token_ref), 200, Authorization
            ),
            lambda a: a.decision == "DECLINED",
            timeout=10,
            what="the opted-out token to be declined",
        )
        assert decision.decline_code == "TOKEN_INACTIVE"

    # 2. Opt in again: both cards are enrolled afresh, with new tokens.
    expect(someone.wallet.opt_in(), 200, Wallet)
    for own in (credit, debit):
        wait_for_enrolment(someone, own.card_id, "ENROLLED")
