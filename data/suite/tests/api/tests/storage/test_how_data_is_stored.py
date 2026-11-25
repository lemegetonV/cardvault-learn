"""What the database holds (spec 3, 6.2, 16.3 rule 27, 16.6 rule 38).

Some promises cannot be seen through an API: that a card number is stored encrypted, that
money is whole cents, that every event row in the outbox is published. These tests read
the services' databases with the read-only role, and only for those promises.
"""

from __future__ import annotations

import psycopg
import pytest

from cardvault_tests.checks import pan_like
from cardvault_tests.data import card, customer
from cardvault_tests.db import connect
from cardvault_tests.transactions import wallet_purchase
from cardvault_tests.waits import wait_until


@pytest.mark.lesson
def test_a_card_number_is_never_stored_in_clear(make_customer, db):
    someone = make_customer(customer(card()))

    row = db.one("card", "SELECT * FROM cards WHERE card_id = %s", someone.card_ids[0])

    assert row["last4"] == someone.new_cards[0].last4
    clear = {k: v for k, v in row.items() if isinstance(v, str) and pan_like(v)}
    assert clear == {}, f"PAN-like values stored in clear: {list(clear)}"


@pytest.mark.parametrize(
    ("database", "table", "columns"),
    [
        ("card", "cards", ["limit_amount", "available_amount"]),
        ("card", "holds", ["original_amount", "amount"]),
        (
            "wallet_txn",
            "wallet_transactions",
            ["auth_amount", "cleared_amount", "reversed_amount", "refunded_amount"],
        ),
    ],
)
def test_money_columns_are_whole_numbers(db, database, table, columns):
    found = db.rows(
        database,
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name = %s AND column_name = ANY(%s)",
        table,
        columns,
    )

    assert {r["column_name"]: r["data_type"] for r in found} == dict.fromkeys(columns, "bigint")


def test_every_event_of_a_purchase_leaves_the_outbox(make_customer, card_network, db):
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]
    wallet_purchase(card_network, own, 1_000)

    rows = wait_until(
        lambda: db.rows("card", "SELECT published_at FROM outbox WHERE key = %s", str(own.card_id)),
        lambda found: found and all(r["published_at"] is not None for r in found),
        what="every outbox row for the card to be published",
    )
    assert rows


@pytest.mark.lesson
def test_the_suite_cannot_write(db, settings):
    with connect(settings, "card") as conn, pytest.raises(psycopg.errors.InsufficientPrivilege):
        conn.execute("UPDATE cards SET status = status")
