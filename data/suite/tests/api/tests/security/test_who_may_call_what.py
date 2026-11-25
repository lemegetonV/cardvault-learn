"""Who may call what (spec 16.6 rules 37, 40 and 41, and errors.md).

CardVault has three kinds of caller, each with its own proof:

    customer endpoints  /v1/...           a bearer token from auth-service
    internal endpoints  /internal/v1/...  an X-Service-Key, one per calling system
    test endpoints      /test/...         the X-Test-Key (TEST_MODE only)

A proof for one kind must never open another kind's door: a customer token on an internal
endpoint, or a service key on a customer endpoint, is 401. ENDPOINTS lists every route;
the last test compares it with each service's OpenAPI document, so a route added later
without a row here fails the suite until someone decides how it is protected.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.auth import BearerAuth, ServiceKeyAuth
from cardvault_tests.checks import expect_error, expect_status

ANY = str(uuid.uuid4())  # an ID nobody owns: authentication is checked before the lookup

# service, method, path, who may call it
ENDPOINTS = [
    ("auth", "GET", "/v1/auth/me", "customer"),
    ("card", "GET", "/v1/cards", "customer"),
    ("card", "GET", f"/v1/cards/{ANY}", "customer"),
    ("card", "POST", f"/v1/cards/{ANY}/report-lost", "customer"),
    ("card", "POST", f"/v1/cards/{ANY}/reissue", "customer"),
    ("card", "POST", f"/v1/cards/{ANY}/close", "customer"),
    ("card", "POST", "/internal/v1/authorizations", "service"),
    ("card", "POST", "/internal/v1/clearing", "service"),
    ("profile", "GET", "/v1/profile", "customer"),
    ("profile", "PATCH", "/v1/profile", "customer"),
    ("profile", "POST", "/v1/profile/verify/send", "customer"),
    ("profile", "POST", "/v1/profile/verify", "customer"),
    ("enrollment", "GET", "/v1/wallet", "customer"),
    ("enrollment", "GET", f"/v1/wallet/cards/{ANY}", "customer"),
    ("enrollment", "POST", f"/v1/wallet/cards/{ANY}", "customer"),
    ("enrollment", "DELETE", f"/v1/wallet/cards/{ANY}", "customer"),
    ("enrollment", "POST", "/v1/wallet/opt-out", "customer"),
    ("enrollment", "POST", "/v1/wallet/opt-in", "customer"),
    ("enrollment", "POST", "/internal/v1/reconciliation/runs", "service"),
    ("enrollment", "GET", f"/internal/v1/reconciliation/runs/{ANY}", "service"),
    ("enrollment", "POST", "/internal/v1/sweep", "service"),
    ("wallet_txn", "GET", "/v1/wallet/transactions", "customer"),
    ("wallet_txn", "GET", "/v1/wallet/transactions/export", "customer"),
    ("wallet_txn", "GET", f"/v1/wallet/transactions/{ANY}", "customer"),
    ("wallet_txn", "POST", f"/v1/wallet/transactions/{ANY}/disputes", "customer"),
    ("wallet_txn", "GET", "/v1/wallet/disputes", "customer"),
    ("wallet_txn", "GET", f"/v1/wallet/disputes/{ANY}", "customer"),
]
# Routes with their own protection, tested elsewhere: login, refresh and logout take
# credentials in the body (tests/auth), JWKS is public by design, and the operator callback
# is HMAC-signed (tests/callbacks).
OWN_PROTECTION = {
    ("auth", "POST", "/v1/auth/login"),
    ("auth", "POST", "/v1/auth/refresh"),
    ("auth", "POST", "/v1/auth/logout"),
    ("auth", "GET", "/.well-known/jwks.json"),
    ("enrollment", "POST", "/v1/callbacks/operator"),
}
CUSTOMER = [e for e in ENDPOINTS if e[3] == "customer"]
SERVICE = [e for e in ENDPOINTS if e[3] == "service"]


def call(services, service, method, path, **kwargs):
    return getattr(services, service).request(method, path, **kwargs)


def label(endpoint) -> str:
    return f"{endpoint[1]} {endpoint[2].replace(ANY, '{id}')}"


@pytest.mark.parametrize("endpoint", CUSTOMER, ids=label)
def test_a_customer_endpoint_needs_a_bearer_token(services, endpoint):
    service, method, path, _ = endpoint

    expect_error(call(services, service, method, path), 401, "UNAUTHORIZED")


@pytest.mark.lesson
@pytest.mark.parametrize("endpoint", CUSTOMER, ids=label)
def test_a_customer_endpoint_refuses_a_service_key(services, settings, endpoint):
    service, method, path, _ = endpoint
    key = ServiceKeyAuth(settings.service_key_tests)

    expect_error(call(services, service, method, path, auth=key), 401, "UNAUTHORIZED")


@pytest.mark.parametrize("endpoint", SERVICE, ids=label)
def test_an_internal_endpoint_needs_a_service_key(services, endpoint):
    service, method, path, _ = endpoint

    expect_error(call(services, service, method, path), 401, "SERVICE_KEY_INVALID")


@pytest.mark.lesson
@pytest.mark.parametrize("endpoint", SERVICE, ids=label)
def test_an_internal_endpoint_refuses_a_customer_token(services, alice, endpoint):
    service, method, path, _ = endpoint

    resp = call(services, service, method, path, auth=BearerAuth(alice.tokens.access_token))

    expect_error(resp, 401, "SERVICE_KEY_INVALID")


@pytest.mark.parametrize("endpoint", SERVICE, ids=label)
def test_an_internal_endpoint_refuses_a_wrong_service_key(services, endpoint):
    service, method, path, _ = endpoint

    resp = call(services, service, method, path, auth=ServiceKeyAuth("cv-svc-guess"))

    expect_error(resp, 401, "SERVICE_KEY_INVALID")


@pytest.mark.parametrize("service", ["auth", "card", "profile", "enrollment", "wallet_txn"])
def test_every_route_has_a_decided_protection(services, service):
    spec = expect_status(getattr(services, service).get("/openapi.json"), 200).json()
    published = {
        (service, method.upper(), path)
        for path, ops in spec["paths"].items()
        if not path.startswith("/test/") and path not in ("/health", "/ready")
        for method in ops
    }
    # Turn the concrete paths in ENDPOINTS back into OpenAPI templates to compare.
    templates = {
        "/v1/cards/{id}": "/v1/cards/{card_id}",
        "/v1/wallet/cards/{id}": "/v1/wallet/cards/{card_id}",
        "/v1/wallet/transactions/{id}": "/v1/wallet/transactions/{txn_id}",
        "/v1/wallet/disputes/{id}": "/v1/wallet/disputes/{dispute_id}",
        "/internal/v1/reconciliation/runs/{id}": "/internal/v1/reconciliation/runs/{run_id}",
    }
    known = set(OWN_PROTECTION)
    for svc, method, path, _ in ENDPOINTS:
        generic = path.replace(ANY, "{id}")
        for short, full in templates.items():
            generic = generic.replace(short, full)
        known.add((svc, method, generic))

    assert published - known == set(), "routes with no row in ENDPOINTS"
