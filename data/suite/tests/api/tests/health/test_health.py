"""Is every service up, connected to what it needs, and describing its API?

These are the first tests to run against any environment: when one fails, nothing else
can be trusted, so they carry the ``smoke`` marker (``pytest -m smoke``).
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect_status
from cardvault_tests.settings import get_settings

SERVICES = list(get_settings().services.items())
BANK_SERVICES = ["auth", "card", "enrollment", "wallet-txn", "profile"]


@pytest.mark.smoke
@pytest.mark.parametrize(("name", "url"), SERVICES, ids=[n for n, _ in SERVICES])
def test_health_reports_the_service_by_name(controls, name, url):
    body = expect_status(controls[name].http.get("/health"), 200).json()

    assert body == {"status": "ok", "service": name}


@pytest.mark.smoke
@pytest.mark.parametrize(("name", "url"), SERVICES, ids=[n for n, _ in SERVICES])
def test_ready_means_every_dependency_answers(controls, name, url):
    body = expect_status(controls[name].ready(), 200).json()

    assert body["status"] == "ready"
    # Mocks keep state in memory, so they may have no checks at all; a check that exists
    # must say "ok".
    assert all(value == "ok" for value in body["checks"].values()), body["checks"]


@pytest.mark.parametrize("name", BANK_SERVICES)
def test_bank_services_check_database_and_kafka_where_used(controls, name):
    checks = expect_status(controls[name].ready(), 200).json()["checks"]

    assert "database" in checks
    if name != "auth":
        # auth-service publishes no events; every other bank service uses Kafka.
        assert "kafka" in checks


@pytest.mark.parametrize(("name", "url"), SERVICES, ids=[n for n, _ in SERVICES])
def test_openapi_document_is_published(controls, name, url):
    doc = expect_status(controls[name].http.get("/openapi.json"), 200).json()

    assert doc["openapi"].startswith("3.")
    assert doc["paths"], "the document lists no paths"
