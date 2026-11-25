"""Reading the history: paging, filters and the CSV export (spec 6.4, 16.8 rules 54 to 56,
16.6 rule 42).

Paging and filtering are checked against invariants that hold for any data: walking the
pages in small steps must give exactly the same list as one big page, newest first, with no
gaps or repeats. The seed customer alice has enough history for that and is only read.
"""

from __future__ import annotations

import csv
import io
from datetime import timedelta

import pytest

from cardvault_tests.checks import expect, expect_error, expect_status
from cardvault_tests.data import card, customer
from cardvault_tests.models import Clearing, TransactionPage
from cardvault_tests.transactions import wait_for_transaction, wallet_purchase

EXPORT_COLUMNS = [
    "txn_id",
    "occurred_at_utc",
    "card_id",
    "merchant_name",
    "mcc",
    "status",
    "decline_code",
    "amount",
    "cleared_amount",
    "reversed_amount",
    "refunded_amount",
    "currency",
    "settled_at_utc",
]


def all_pages(someone, limit: int, **filters) -> list:
    items, cursor = [], None
    for _ in range(100):  # a bound, so a cursor that never ends fails instead of hanging
        page = expect(
            someone.transactions.list(limit=limit, cursor=cursor, **filters), 200, TransactionPage
        )
        items += page.items
        cursor = page.next_cursor
        if cursor is None:
            return items
    pytest.fail("paging did not end within 100 pages")


# ---------------------------------------------------------------- paging (alice, read-only)


def test_small_pages_add_up_to_one_big_page(alice):
    big = expect(alice.transactions.list(limit=100), 200, TransactionPage)
    assert big.next_cursor is None, "alice's history fits in one page of 100"

    walked = all_pages(alice, limit=7)

    assert [t.txn_id for t in walked] == [t.txn_id for t in big.items]
    assert len(walked) > 7, "more than one page was walked"


def test_the_history_is_newest_first(alice):
    items = expect(alice.transactions.list(limit=100), 200, TransactionPage).items

    keys = [(t.occurred_at, str(t.txn_id)) for t in items]
    assert keys == sorted(keys, reverse=True)


def test_the_default_page_size_is_20(alice):
    assert len(expect(alice.transactions.list(), 200, TransactionPage).items) == 20


@pytest.mark.parametrize("limit", [0, 101])
def test_a_page_size_outside_1_to_100_is_refused(alice, limit):
    expect_error(alice.transactions.list(limit=limit), 422, "VALIDATION_ERROR")


def test_an_unreadable_cursor_is_a_bad_request(alice):
    expect_error(alice.transactions.list(cursor="not-a-cursor"), 400, "INVALID_CURSOR")


def test_status_and_card_filters_keep_only_matching_rows(alice):
    everything = expect(alice.transactions.list(limit=100), 200, TransactionPage).items
    statuses = ["SETTLED", "DECLINED"]
    card_id = everything[0].card_id

    filtered = all_pages(alice, limit=100, status=statuses, card_id=card_id)

    expected = [t for t in everything if t.status in statuses and t.card_id == card_id]
    assert [t.txn_id for t in filtered] == [t.txn_id for t in expected]


# ---------------------------------------------------------------- date bounds


@pytest.fixture
def one_purchase(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))
    auth = wallet_purchase(card_network, someone.new_cards[0], 1_000)
    return someone, wait_for_transaction(someone, auth.trace_id)


def ids(someone, **filters) -> list:
    return [t.txn_id for t in all_pages(someone, limit=100, **filters)]


def test_both_bounds_are_inclusive_to_the_microsecond(one_purchase):
    someone, txn = one_purchase
    at = txn.occurred_at.isoformat()
    just_after = (txn.occurred_at + timedelta(microseconds=1)).isoformat()
    just_before = (txn.occurred_at - timedelta(microseconds=1)).isoformat()

    assert ids(someone, from_=at, to=at) == [txn.txn_id]
    assert ids(someone, from_=just_after) == []
    assert ids(someone, to=just_before) == []


