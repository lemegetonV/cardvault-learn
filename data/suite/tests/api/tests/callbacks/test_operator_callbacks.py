"""The bank's callback endpoint, called directly as the operator (spec 5, 6.3, 16.6 rule 36).

The order of checks matters, so each layer has its own tests:

    1. signature and timestamp   -> 401 SIGNATURE_MISSING / SIGNATURE_INVALID / SIGNATURE_EXPIRED
    2. body shape                -> 422 VALIDATION_ERROR
    3. known enrolment           -> 404 ENROLLMENT_NOT_FOUND
    4. seen this event_id before -> 200 DUPLICATE, nothing changes
    5. apply                     -> 200 APPLIED, STALE, SUPERSEDED or IGNORED_REMOVED

Every callback here targets a fresh customer's enrolment, and the timestamp is taken from
enrollment-service's own clock, so these tests run in parallel without moving time.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import CallbackAck, ClockView, WalletCard
from cardvault_tests.wallet import wallet_card

WINDOW_SECONDS = 300  # spec 16.6 rule 36: within 5 minutes of the bank's clock


@pytest.fixture
def enrolled(make_customer, enrolments):
    """A fresh customer with one ENROLLED card, and the bank's record of it."""
    someone = make_customer(customer(card(enrolled=True)))
    return someone, enrolments.record(someone.card_ids[0])


@pytest.fixture
def bank_now(controls):
    """Unix seconds on enrollment-service's clock (the clock it checks X-Timestamp with)."""

    def now() -> int:
        view = expect(controls["enrollment"].clock(), 200, ClockView)
        return int(view.now.timestamp())

    return now


def callback(record: dict, status: str, version: int, **extra) -> dict:
    return {
        "event_id": str(uuid.uuid4()),
        "operator_ref": record["operator_ref"],
        "enrollment_id": record["enrollment_id"],
        "status": status,
        "operator_version": version,
        "occurred_at": datetime.now(UTC).isoformat(),
        **extra,
    }


# ---------------------------------------------------------------- 1. signature


def test_a_correctly_signed_callback_is_accepted(enrolled, callbacks, bank_now):
    someone, record = enrolled
    body = callback(record, "ENROLLED", record["operator_version"])

    ack = expect(callbacks.send(body, bank_now()), 200, CallbackAck)

    assert ack.result == "APPLIED"
    assert ack.status == "ENROLLED"


def test_an_unsigned_callback_is_refused(enrolled, callbacks):
    _, record = enrolled

    expect_error(callbacks.send_unsigned(callback(record, "REMOVED", 99)), 401, "SIGNATURE_MISSING")


def test_a_callback_signed_with_another_secret_is_refused(enrolled, callbacks, bank_now):
    someone, record = enrolled

    resp = callbacks.send(callback(record, "REMOVED", 99), bank_now(), secret="not-the-secret")

    expect_error(resp, 401, "SIGNATURE_INVALID")
    assert wallet_card(someone, record["card_id"]).enrollment.status == "ENROLLED"


def test_a_body_changed_after_signing_is_refused(enrolled, callbacks, bank_now):
    _, record = enrolled

    resp = callbacks.send(callback(record, "REMOVED", 99), bank_now(), tamper=True)

    expect_error(resp, 401, "SIGNATURE_INVALID")


@pytest.mark.parametrize("skew", [-295, 295], ids=["295s-early", "295s-late"])
def test_a_timestamp_inside_the_window_is_accepted(enrolled, callbacks, bank_now, skew):
    _, record = enrolled
    body = callback(record, "ENROLLED", record["operator_version"])

    expect(callbacks.send(body, bank_now() + skew), 200, CallbackAck)


@pytest.mark.parametrize("skew", [-305, 305], ids=["305s-early", "305s-late"])
def test_a_timestamp_outside_the_window_is_refused(enrolled, callbacks, bank_now, skew):
    _, record = enrolled
    body = callback(record, "ENROLLED", record["operator_version"])

    error = expect_error(callbacks.send(body, bank_now() + skew), 401, "SIGNATURE_EXPIRED")

    assert error.details["max_skew_seconds"] == WINDOW_SECONDS
    # Real time passes between reading the clock and the request, so allow a few seconds.
    assert abs(error.details["skew_seconds"] - abs(skew)) <= 3


# ---------------------------------------------------------------- 2 and 3. body, enrolment


@pytest.mark.parametrize(
    "change",
    [{"status": "PAUSED"}, {"operator_version": -1}, {"event_id": "not-a-uuid"}],
    ids=["unknown-status", "negative-version", "bad-event-id"],
)
def test_a_badly_formed_callback_is_refused(enrolled, callbacks, bank_now, change):
    _, record = enrolled
    body = {**callback(record, "ENROLLED", 1), **change}

    expect_error(callbacks.send(body, bank_now()), 422, "VALIDATION_ERROR")


def test_a_callback_for_an_unknown_enrolment_is_not_found(enrolled, callbacks, bank_now):
    _, record = enrolled
    body = callback({**record, "enrollment_id": str(uuid.uuid4())}, "ENROLLED", 1)

    expect_error(callbacks.send(body, bank_now()), 404, "ENROLLMENT_NOT_FOUND")


# ---------------------------------------------------------------- 4 and 5. apply


def test_the_same_event_twice_is_applied_once(enrolled, callbacks, bank_now, enrolments):
    # The operator re-issued the token: a newer ENROLLED callback with a new token_ref.
    _, record = enrolled
    body = callback(record, "ENROLLED", record["operator_version"] + 1, token_ref="tok_reissued")
    before = len(enrolments.history(record["enrollment_id"]))

    first = expect(callbacks.send(body, bank_now()), 200, CallbackAck)
    second = expect(callbacks.send(body, bank_now()), 200, CallbackAck)

    assert first.result == "APPLIED"
    assert second.result == "DUPLICATE"
    assert enrolments.record(record["card_id"])["token_ref"] == "tok_reissued"
    assert len(enrolments.history(record["enrollment_id"])) == before + 1, "one change recorded"


def test_an_older_operator_version_is_ignored_as_stale(enrolled, callbacks, bank_now):
    someone, record = enrolled
    body = callback(record, "REMOVED", record["operator_version"] - 1)

    ack = expect(callbacks.send(body, bank_now()), 200, CallbackAck)

    assert (ack.result, ack.status) == ("STALE", "ENROLLED")
    assert wallet_card(someone, record["card_id"]).enrollment.status == "ENROLLED"


def test_a_status_the_bank_did_not_ask_for_is_ignored(enrolled, callbacks, bank_now):
    # Nothing asked for a suspension, so a SUSPENDED callback does not apply.
    someone, record = enrolled
    body = callback(record, "SUSPENDED", record["operator_version"] + 1)

    ack = expect(callbacks.send(body, bank_now()), 200, CallbackAck)

    assert (ack.result, ack.status) == ("SUPERSEDED", "ENROLLED")


def test_a_callback_for_a_removed_enrolment_is_ignored(enrolled, callbacks, bank_now):
    someone, record = enrolled
    expect(someone.wallet.remove(record["card_id"]), 200, WalletCard)
    body = callback(record, "ENROLLED", record["operator_version"] + 5)

    ack = expect(callbacks.send(body, bank_now()), 200, CallbackAck)

    assert (ack.result, ack.status) == ("IGNORED_REMOVED", "REMOVED")
