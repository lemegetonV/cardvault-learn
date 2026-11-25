"""When the wallet operator misbehaves (spec 16.2 rules 6, 9 and 13, 16.6).

The bank cannot fix the operator, only cope with it:

* a decline ends the enrolment FAILED with the operator's reason;
* a 5xx or timeout is retried with backoff, up to 5 attempts, then the enrolment is FAILED
  with OPERATOR_UNAVAILABLE;
* a callback sent twice, or an older callback arriving after a newer one, changes nothing.

The operator's controls are shared by every test, so these tests are ``serial``. The
``operator`` fixture turns the controls off afterwards, pass or fail.
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect, expect_status
from cardvault_tests.data import card, customer
from cardvault_tests.models import Card, WalletCard
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wait_for_enrolment

pytestmark = pytest.mark.serial

ENROL = {"method": "POST", "path": "/v1/enrollments"}


def test_a_declined_enrolment_ends_failed_with_the_operators_reason(make_customer, operator):
    expect_status(
        operator.behave({"type": "decline_enrollment", "reason": "RISK_CHECK", "fail_next": 1}),
        200,
    )
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)

    failed = wait_for_enrolment(someone, card_id, "FAILED")
    assert failed.enrollment.status_reason == "RISK_CHECK"


def test_a_short_outage_is_retried_and_the_card_still_enrols(make_customer, operator):
    expect_status(operator.behave({"type": "error", "fail_next": 2, "scope": ENROL}), 200)
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)

    wait_for_enrolment(someone, card_id, "ENROLLED")


@pytest.mark.slow
def test_a_long_outage_ends_failed_after_five_attempts(make_customer, operator):
    expect_status(operator.behave({"type": "error", "status": 503, "scope": ENROL}), 200)
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)

    failed = wait_for_enrolment(someone, card_id, "FAILED", timeout=30)
    assert failed.enrollment.status_reason == "OPERATOR_UNAVAILABLE"


def test_a_repeated_callback_is_applied_once(make_customer, operator, enrolments):
    expect_status(operator.behave({"type": "duplicate_callback", "fail_next": 1}), 200)
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)
    enrolment_id = wait_for_enrolment(someone, card_id, "ENROLLED").enrollment.enrollment_id
    sent = wait_until(
        lambda: operator.sent_callbacks(enrolment_id),
        lambda cbs: len(cbs) == 2,
        what="the operator to send the callback twice",
    )

    assert sent[0]["event_id"] == sent[1]["event_id"], "a redelivery keeps its event_id"
    assert [c["delivery"] for c in sent] == [200, 200], "both are acknowledged"
    changes = [h for h in enrolments.history(enrolment_id) if h["source"] == "CALLBACK"]
    assert [(h["from_status"], h["to_status"]) for h in changes] == [("PENDING", "ENROLLED")]


def test_an_older_callback_after_a_newer_one_is_ignored(make_customer, operator):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]
    expect(someone.wallet.add(card_id), 202, WalletCard)
    enrolment_id = wait_for_enrolment(someone, card_id, "ENROLLED").enrollment.enrollment_id
    # From now on the operator follows each callback with a replay of the one before it.
    expect_status(operator.behave({"type": "out_of_order_callback", "fail_next": 1}), 200)

    expect(someone.cards.report_lost(card_id), 200, Card)

    sent = wait_until(
        lambda: operator.sent_callbacks(enrolment_id),
        lambda cbs: len(cbs) == 3 and all(c["delivery"] == 200 for c in cbs),
        what="the SUSPENDED callback and the replayed ENROLLED one to be delivered",
    )
    assert [c["status"] for c in sent] == ["ENROLLED", "SUSPENDED", "ENROLLED"]
    after = wait_for_enrolment(someone, card_id, "SUSPENDED")
    assert after.enrollment.status_reason == "CARD_LOST"
