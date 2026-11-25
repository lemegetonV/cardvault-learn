"""The authorization decision, checked condition by condition (spec 6.2, 16.3 rule 22,
16.4 rules 23 and 24).

card-service checks, in this order, and the first failing check decides:

    card LOST -> CARD_LOST
    card CLOSED -> CARD_CLOSED
    card expired -> CARD_EXPIRED
    WALLET token not mapped to this card -> TOKEN_MISMATCH
    WALLET token not ENROLLED -> TOKEN_INACTIVE      (needs a wallet change: wallet tests)
    amount above available -> INSUFFICIENT_FUNDS
    otherwise APPROVED, with a hold

Each row builds a fresh customer whose card has exactly the conditions in the row, so the
expected code follows from the table, not from what the service happened to return.
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Card

EXPIRED = "2020-01"  # long past on any clock

DECLINES = [
    # id,                   card template,                                   amount, code
    ("lost", card(status="LOST"), 1_000, "CARD_LOST"),
    ("closed", card(status="CLOSED"), 1_000, "CARD_CLOSED"),
    ("expired", card(expiry=EXPIRED), 1_000, "CARD_EXPIRED"),
    ("over-available", card(limit=50_000), 50_001, "INSUFFICIENT_FUNDS"),
    # Order: an earlier check wins when several conditions hold at once.
    ("lost-beats-expired", card(status="LOST", expiry=EXPIRED), 1_000, "CARD_LOST"),
    ("closed-beats-expired", card(status="CLOSED", expiry=EXPIRED), 1_000, "CARD_CLOSED"),
    ("expired-beats-funds", card(expiry=EXPIRED, limit=100), 1_000, "CARD_EXPIRED"),
]


@pytest.mark.lesson
@pytest.mark.parametrize(
    ("template", "amount", "code"), [row[1:] for row in DECLINES], ids=[r[0] for r in DECLINES]
)
def test_card_purchase_is_declined(make_customer, card_network, template, amount, code):
    someone = make_customer(customer(template))
    card_id = someone.card_ids[0]
    before = expect(someone.cards.get(card_id), 200, Card)

    decision = expect(card_network.purchase(card_id, amount), 200, Authorization)

    assert (decision.decision, decision.decline_code, decision.hold_id) == (
        "DECLINED",
        code,
        None,
    )
    assert expect(someone.cards.get(card_id), 200, Card).available == before.available


def test_amount_equal_to_available_is_approved(make_customer, card_network):
    someone = make_customer(customer(card(limit=50_000)))

    decision = expect(card_network.purchase(someone.card_ids[0], 50_000), 200, Authorization)

    assert decision.decision == "APPROVED"
    assert decision.hold_id is not None


def test_approval_holds_the_amount_and_marks_the_card_used(make_customer, card_network, controls):
    someone = make_customer(customer(card(limit=100_000, used_days_ago=30)))
    card_id = someone.card_ids[0]

    decision = expect(card_network.purchase(card_id, 12_345), 200, Authorization)

    after = expect(someone.cards.get(card_id), 200, Card)
    assert decision.decision == "APPROVED"
    assert decision.decline_code is None
    assert after.available == 100_000 - 12_345
    assert after.limit == 100_000
    assert after.last_used_at == decision.decided_at


def test_wallet_purchase_with_the_cards_own_token_is_approved(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]

    decision = expect(card_network.purchase(own.card_id, 1_000, own.token_ref), 200, Authorization)

    assert decision.decision == "APPROVED"


def test_token_of_another_card_is_a_mismatch(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True), card(enrolled=True)))
    first, second = someone.new_cards

    decision = expect(
        card_network.purchase(first.card_id, 1_000, second.token_ref), 200, Authorization
    )

    assert (decision.decision, decision.decline_code) == ("DECLINED", "TOKEN_MISMATCH")


def test_unknown_token_is_a_mismatch(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))

    decision = expect(
        card_network.purchase(someone.card_ids[0], 1_000, "tok_never_issued"), 200, Authorization
    )

    assert (decision.decision, decision.decline_code) == ("DECLINED", "TOKEN_MISMATCH")


def test_expiry_is_checked_before_the_token(make_customer, card_network):
    someone = make_customer(customer(card(expiry=EXPIRED, enrolled=True), card(enrolled=True)))
    expired, other = someone.new_cards

    decision = expect(
        card_network.purchase(expired.card_id, 1_000, other.token_ref), 200, Authorization
    )

    assert decision.decline_code == "CARD_EXPIRED"


def test_token_mismatch_is_checked_before_funds(make_customer, card_network):
    someone = make_customer(customer(card(limit=100, enrolled=True), card(enrolled=True)))
    poor, other = someone.new_cards

    decision = expect(
        card_network.purchase(poor.card_id, 1_000, other.token_ref), 200, Authorization
    )

    assert decision.decline_code == "TOKEN_MISMATCH"


def test_card_purchase_skips_the_token_checks(make_customer, card_network):
    # A plain card purchase (token_requestor CARD) has no token; it can make an unused card
    # recently used, which is how a card becomes wallet-eligible (spec 16.3 rule 22).
    someone = make_customer(customer(card(used_days_ago=None)))
    card_id = someone.card_ids[0]

    decision = expect(card_network.purchase(card_id, 1_000), 200, Authorization)

    assert decision.decision == "APPROVED"
    assert expect(someone.cards.get(card_id), 200, Card).last_used_at is not None
