"""enrollment-service seen from behind the customer API.

* ``EnrolmentInspector``: test-support reads of the enrolment records (``token_ref`` is
  only visible here) and their audit trail, plus the eligibility sweep.
* ``OperatorCallbacks``: sending callbacks to the bank as if the suite were the operator.
"""

from __future__ import annotations

from typing import Any

import httpx

from cardvault_tests.auth import ServiceKeyAuth, TestKeyAuth
from cardvault_tests.signing import signed_request


class EnrolmentInspector:
    def __init__(self, http: httpx.Client, test_key: str, service_key: str) -> None:
        self.http = http
        self.test_auth = TestKeyAuth(test_key)
        self.service_auth = ServiceKeyAuth(service_key)

    def records(self, card_id: object) -> httpx.Response:
        return self.http.get(
            "/test/enrollments", params={"card_id": str(card_id)}, auth=self.test_auth
        )

    def record(self, card_id: object) -> dict[str, Any]:
        rows = self.records(card_id).json()
        assert len(rows) == 1, f"expected one enrolment row for card {card_id}, got {rows}"
        return rows[0]

    def history(self, enrollment_id: object) -> list[dict[str, Any]]:
        resp = self.http.get(f"/test/enrollments/{enrollment_id}/history", auth=self.test_auth)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def sweep(self) -> httpx.Response:
        return self.http.post("/internal/v1/sweep", auth=self.service_auth)


class OperatorCallbacks:
    def __init__(self, http: httpx.Client, secret: str) -> None:
        self.http = http
        self.secret = secret

    def send(
        self,
        payload: dict[str, Any],
        timestamp: int,
        *,
        secret: str | None = None,
        tamper: bool = False,
    ) -> httpx.Response:
        """Sign ``payload`` and post it. ``tamper=True`` changes the body after signing."""
        body, headers = signed_request(secret or self.secret, payload, timestamp)
        if tamper:
            body = body.replace(b'"status":"', b'"status": "', 1)
        return self.http.post("/v1/callbacks/operator", content=body, headers=headers)

    def send_unsigned(self, payload: dict[str, Any]) -> httpx.Response:
        return self.http.post("/v1/callbacks/operator", json=payload)


class Reconciliation:
    """enrollment-service's reconciliation runs: the bank's enrolment records (the system of
    record, SOR) compared with the operator's daily file. Called with the tests service key."""

    def __init__(self, http: httpx.Client, service_key: str) -> None:
        self.http = http
        self.auth = ServiceKeyAuth(service_key)

    def run(self, file_date: str | None = None, auth: httpx.Auth | None = None) -> httpx.Response:
        body = {"file_date": file_date} if file_date else None
        return self.http.post("/internal/v1/reconciliation/runs", json=body, auth=auth or self.auth)

    def get(self, run_id: object) -> httpx.Response:
        return self.http.get(f"/internal/v1/reconciliation/runs/{run_id}", auth=self.auth)
