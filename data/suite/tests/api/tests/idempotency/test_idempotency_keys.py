"""``Idempotency-Key`` on customer actions (spec section 5, 16.5 rule 32).

A client that times out cannot know whether its request worked. With an idempotency key it
can simply send the same request again: the first answer is stored and replayed, so the
action happens once. The rules:

* same key, same request -> the stored response, with ``Idempotent-Replayed: true``
* same key, different request (another path or body) -> 422 IDEMPOTENCY_KEY_REUSED
* the scope is the caller plus the endpoint, so customers never see each other's answers

Reissue is the clearest action to test with, because doing it twice would visibly differ
(a second reissue makes a new card number).
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import Card


def new_key() -> str:
    return f"idem-{uuid.uuid4()}"


@pytest.mark.lesson
def test_same_key_replays_the_first_response(make_customer):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]
    key = new_key()

    first = someone.cards.reissue(card_id, idempotency_key=key)
    again = someone.cards.reissue(card_id, idempotency_key=key)

    assert (first.status_code, again.status_code) == (200, 200)
    assert again.content == first.content, "a replay is byte-for-byte the first response"
    assert again.headers.get("Idempotent-Replayed") == "true"
    assert "Idempotent-Replayed" not in first.headers
    # Only one reissue happened: the card is exactly as the first response described it.
    assert expect(someone.cards.get(card_id), 200, Card) == Card.model_validate(first.json())


def test_without_a_key_each_request_runs(make_customer):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    first = expect(someone.cards.reissue(card_id), 200, Card)
    second = expect(someone.cards.reissue(card_id), 200, Card)

    assert second.created_at == first.created_at  # same card
    assert "Idempotent-Replayed" not in someone.cards.reissue(card_id).headers


def test_key_reused_for_another_card_is_refused(make_customer):
    someone = make_customer(customer(card(), card()))
    first_card, second_card = someone.card_ids
    key = new_key()
    expect(someone.cards.report_lost(first_card, idempotency_key=key), 200, Card)

    expect_error(
        someone.cards.report_lost(second_card, idempotency_key=key), 422, "IDEMPOTENCY_KEY_REUSED"
    )
    assert expect(someone.cards.get(second_card), 200, Card).status == "ACTIVE"


def test_the_same_key_on_another_endpoint_is_a_different_request(make_customer):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]
    key = new_key()

    lost = expect(someone.cards.report_lost(card_id, idempotency_key=key), 200, Card)
    reissued = expect(someone.cards.reissue(card_id, idempotency_key=key), 200, Card)

    assert (lost.status, reissued.status) == ("LOST", "ACTIVE")


def test_two_customers_using_the_same_key_each_get_their_own_answer(make_customer):
    one = make_customer(customer(card()))
    two = make_customer(customer(card()))
    key = new_key()

    first = expect(one.cards.report_lost(one.card_ids[0], idempotency_key=key), 200, Card)
    second = two.cards.report_lost(two.card_ids[0], idempotency_key=key)

    # Same route and key, different callers: the second customer's own card is reported
    # lost; nothing of the first customer's response comes back.
    assert "Idempotent-Replayed" not in second.headers
    assert expect(second, 200, Card).card_id == two.card_ids[0] != first.card_id


def test_a_failed_request_is_replayed_too(make_customer):
    # Client errors are stored like successes: retrying a refused action stays refused.
    someone = make_customer(customer(card(status="CLOSED")))
    card_id = someone.card_ids[0]
    key = new_key()

    first = someone.cards.reissue(card_id, idempotency_key=key)
    again = someone.cards.reissue(card_id, idempotency_key=key)

    expect_error(first, 409, "INVALID_STATE_TRANSITION")
    assert (again.status_code, again.content) == (409, first.content)


def test_key_longer_than_128_characters_is_rejected(make_customer):
    someone = make_customer(customer(card()))

    expect_error(
        someone.cards.report_lost(someone.card_ids[0], idempotency_key="k" * 129),
        422,
        "VALIDATION_ERROR",
    )
