"""Disputing a transaction (spec 6.4, 16.10 rules 61 to 64).

A dispute is a multipart form: a reason, an optional note (at most 500 characters) and an
optional receipt (PDF, PNG or JPEG, at most 5,242,880 bytes). The receipt's type is judged
by its first bytes, its "magic number", never by its file name, because a name costs
nothing to fake. Only a transaction with money still involved can be disputed, and only
once while a dispute is OPEN.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import Clearing, Dispute, DisputePage, Transaction
from cardvault_tests.transactions import wait_for_transaction, wallet_purchase

MAX_RECEIPT = 5 * 1024 * 1024  # 5,242,880 bytes, inclusive
PDF = b"%PDF-1.7\n"
PNG = b"\x89PNG\r\n\x1a\n"
JPEG = b"\xff\xd8\xff\xe0"


@pytest.fixture
def purchase(make_customer, card_network):
    """A fresh customer with one approved 30.00 wallet purchase, in their history."""
    someone = make_customer(customer(card(enrolled=True)))
    auth = wallet_purchase(card_network, someone.new_cards[0], 3_000)
    return someone, wait_for_transaction(someone, auth.trace_id)


def test_a_dispute_is_opened_and_shows_on_the_transaction(purchase):
    someone, txn = purchase

    dispute = expect(
        someone.transactions.open_dispute(txn.txn_id, "UNRECOGNISED", note="Not me"), 201, Dispute
    )

    assert (dispute.txn_id, dispute.reason, dispute.note, dispute.status, dispute.receipt) == (
        txn.txn_id,
        "UNRECOGNISED",
        "Not me",
        "OPEN",
        None,
    )
    after = expect(someone.transactions.get(txn.txn_id), 200, Transaction)
    assert after.open_dispute_id == dispute.dispute_id
    assert expect(someone.transactions.dispute(dispute.dispute_id), 200, Dispute) == dispute
    listed = expect(someone.transactions.disputes(), 200, DisputePage).items
    assert [d.dispute_id for d in listed] == [dispute.dispute_id]


def test_a_second_open_dispute_is_refused(purchase):
    someone, txn = purchase
    first = expect(someone.transactions.open_dispute(txn.txn_id, "DUPLICATE"), 201, Dispute)

    error = expect_error(
        someone.transactions.open_dispute(txn.txn_id, "WRONG_AMOUNT"), 409, "DISPUTE_ALREADY_OPEN"
    )

    assert error.details == {"dispute_id": str(first.dispute_id)}


def test_an_unknown_reason_is_refused(purchase):
    someone, txn = purchase

    expect_error(
        someone.transactions.open_dispute(txn.txn_id, "CHANGED_MY_MIND"), 422, "VALIDATION_ERROR"
    )


@pytest.mark.parametrize(("length", "status"), [(500, 201), (501, 422)], ids=["500", "501"])
def test_the_note_is_at_most_500_characters(purchase, length, status):
    someone, txn = purchase

    resp = someone.transactions.open_dispute(txn.txn_id, "NOT_RECEIVED", note="n" * length)

    if status == 201:
        assert len(expect(resp, 201, Dispute).note) == 500
    else:
        expect_error(resp, 422, "VALIDATION_ERROR")


def test_another_customers_transaction_cannot_be_disputed(purchase, alice):
    _, txn = purchase

    expect_error(
        alice.transactions.open_dispute(txn.txn_id, "UNRECOGNISED"), 404, "TRANSACTION_NOT_FOUND"
    )


def test_an_unknown_dispute_is_not_found(alice):
    expect_error(alice.transactions.dispute(uuid.uuid4()), 404, "DISPUTE_NOT_FOUND")


# ---------------------------------------------------------------- which transactions


@pytest.mark.parametrize(
    ("steps", "status"),
    [
        ([("reverse", 3_000)], "REVERSED"),
        ([("settle", 3_000), ("refund", 3_000)], "REFUNDED"),
    ],
    ids=["reversed", "refunded"],
)
def test_a_transaction_with_no_money_left_cannot_be_disputed(purchase, card_network, steps, status):
    someone, txn = purchase
    clearing = {
        "settle": card_network.settle,
        "reverse": card_network.reverse,
        "refund": card_network.refund,
    }
    for kind, amount in steps:
        expect(clearing[kind](txn.trace_id, amount), 200, Clearing)
    wait_for_transaction(someone, txn.trace_id, lambda t: t.status == status)

    error = expect_error(
        someone.transactions.open_dispute(txn.txn_id, "UNRECOGNISED"),
        422,
        "TRANSACTION_NOT_DISPUTABLE",
    )

    assert error.details["status"] == status


def test_a_declined_transaction_cannot_be_disputed(make_customer, card_network):
    someone = make_customer(customer(card(enrolled=True, limit=1_000, available=1_000)))
    auth = wallet_purchase(card_network, someone.new_cards[0], 5_000)
    txn = wait_for_transaction(someone, auth.trace_id)

    expect_error(
        someone.transactions.open_dispute(txn.txn_id, "UNRECOGNISED"),
        422,
        "TRANSACTION_NOT_DISPUTABLE",
    )


# ---------------------------------------------------------------- receipts


@pytest.mark.parametrize(
    ("name", "content", "detected"),
    [
        ("receipt.pdf", PDF + b"body", "application/pdf"),
        ("receipt.png", PNG + b"body", "image/png"),
        ("receipt.jpg", JPEG + b"body", "image/jpeg"),
        ("receipt.pdf", PNG + b"body", "image/png"),  # the name lies; the bytes win
        ("receipt", JPEG + b"body", "image/jpeg"),  # no extension at all
    ],
    ids=["pdf", "png", "jpeg", "png-named-pdf", "no-extension"],
)
def test_the_receipt_type_comes_from_its_bytes(purchase, name, content, detected):
    someone, txn = purchase

    dispute = expect(
        someone.transactions.open_dispute(txn.txn_id, "WRONG_AMOUNT", receipt=(name, content)),
        201,
        Dispute,
    )

    assert dispute.receipt.model_dump() == {
        "filename": name,
        "content_type": detected,
        "size": len(content),
    }


@pytest.mark.parametrize(
    ("name", "content"),
    [("receipt.pdf", b"MZ\x90\x00 not a pdf"), ("notes.txt", b"plain text"), ("empty.png", b"")],
    ids=["exe-named-pdf", "text", "empty-file"],
)
def test_a_receipt_that_is_not_pdf_png_or_jpeg_is_refused(purchase, name, content):
    someone, txn = purchase

    resp = someone.transactions.open_dispute(txn.txn_id, "WRONG_AMOUNT", receipt=(name, content))

    error = expect_error(resp, 422, "RECEIPT_TYPE_NOT_ALLOWED")
    assert error.details == {"allowed": ["application/pdf", "image/png", "image/jpeg"]}


@pytest.mark.slow
@pytest.mark.parametrize(
    ("size", "status"),
    [(MAX_RECEIPT, 201), (MAX_RECEIPT + 1, 422)],
    ids=["exactly-5MB", "one-byte-over"],
)
def test_the_receipt_is_at_most_5_mb(purchase, size, status):
    someone, txn = purchase
    content = PDF + b"0" * (size - len(PDF))

    resp = someone.transactions.open_dispute(
        txn.txn_id, "WRONG_AMOUNT", receipt=("big.pdf", content)
    )

    if status == 201:
        assert expect(resp, 201, Dispute).receipt.size == MAX_RECEIPT
    else:
        error = expect_error(resp, 422, "RECEIPT_TOO_LARGE")
        assert error.details == {"max_bytes": MAX_RECEIPT}


# ---------------------------------------------------------------- retries


def test_a_retried_form_with_the_same_key_replays_the_first_answer(purchase):
    someone, txn = purchase
    key = f"dispute-{uuid.uuid4()}"
    receipt = ("r.png", PNG + b"same")
    first = someone.transactions.open_dispute(txn.txn_id, "DUPLICATE", "again", receipt, key)

    again = someone.transactions.open_dispute(txn.txn_id, "DUPLICATE", "again", receipt, key)

    assert expect(again, 201, Dispute) == expect(first, 201, Dispute)
    assert again.headers.get("Idempotent-Replayed") == "true"


def test_the_same_key_with_another_receipt_is_refused(purchase):
    someone, txn = purchase
    key = f"dispute-{uuid.uuid4()}"
    expect(
        someone.transactions.open_dispute(
            txn.txn_id, "DUPLICATE", None, ("r.png", PNG + b"a"), key
        ),
        201,
        Dispute,
    )

    resp = someone.transactions.open_dispute(
        txn.txn_id, "DUPLICATE", None, ("r.png", PNG + b"b"), key
    )

    expect_error(resp, 422, "IDEMPOTENCY_KEY_REUSED")
