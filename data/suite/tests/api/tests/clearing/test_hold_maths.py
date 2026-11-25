"""Holds and clearing: what happens to the money after an approval (spec 6.2, 16.1 rule 7,
16.4 rules 25 and 26).

Every test starts from a fresh card with a known limit, so ``available`` can be worked out
by hand: limit, minus what is held, minus what was charged, plus what came back.

    approve 10.00     available = limit - 10.00             hold ACTIVE 10.00
    reverse  3.00     available = limit -  7.00             hold ACTIVE  7.00
    settle   7.00     available = limit -  7.00             hold SETTLED
    refund   2.00     available = limit -  5.00
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.clients.card_network import new_clearing_id
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Card, Clearing

LIMIT = 100_000  # 1,000.00


@pytest.fixture
def approved(make_customer, card_network):
    """Return a function that makes a fresh card with one approved 10.00 purchase."""

    def make(product: str = "CREDIT", amount: int = 1_000):
        someone = make_customer(customer(card(product, limit=LIMIT)))
        card_id = someone.card_ids[0]
        auth = expect(card_network.purchase(card_id, amount), 200, Authorization)
        assert auth.decision == "APPROVED"
        return someone, card_id, auth.trace_id

    return make


def available(someone, card_id) -> int:
    return expect(someone.cards.get(card_id), 200, Card).available


# ------------------------------------------------------------------ settle


@pytest.mark.parametrize(
    ("product", "settled", "expected_available"),
    [
        ("CREDIT", 1_000, LIMIT - 1_000),  # as authorised
        ("CREDIT", 800, LIMIT - 800),  # less than held: the difference comes back
        ("CREDIT", 1_200, LIMIT - 1_200),  # more than held: CREDIT may (tips, fuel)
        ("DEBIT", 800, LIMIT - 800),
    ],
    ids=["credit-exact", "credit-under", "credit-over", "debit-under"],
)
def test_settle_charges_the_cleared_amount(
    approved, card_network, product, settled, expected_available
):
    someone, card_id, trace_id = approved(product)

    result = expect(card_network.settle(trace_id, settled), 200, Clearing)

    assert (result.hold_status, result.cleared_amount) == ("SETTLED", settled)
    assert result.available == expected_available
    assert available(someone, card_id) == expected_available


@pytest.mark.parametrize("product", ["DEBIT", "PREPAID"])
def test_only_credit_may_settle_above_the_hold(approved, card_network, product):
    someone, card_id, trace_id = approved(product)

    error = expect_error(card_network.settle(trace_id, 1_001), 422, "OVER_SETTLE_NOT_ALLOWED")

    assert error.details == {"hold_amount": 1_000, "amount": 1_001}
    assert available(someone, card_id) == LIMIT - 1_000


def test_credit_available_can_go_negative(make_customer, card_network):
    someone = make_customer(customer(card("CREDIT", limit=1_000)))
    card_id = someone.card_ids[0]
    trace_id = expect(card_network.purchase(card_id, 1_000), 200, Authorization).trace_id

    expect(card_network.settle(trace_id, 1_500), 200, Clearing)

    assert available(someone, card_id) == -500


def test_a_trace_settles_only_once(approved, card_network):
    _, _, trace_id = approved()
    expect(card_network.settle(trace_id, 1_000), 200, Clearing)

    expect_error(card_network.settle(trace_id, 1_000), 409, "ALREADY_SETTLED")


# ------------------------------------------------------------------ reverse


def test_partial_reverse_releases_that_part_of_the_hold(approved, card_network):
    someone, card_id, trace_id = approved()

    result = expect(card_network.reverse(trace_id, 300), 200, Clearing)

    assert (result.hold_status, result.hold_amount, result.reversed_amount) == ("ACTIVE", 700, 300)
    assert available(someone, card_id) == LIMIT - 700


def test_reversing_the_rest_releases_the_hold(approved, card_network):
    someone, card_id, trace_id = approved()
    expect(card_network.reverse(trace_id, 300), 200, Clearing)

    result = expect(card_network.reverse(trace_id, 700), 200, Clearing)

    assert (result.hold_status, result.hold_amount) == ("RELEASED", 0)
    assert available(someone, card_id) == LIMIT


def test_reverse_cannot_exceed_what_is_held(approved, card_network):
    someone, card_id, trace_id = approved()

    expect_error(card_network.reverse(trace_id, 1_001), 422, "AMOUNT_EXCEEDS_HOLD")
    assert available(someone, card_id) == LIMIT - 1_000


def test_settle_after_partial_reverse_uses_the_remaining_hold(approved, card_network):
    someone, card_id, trace_id = approved()
    expect(card_network.reverse(trace_id, 300), 200, Clearing)

    result = expect(card_network.settle(trace_id, 700), 200, Clearing)

    assert result.hold_status == "SETTLED"
    assert available(someone, card_id) == LIMIT - 700


def test_settled_purchases_are_refunded_not_reversed(approved, card_network):
    _, _, trace_id = approved()
    expect(card_network.settle(trace_id, 1_000), 200, Clearing)

    expect_error(card_network.reverse(trace_id, 100), 409, "ALREADY_SETTLED")


def test_fully_reversed_purchase_cannot_be_settled(approved, card_network):
    _, _, trace_id = approved()
    expect(card_network.reverse(trace_id, 1_000), 200, Clearing)

    expect_error(card_network.settle(trace_id, 1_000), 409, "HOLD_RELEASED")


# ------------------------------------------------------------------ refund


def test_refund_needs_a_settled_purchase(approved, card_network):
    _, _, trace_id = approved()

    expect_error(card_network.refund(trace_id, 100), 409, "NOT_SETTLED")


def test_partial_refunds_add_up_to_the_cleared_amount(approved, card_network):
    someone, card_id, trace_id = approved()
    expect(card_network.settle(trace_id, 1_000), 200, Clearing)

    first = expect(card_network.refund(trace_id, 400), 200, Clearing)
    second = expect(card_network.refund(trace_id, 600), 200, Clearing)

    assert (first.refunded_amount, second.refunded_amount) == (400, 1_000)
    assert available(someone, card_id) == LIMIT


def test_refund_cannot_exceed_what_is_left_to_refund(approved, card_network):
    someone, card_id, trace_id = approved()
    expect(card_network.settle(trace_id, 1_000), 200, Clearing)
    expect(card_network.refund(trace_id, 400), 200, Clearing)

    error = expect_error(card_network.refund(trace_id, 601), 422, "REFUND_EXCEEDS_CLEARED")

    assert error.details == {"refundable": 600, "amount": 601}
    assert available(someone, card_id) == LIMIT - 600


# ------------------------------------------------------------------ bad records


def test_clearing_for_an_unknown_trace_is_not_found(card_network):
    expect_error(card_network.settle("trc-never-authorised", 100), 404, "TRACE_NOT_FOUND")


def test_clearing_for_a_declined_purchase_is_refused(make_customer, card_network):
    someone = make_customer(customer(card(status="LOST")))
    trace_id = expect(
        card_network.purchase(someone.card_ids[0], 1_000), 200, Authorization
    ).trace_id

    expect_error(card_network.settle(trace_id, 1_000), 409, "AUTH_DECLINED")


def test_repeated_clearing_id_is_applied_once(approved, card_network):
    someone, card_id, trace_id = approved()
    clearing_id = new_clearing_id()

    first = expect(card_network.reverse(trace_id, 300, clearing_id), 200, Clearing)
    again = expect(card_network.reverse(trace_id, 300, clearing_id), 200, Clearing)

    assert again == first
    assert available(someone, card_id) == LIMIT - 700


def test_clearing_id_reused_for_another_record_is_refused(approved, card_network):
    _, _, trace_id = approved()
    clearing_id = new_clearing_id()
    expect(card_network.reverse(trace_id, 300, clearing_id), 200, Clearing)

    expect_error(card_network.reverse(trace_id, 200, clearing_id), 422, "CLEARING_ID_REUSED")


@pytest.mark.parametrize(
    ("held", "reversed_", "left"),
    [(3, 1, 2), (57, 1, 56), (115, 15, 100), (1_999, 999, 1_000)],
    ids=["0.03-0.01", "0.57-0.01", "1.15-0.15", "19.99-9.99"],
)
def test_cent_amounts_are_exact(make_customer, card_network, held, reversed_, left):
    # Money is integer cents. These amounts have no exact binary floating-point form in
    # dollars (0.57 - 0.01 is 0.5599999... as a float), so they catch any step that does
    # money arithmetic in float dollars instead of integer cents.
    someone = make_customer(customer(card(limit=LIMIT)))
    card_id = someone.card_ids[0]
    trace_id = expect(card_network.purchase(card_id, held), 200, Authorization).trace_id

    result = expect(card_network.reverse(trace_id, reversed_), 200, Clearing)

    assert result.hold_amount == left
    assert available(someone, card_id) == LIMIT - left
