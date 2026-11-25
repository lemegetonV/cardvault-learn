"""What the services must never expose (spec 16.6 rules 37 and 41, 6.2).

* No browser may call a service directly: only the web app's server (the BFF) does, so no
  service answers a cross-origin request with CORS permission.
* A card number (PAN) never leaves card-service: customers see last4 only.
* An error says what went wrong in CardVault's own shape, never with a stack trace.
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect_error, expect_status, pan_like

SERVICES = ["auth", "card", "profile", "enrollment", "wallet_txn"]


@pytest.mark.parametrize("service", SERVICES)
def test_no_service_grants_cors_to_a_browser(services, service):
    preflight = getattr(services, service).options(
        "/v1/anything",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    allowed = {k.lower() for k in preflight.headers if k.lower().startswith("access-control-")}
    assert allowed == set(), f"CORS headers sent: {allowed}"


@pytest.mark.parametrize(
    ("service", "path"),
    [
        ("card", "/v1/cards"),
        ("enrollment", "/v1/wallet"),
        ("wallet_txn", "/v1/wallet/transactions?limit=100"),
        ("wallet_txn", "/v1/wallet/transactions/export"),
        ("auth", "/v1/auth/me"),
    ],
)
def test_no_customer_response_carries_a_card_number(services, alice, service, path):
    resp = expect_status(getattr(services, service).get(path, auth=alice.bearer), 200)

    assert pan_like(resp.text) == []


@pytest.mark.parametrize("service", SERVICES)
def test_an_unknown_route_is_a_plain_404(services, service):
    error = expect_error(getattr(services, service).get("/v1/no-such-thing"), 404, "NOT_FOUND")

    assert "Traceback" not in error.message


def test_a_malformed_json_body_is_a_validation_error_not_a_crash(services):
    resp = services.auth.post(
        "/v1/auth/login", content=b'{"username": ', headers={"Content-Type": "application/json"}
    )

    error = expect_error(resp, 422, "VALIDATION_ERROR")
    assert "Traceback" not in resp.text
    assert error.message
