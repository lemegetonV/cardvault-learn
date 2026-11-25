"""The wallet operator mock's controls. The operator is outside the bank, so the suite
cannot change it the way it changes the bank; these controls make it misbehave on purpose
(fail, decline, repeat or reorder callbacks) or disagree with the bank's records."""

from __future__ import annotations

from typing import Any

import httpx

from cardvault_tests.auth import TestKeyAuth


class OperatorControl:
    def __init__(self, http: httpx.Client, test_key: str) -> None:
        self.http = http
        self.auth = TestKeyAuth(test_key)

    def behave(self, *controls: dict[str, Any]) -> httpx.Response:
        """Replace every control; no arguments turns them all off."""
        return self.http.post("/test/behaviour", json={"controls": list(controls)}, auth=self.auth)

    def state(self) -> httpx.Response:
        return self.http.get("/test/state", auth=self.auth)

    def change_state(
        self, upsert: list[dict[str, Any]] | None = None, delete: list[str] | None = None
    ) -> httpx.Response:
        return self.http.post(
            "/test/state", json={"upsert": upsert or [], "delete": delete or []}, auth=self.auth
        )

    def sent_callbacks(self, enrollment_id: object) -> list[dict[str, Any]]:
        """The callbacks the operator has sent for one enrolment, oldest first, each with
        ``delivery``: the bank's HTTP status (or DROPPED)."""
        resp = self.state()
        assert resp.status_code == 200, resp.text
        return [c for c in resp.json()["callbacks"] if c["enrollment_id"] == str(enrollment_id)]
