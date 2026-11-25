"""Reconciliation: the bank's enrolment records against the operator's daily file
(spec 6.3, 16.7 rules 43 to 46).

Two systems hold a copy of the same facts, and messages between them can be lost. Once a
day the bank fetches the operator's file and reports every difference:

    MISSING_AT_OPERATOR  the bank has it ENROLLED or SUSPENDED; the operator has no record
    MISSING_IN_SOR       the operator has a record the bank has never heard of
    STATUS_MISMATCH      both have it, with different statuses
    DATA_MISMATCH        same status, but last4 or expiry differ

A run compares every record, so other tests' customers appear in it too. Each test makes
the operator's copy of its own fresh enrolment differ in one way, and looks only at the
findings for that enrolment. Enrolments still waiting for a callback are skipped, because
the two sides are expected to differ until it lands.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.auth import ServiceKeyAuth
from cardvault_tests.checks import expect, expect_error, expect_status
from cardvault_tests.data import card, customer
from cardvault_tests.models import ReconciliationRun, WalletCard


@pytest.fixture
def enrolled(make_customer, enrolments):
    """A fresh customer's ENROLLED card, as the bank records it."""
    someone = make_customer(customer(card(enrolled=True)))
    return enrolments.record(someone.card_ids[0])


def findings_for(run: ReconciliationRun, enrollment_id: object) -> list:
    return [f for f in run.findings if str(f.enrollment_id) == str(enrollment_id)]


def run_now(reconciliation) -> ReconciliationRun:
    run = expect(reconciliation.run(), 201, ReconciliationRun)
    assert run.status == "COMPLETED"
    assert run.finding_count == len(run.findings)
    return run


def test_matching_records_give_no_finding(enrolled, reconciliation):
    run = run_now(reconciliation)

    assert findings_for(run, enrolled["enrollment_id"]) == []


def test_a_record_the_operator_lost_is_missing_at_operator(
    enrolled, reconciliation, operator_state
):
    expect_status(operator_state.change_state(delete=[enrolled["enrollment_id"]]), 200)

    [finding] = findings_for(run_now(reconciliation), enrolled["enrollment_id"])

    assert (finding.type, finding.sor_status, finding.operator_status) == (
        "MISSING_AT_OPERATOR",
        "ENROLLED",
        None,
    )
    assert str(finding.card_id) == enrolled["card_id"]


def test_a_record_only_the_operator_has_is_missing_in_sor(enrolled, reconciliation, operator_state):
    stranger = str(uuid.uuid4())
    expect_status(
        operator_state.change_state(
            upsert=[
                {
                    "enrollment_id": stranger,
                    "card_id": str(uuid.uuid4()),
                    "status": "ENROLLED",
                    "last4": "0000",
                    "expiry": "2030-01",
                }
            ]
        ),
        200,
    )

    [finding] = findings_for(run_now(reconciliation), stranger)

    assert (finding.type, finding.sor_status, finding.operator_status) == (
        "MISSING_IN_SOR",
        None,
        "ENROLLED",
    )


def test_a_different_status_is_a_status_mismatch(enrolled, reconciliation, operator_state):
    upsert = [{"enrollment_id": enrolled["enrollment_id"], "status": "SUSPENDED"}]
    expect_status(operator_state.change_state(upsert=upsert), 200)

    [finding] = findings_for(run_now(reconciliation), enrolled["enrollment_id"])

    assert (finding.type, finding.sor_status, finding.operator_status) == (
        "STATUS_MISMATCH",
        "ENROLLED",
        "SUSPENDED",
    )


def test_a_different_last4_and_expiry_is_a_data_mismatch(enrolled, reconciliation, operator_state):
    upsert = [{"enrollment_id": enrolled["enrollment_id"], "last4": "9999", "expiry": "2031-12"}]
    expect_status(operator_state.change_state(upsert=upsert), 200)

    [finding] = findings_for(run_now(reconciliation), enrolled["enrollment_id"])

    assert finding.type == "DATA_MISMATCH"
    assert finding.details == {
        "last4": {"sor": enrolled["last4"], "operator": "9999"},
        "expiry": {"sor": enrolled["expiry"], "operator": "2031-12"},
    }


def test_an_enrolment_waiting_for_its_callback_is_skipped(make_customer, reconciliation):
    # The operator answers about 2 seconds after the request, so straight after the add the
    # card is still PENDING: the two sides differ, and that is expected.
    someone = make_customer(customer(card()))
    added = expect(someone.wallet.add(someone.card_ids[0]), 202, WalletCard)

    run = run_now(reconciliation)

    assert findings_for(run, added.enrollment.enrollment_id) == []
    assert run.skipped_in_flight >= 1


def test_a_run_is_stored_and_read_back(enrolled, reconciliation, operator_state):
    expect_status(operator_state.change_state(delete=[enrolled["enrollment_id"]]), 200)
    run = run_now(reconciliation)

    assert expect(reconciliation.get(run.run_id), 200, ReconciliationRun) == run


def test_an_unknown_run_is_not_found(reconciliation):
    expect_error(reconciliation.get(uuid.uuid4()), 404, "RUN_NOT_FOUND")


def test_only_the_tests_service_may_start_a_run(reconciliation):
    expect_error(reconciliation.run(auth=ServiceKeyAuth("not-a-key")), 401, "SERVICE_KEY_INVALID")


@pytest.mark.serial
def test_an_unreachable_operator_file_fails_the_run(reconciliation, faults):
    faults("wallet-operator-mock", {"type": "error", "scope": {"path": "/v1/files/*"}})

    error = expect_error(reconciliation.run(), 502, "OPERATOR_FILE_UNAVAILABLE")

    run = expect(reconciliation.get(error.details["run_id"]), 200, ReconciliationRun)
    assert (run.status, run.findings) == ("FAILED", [])