def test_a_date_means_the_whole_utc_day(one_purchase):
    someone, txn = one_purchase
    day = txn.occurred_at.date()

    assert ids(someone, from_=day.isoformat(), to=day.isoformat()) == [txn.txn_id]
    assert ids(someone, to=(day - timedelta(days=1)).isoformat()) == []


@pytest.mark.parametrize(
    "bounds",
    [
        {"from_": "2026-11-02", "to": "2026-11-01"},
        {"from_": "2026-11-01T00:00:00"},  # no offset: which timezone?
        {"to": "yesterday"},
    ],
    ids=["from-after-to", "no-timezone", "not-a-date"],
)
def test_invalid_bounds_are_refused(alice, bounds):
    expect_error(alice.transactions.list(**bounds), 422, "VALIDATION_ERROR")


# ---------------------------------------------------------------- CSV export


def read_csv(resp) -> list[dict]:
    return list(csv.DictReader(io.StringIO(resp.text)))


def test_the_export_matches_the_list(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]
    first = wallet_purchase(card_network, own, 1_999)
    second = wallet_purchase(card_network, own, 5)
    expect(card_network.settle(first.trace_id, 1_999), 200, Clearing)
    wait_for_transaction(someone, first.trace_id, lambda t: t.status == "SETTLED")
    wait_for_transaction(someone, second.trace_id)

    resp = expect_status(someone.transactions.export(), 200)

    assert resp.headers["content-type"].startswith("text/csv")
    assert resp.text.splitlines()[0].split(",") == EXPORT_COLUMNS
    rows = {r["txn_id"]: r for r in read_csv(resp)}
    listed = expect(someone.transactions.list(), 200, TransactionPage).items
    assert set(rows) == {str(t.txn_id) for t in listed}
    by_trace = {t.trace_id: rows[str(t.txn_id)] for t in listed}
    # Integer cents become dollars with exactly two decimals, never through a float.
    assert (by_trace[first.trace_id]["amount"], by_trace[first.trace_id]["cleared_amount"]) == (
        "19.99",
        "19.99",
    )
    assert by_trace[second.trace_id]["amount"] == "0.05"
    assert by_trace[second.trace_id]["settled_at_utc"] == ""
    assert by_trace[first.trace_id]["occurred_at_utc"].endswith("Z")


@pytest.mark.parametrize("start", ["=", "+", "-", "@"])
def test_a_merchant_name_a_spreadsheet_would_run_is_made_inert(make_customer, card_network, start):
    someone = make_customer(customer(card(enrolled=True)))
    name = f'{start}HYPERLINK("http://example.test")'
    auth = wallet_purchase(card_network, someone.new_cards[0], 100, merchant_name=name)
    wait_for_transaction(someone, auth.trace_id)

    rows = read_csv(expect_status(someone.transactions.export(), 200))

    assert rows[0]["merchant_name"] == "'" + name
    # The API itself still returns the name exactly as the merchant sent it.
    listed = expect(someone.transactions.list(), 200, TransactionPage).items
    assert listed[0].merchant_name == name


@pytest.mark.parametrize(
    ("bounds", "filename"),
    [
        ({}, "wallet-transactions-all-all.csv"),
        (
            {"from_": "2026-11-01", "to": "2026-11-30"},
            "wallet-transactions-2026-11-01-2026-11-30.csv",
        ),
        ({"from_": "2026-11-01"}, "wallet-transactions-2026-11-01-all.csv"),
    ],
    ids=["no-bounds", "both", "from-only"],
)
def test_the_export_filename_names_the_bounds(alice, bounds, filename):
    resp = expect_status(alice.transactions.export(**bounds), 200)

    assert resp.headers["content-disposition"] == f'attachment; filename="{filename}"'
