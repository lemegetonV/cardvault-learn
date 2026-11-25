"""Adding a card to the wallet and taking it out again (spec 6.3, 16.1 rule 4,
16.2 rules 8, 12, 15 and 16).

Adding is asynchronous:

    customer adds card --> PENDING (202) --> bank asks the operator (outbox)
        --> operator sends a signed callback ~2 s later --> ENROLLED, with a token

Removing is immediate on the bank's side (REMOVED at once, so the token stops working for
purchases straight away); the operator is told afterwards.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, WalletCard
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wait_for_enrolment, wallet_card


@pytest.mark.lesson
def test_adding_an_eligible_card_ends_enrolled_with_a_working_token(
    make_customer, enrolments, card_network
):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    added = expect(someone.wallet.add(card_id), 202, WalletCard)
    assert added.enrollment.status == "PENDING"

    enrolled = wait_for_enrolment(someone, card_id, "ENROLLED")
    assert enrolled.enrollment.last4 == enrolled.last4
    token_ref = enrolments.record(card_id)["token_ref"]
    assert token_ref
    # card-service learns about the new token from an event, so allow it a moment.
    decision = wait_until(
        lambda: expect(card_network.purchase(card_id, 100, token_ref), 200, Authorization),
        lambda d: d.decision == "APPROVED",
        timeout=10,
        what="a wallet purchase with the new token to be approved",
    )
    assert decision.decline_code is None


def test_terms_version_is_required(make_customer):
    someone = make_customer(customer(card()))

    expect_error(
        someone.wallet.add(someone.card_ids[0], terms_version=None), 422, "VALIDATION_ERROR"
    )


def test_an_ineligible_card_cannot_be_added(make_customer):
    someone = make_customer(customer(card("PREPAID")))

    error = expect_error(someone.wallet.add(someone.card_ids[0]), 422, "CARD_INELIGIBLE")

    assert error.details == {"reason": "PRODUCT_NOT_SUPPORTED"}


def test_an_opted_out_customer_cannot_add_a_card(make_customer):
    someone = make_customer(customer(card(), opted_out=True))

    expect_error(someone.wallet.add(someone.card_ids[0]), 409, "WALLET_OPTED_OUT")


def test_adding_an_enrolled_card_again_returns_it_unchanged(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    before = wallet_card(someone, card_id)

    again = expect(someone.wallet.add(card_id), 200, WalletCard)

    assert again == before


def test_removing_is_immediate_and_the_token_stops_working(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]

    removed = expect(someone.wallet.remove(own.card_id), 200, WalletCard)

    assert removed.enrollment.status == "REMOVED"
    assert removed.enrollment.status_reason == "CUSTOMER_REMOVED"
    # card-service keeps its own copy of token status, updated from events: eventually
    # consistent by design (spec 6.2), so the decline is awaited.
    declined = wait_until(
        lambda: expect(card_network.purchase(own.card_id, 100, own.token_ref), 200, Authorization),
        lambda d: d.decision == "DECLINED",
        timeout=10,
        what="card-service to see the token as no longer enrolled",
    )
    assert declined.decline_code == "TOKEN_INACTIVE"


def test_removing_twice_returns_the_same_state(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    first = expect(someone.wallet.remove(card_id), 200, WalletCard)

    again = expect(someone.wallet.remove(card_id), 200, WalletCard)

    assert again == first


def test_re_adding_a_removed_card_reuses_the_row_with_a_new_token(make_customer, enrolments):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    before = enrolments.record(card_id)
    expect(someone.wallet.remove(card_id), 200, WalletCard)

    expect(someone.wallet.add(card_id), 202, WalletCard)
    wait_for_enrolment(someone, card_id, "ENROLLED")

    after = enrolments.record(card_id)
    assert after["enrollment_id"] == before["enrollment_id"], "one row per card"
    assert after["version"] > before["version"]
    assert after["token_ref"] != before["token_ref"]
    assert wallet_card(someone, card_id).eligible  # the removal mark was cleared


@pytest.mark.parametrize("action", ["add", "remove", "read"])
def test_another_customers_card_is_not_found(alice, action):
    other = uuid.uuid4()
    call = {"add": alice.wallet.add, "remove": alice.wallet.remove, "read": alice.wallet.card}

    expect_error(call[action](other), 404, "CARD_NOT_FOUND")
