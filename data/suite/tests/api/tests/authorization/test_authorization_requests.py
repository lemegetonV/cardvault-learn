"""Who may call authorization, which requests are valid, and duplicate trace IDs
(spec 6.2, 16.4 rule 23, 16.6 rule 40)."""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.auth import ServiceKeyAuth
from cardvault_tests.checks import expect, expect_error
from cardvault_tests.clients.card_network import new_trace_id
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Card


def valid_body(for_card, **change):
    body = {
        "trace_id": new_trace_id(),
        "card_id": str(for_card),
        "token_ref": None,
        "token_requestor": "CARD",
        "amount": 1_000,
        "currency": "USD",
        "merchant_name": "Suite Test Merchant",
        "mcc": "5999",
    }
    body.update(change)
    return {k: v for k, v in body.items() if v is not ...}


@pytest.fixture
def card_id(make_customer):
    return make_customer(customer(card())).card_ids[0]


@pytest.mark.parametrize(
    "change",
    [
        {"amount": 0},
        {"amount": -100},
        {"currency": "EUR"},
        {"mcc": "59"},
        {"merchant_name": ""},
        {"trace_id": ...},
        {"card_id": ...},
        {"amount": ...},
        {"token_requestor": "WALLET"},  # WALLET needs a token_ref
        {"token_requestor": "PHONE"},
    ],
    ids=lambda c: "-".join(f"{k}={'missing' if v is ... else v}" for k, v in c.items()),
)
def test_malformed_request_is_rejected(card_network, card_id, change):
    expect_error(card_network.authorize(valid_body(card_id, **change)), 422, "VALIDATION_ERROR")


def test_unknown_card_is_not_found(card_network):
    expect_error(card_network.authorize(valid_body(uuid.uuid4())), 404, "CARD_NOT_FOUND")


@pytest.mark.parametrize(
    "who",
    ["no-key", "wrong-key", "customer-token"],
)
def test_only_known_services_may_authorize(card_network, card_id, alice, who):
    auth = {
        "no-key": ServiceKeyAuth(""),
        "wrong-key": ServiceKeyAuth("not-a-service-key"),
        "customer-token": alice.bearer,
    }[who]

    expect_error(card_network.authorize(valid_body(card_id), auth=auth), 401, "SERVICE_KEY_INVALID")


def test_duplicate_trace_id_returns_the_first_decision_and_holds_once(make_customer, card_network):
    someone = make_customer(customer(card(limit=100_000)))
    card_id = someone.card_ids[0]
    body = valid_body(card_id, amount=2_500)

    first = expect(card_network.authorize(body), 200, Authorization)
    again = expect(card_network.authorize(body), 200, Authorization)

    assert again == first
    assert expect(someone.cards.get(card_id), 200, Card).available == 100_000 - 2_500


def test_duplicate_trace_id_with_another_amount_still_returns_the_first_decision(
    make_customer, card_network
):
    # The network retries with the same trace_id; whatever it resends, the bank's answer for
    # that trace_id does not change.
    someone = make_customer(customer(card(limit=100_000)))
    card_id = someone.card_ids[0]
    trace_id = new_trace_id()

    first = expect(card_network.purchase(card_id, 2_500, trace_id=trace_id), 200, Authorization)
    retry = expect(card_network.purchase(card_id, 9_000, trace_id=trace_id), 200, Authorization)

    assert retry == first
    assert expect(someone.cards.get(card_id), 200, Card).available == 100_000 - 2_500
