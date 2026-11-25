"""Reading cards: the seed customer's cards, ownership and pagination (spec 6.2, 5, 16.5)."""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import ALICE, BOB, card, customer
from cardvault_tests.models import Card, CardPage


@pytest.mark.lesson
@pytest.mark.smoke
def test_alice_sees_exactly_her_four_seed_cards(alice):
    page = expect(alice.cards.list(), 200, CardPage)

    seen = {(c.card_id, c.product, c.status, c.last4) for c in page.items}
    expected = {(c.card_id, c.product, c.status, c.last4) for c in ALICE.cards}
    assert seen == expected
    assert page.next_cursor is None


def test_one_card_reads_the_same_as_in_the_list(alice):
    listed = {c.card_id: c for c in expect(alice.cards.list(), 200, CardPage).items}
    card_id = ALICE.cards[0].card_id

    assert expect(alice.cards.get(card_id), 200, Card) == listed[card_id]


def test_another_customers_card_is_not_found(alice):
    # 404, the same answer as for a card that does not exist, so card IDs cannot be probed.
    bobs = expect_error(alice.cards.get(BOB.cards[0].card_id), 404, "CARD_NOT_FOUND")
    nobodys = expect_error(alice.cards.get(uuid.uuid4()), 404, "CARD_NOT_FOUND")

    assert bobs.message == nobodys.message


def test_pages_cover_every_card_once_newest_first(make_customer):
    someone = make_customer(customer(*[card() for _ in range(5)]))

    first = expect(someone.cards.list(limit=2), 200, CardPage)
    second = expect(someone.cards.list(limit=2, cursor=first.next_cursor), 200, CardPage)
    third = expect(someone.cards.list(limit=2, cursor=second.next_cursor), 200, CardPage)

    items = first.items + second.items + third.items
    assert [len(first.items), len(second.items), len(third.items)] == [2, 2, 1]
    assert third.next_cursor is None
    assert sorted(c.card_id for c in items) == sorted(someone.card_ids)
    keys = [(c.created_at, c.card_id) for c in items]
    assert keys == sorted(keys, reverse=True), "newest first, ties broken by id"


def test_unreadable_cursor_is_rejected(alice):
    expect_error(alice.cards.list(cursor="not-a-cursor"), 400, "INVALID_CURSOR")


@pytest.mark.parametrize("limit", [0, 101])
def test_page_size_outside_1_to_100_is_rejected(alice, limit):
    expect_error(alice.cards.list(limit=limit), 422, "VALIDATION_ERROR")
