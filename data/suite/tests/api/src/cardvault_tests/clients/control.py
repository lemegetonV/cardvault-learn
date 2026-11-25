"""The ``/test/*`` controls (TEST_MODE only, behind ``X-Test-Key``).

They are the suite's levers on the environment: reset and seed, move the shared clock,
inject faults, ask whether anything is still in flight, and create fresh customers. They
exist only because CardVault is built for testing; a real bank would not expose them.
"""

from __future__ import annotations

from typing import Any

import httpx

from cardvault_tests.auth import TestKeyAuth


class ServiceControl:
    """The controls every service and mock shares."""

    def __init__(self, name: str, http: httpx.Client, test_key: str) -> None:
        self.name = name
        self.http = http
        self.auth = TestKeyAuth(test_key)

    def ready(self) -> httpx.Response:
        return self.http.get("/ready")

    def reset(self) -> httpx.Response:
        return self.http.post("/test/reset", auth=self.auth)

    def seed(self) -> httpx.Response:
        return self.http.post("/test/seed", auth=self.auth)

    def clock(self) -> httpx.Response:
        return self.http.get("/test/clock", auth=self.auth)

    def set_clock(self, **one_of: Any) -> httpx.Response:
        """Exactly one of offset_seconds, advance_seconds, now (ISO string) or reset=True."""
        return self.http.post("/test/clock", json=one_of, auth=self.auth)

    def faults(self) -> httpx.Response:
        return self.http.get("/test/faults", auth=self.auth)

    def set_faults(self, faults: list[dict[str, Any]]) -> httpx.Response:
        return self.http.post("/test/faults", json={"faults": faults}, auth=self.auth)

    def quiet(self) -> httpx.Response:
        return self.http.get("/test/quiet", auth=self.auth)


class EnrollmentControl(ServiceControl):
    """enrollment-service also orchestrates new test customers across every service."""

    def create_customer(self, template: dict[str, Any]) -> httpx.Response:
        return self.http.post("/test/customers", json=template, auth=self.auth)
