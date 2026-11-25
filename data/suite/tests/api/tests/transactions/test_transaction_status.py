"""One wallet transaction per purchase, its status worked out from the amounts
(spec 6.4, 16.1 rule 6).

    DECLINED            the authorization was declined
    AUTHORIZED          approved, nothing cleared yet
    PARTIALLY_REVERSED  part of the hold released before settlement
    REVERSED            all of the hold released before settlement
    SETTLED             charged
    PARTIALLY_REFUNDED  some of the charge given back
    REFUNDED            all of the charge given back

Each row of the table is a fresh enrolled card, a wallet purchase of 50.00 and some clearing
records; the expected amounts follow from those, not from what the service returned before.
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Clearing, Transaction
from cardvault_tests.transactions import find, wait_for_transaction, wallet_purchase

AMOUNT = 5_000

# name, clearing steps (kind, amount), status, cleared, reversed, refunded
FLOWS = [
    ("approved", [], "AUTHORIZED", 0, 0, 0),
    ("part-reversed", [("reverse", 2_000)], "PARTIALLY_REVERSED", 0, 2_000, 0),
    ("reversed", [("reverse", AMOUNT)], "REVERSED", 0, AMOUNT, 0),
    ("settled", [("settle", AMOUNT)], "SETTLED", AMOUNT, 0, 0),
    ("settled-less", [("settle", 4_500)], "SETTLED", 4_500, 0, 0),
    (
        "part-reversed-then-settled",
        [("reverse", 1_000), ("settle", 4_000)],
        "SETTLED",
        4_000,
        1_000,
        0,
    ),
    (
        "part-refunded",
        [("settle", AMOUNT), ("refund", 1_500)],
        "PARTIALLY_REFUNDED",
        AMOUNT,
        0,
        1_500,
    ),
    ("refunded", [("settle", AMOUNT), ("refund", AMOUNT)], "REFUNDED", AMOUNT, 0, AMOUNT),
    (
        "refunded-in-two",
        [("settle", AMOUNT), ("refund", 2_000), ("refund", 3_000)],
        "REFUNDED",
        AMOUNT,
        0,
        AMOUNT,
    ),
]


@pytest.mark.parametrize(
    ("steps", "status", "cleared", "reversed_", "refunded"),
    [row[1:] for row in FLOWS],
    ids=[row[0] for row in FLOWS],
)
def test_status_follows_the_amounts(
    make_customer, card_network, steps, status, cleared, reversed_, refunded
):
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]
    auth = wallet_purchase(card_network, own, AMOUNT)
    assert auth.decision == "APPROVED"
    clearing = {
        "settle": card_network.settle,
        "reverse": card_network.reverse,
        "refund": card_network.refund,
    }
    for kind, amount in steps:
        expect(clearing[kind](auth.trace_id, amount), 200, Clearing)

    txn = wait_for_transaction(
        someone, auth.trace_id, lambda t: t.status == status, what=f"status {status}"
    )

    assert (txn.amount, txn.cleared_amount, txn.reversed_amount, txn.refunded_amount) == (
        AMOUNT,
        cleared,
        reversed_,
        refunded,
    )
    assert (txn.settled_at is not None) == any(kind == "settle" for kind, _ in steps)


def test_a_declined_wallet_purchase_is_in_the_history_too(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True, limit=1_000, available=1_000)))
    own = someone.new_cards[0]

    auth = wallet_purchase(card_network, own, 1_001)

    assert (auth.decision, auth.decline_code) == ("DECLINED", "INSUFFICIENT_FUNDS")
    txn = wait_for_transaction(someone, auth.trace_id)
    assert (txn.status, txn.decline_code, txn.amount) == ("DECLINED", "INSUFFICIENT_FUNDS", 1_001)


def test_the_merchant_details_are_kept_as_sent(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))
    name = "Café <b>Ünïcode</b> & Co"

    auth = wallet_purchase(
        card_network, someone.new_cards[0], 1_234, merchant_name=name, mcc="5812"
    )

    txn = wait_for_transaction(someone, auth.trace_id)
    assert (txn.merchant_name, txn.mcc, txn.currency) == (name, "5812", "USD")


def test_a_plain_card_purchase_is_not_a_wallet_transaction(make_customer, card_network):
    # Only purchases made with the wallet token belong in the wallet history. Waiting for
    # absence has no end, so a wallet purchase made afterwards on the same card is the
    # marker: once it is visible, the earlier card purchase would have been too.
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]
    plain = expect(card_network.purchase(own.card_id, 700), 200, Authorization)
    marker = wallet_purchase(card_network, own, 800)

    wait_for_transaction(someone, marker.trace_id)

    assert find(someone, plain.trace_id) is None


def test_a_transaction_is_read_by_its_id(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))
    auth = wallet_purchase(card_network, someone.new_cards[0], 2_500)
    listed = wait_for_transaction(someone, auth.trace_id)

    assert expect(someone.transactions.get(listed.txn_id), 200, Transaction) == listed


def test_another_customers_transaction_is_not_found(make_customer, card_network, alice):
    someone = make_customer(customer(card(enrolled=True)))
    auth = wallet_purchase(card_network, someone.new_cards[0], 2_500)
    theirs = wait_for_transaction(someone, auth.trace_id)

    expect_error(alice.transactions.get(theirs.txn_id), 404, "TRANSACTION_NOT_FOUND")
