"""Root fixtures for every test.

Order of a run:

1. ``pytest_sessionstart`` (controller only): wait for every service's ``/ready``, then
   reset and reseed the environment once.
2. Each test asks for what it needs by name: ``services`` (HTTP clients), ``controls``
   (the /test/* levers), ``make_customer`` (a fresh customer), ``alice`` (the seed customer,
   read-only), ``shared_clock`` (move time, restored afterwards).
3. When a test fails, every request it sent is printed under the failure, each with its
   correlation ID.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from typing import Any

import pytest

from cardvault_tests import environment
from cardvault_tests.auth import ServiceKeyAuth
from cardvault_tests.checks import expect, expect_status
from cardvault_tests.clients.card_network import CardNetworkClient
from cardvault_tests.clients.control import EnrollmentControl, ServiceControl
from cardvault_tests.clients.enrolment import (
    EnrolmentInspector,
    OperatorCallbacks,
    Reconciliation,
)
from cardvault_tests.clients.operator import OperatorControl
from cardvault_tests.customers import Customer, Services, log_in
from cardvault_tests.data import ALICE
from cardvault_tests.db import ReadOnlyDb
from cardvault_tests.events import EventWatch
from cardvault_tests.http import exchanges, make_client
from cardvault_tests.models import ClockView, NewCustomer
from cardvault_tests.settings import Settings, get_settings
from cardvault_tests.waits import wait_until

# ---------------------------------------------------------------- run start


def _controls(settings: Settings, record: bool = True) -> dict[str, ServiceControl]:
    out: dict[str, ServiceControl] = {}
    for name, url in settings.services.items():
        cls = EnrollmentControl if name == "enrollment" else ServiceControl
        http = make_client(url, settings.http_timeout_seconds, record)
        out[name] = cls(name, http, settings.test_key)
    return out


@pytest.hookimpl(tryfirst=True)
def pytest_sessionstart(session: pytest.Session) -> None:
    if hasattr(session.config, "workerinput"):
        return  # an xdist worker: the controller has already prepared the environment
    if session.config.option.collectonly:
        return
    settings = get_settings()
    controls = _controls(settings, record=False)
    environment.wait_until_ready(controls, settings.ready_wait_seconds)
    if settings.reset_at_start:
        environment.reset_and_seed(controls)


def _parallel(config: pytest.Config) -> bool:
    return hasattr(config, "workerinput") or bool(getattr(config.option, "numprocesses", 0))


def pytest_report_header(config: pytest.Config) -> list[str]:
    s = get_settings()
    lines = [f"CardVault environment: {s.test_env} (auth at {s.auth_url})"]
    if _parallel(config):
        lines.append("Parallel run: serial tests are left out; run them with: pytest -m serial")
    return lines


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    # A serial test moves something every service shares (the clock, faults). While it runs,
    # any other test would see that change too, so in a parallel run serial tests are left
    # out, and run afterwards on their own with `pytest -m serial`.
    if not _parallel(config):
        return
    serial = [item for item in items if item.get_closest_marker("serial")]
    if serial:
        config.hook.pytest_deselected(items=serial)
        items[:] = [item for item in items if not item.get_closest_marker("serial")]


# ---------------------------------------------------------------- evidence


@pytest.fixture(autouse=True)
def _exchange_log() -> Iterator[None]:
    exchanges.clear()
    yield


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[None]):
    report = yield
    if report.failed and exchanges.items:
        report.sections.append(("CardVault requests", exchanges.report()))
    return report


# ---------------------------------------------------------------- clients


@pytest.fixture(scope="session")
def settings() -> Settings:
    return get_settings()


@pytest.fixture(scope="session")
def services(settings: Settings) -> Iterator[Services]:
    t = settings.http_timeout_seconds
    s = Services(
        auth=make_client(settings.auth_url, t),
        card=make_client(settings.card_url, t),
        enrollment=make_client(settings.enrollment_url, t),
        wallet_txn=make_client(settings.wallet_txn_url, t),
        profile=make_client(settings.profile_url, t),
        operator=make_client(settings.operator_url, t),
        network=make_client(settings.network_url, t),
    )
    yield s
    for client in vars(s).values():
        client.close()


@pytest.fixture(scope="session")
def controls(settings: Settings) -> dict[str, ServiceControl]:
    return _controls(settings)


@pytest.fixture(scope="session")
def orchestrator(controls: dict[str, ServiceControl]) -> EnrollmentControl:
    control = controls["enrollment"]
    assert isinstance(control, EnrollmentControl)
    return control


@pytest.fixture(scope="session")
def card_network(services: Services, settings: Settings) -> CardNetworkClient:
    """card-service's authorization and clearing API, called as the "tests" service."""
    return CardNetworkClient(services.card, ServiceKeyAuth(settings.service_key_tests))


@pytest.fixture(scope="session")
def enrolments(services: Services, settings: Settings) -> EnrolmentInspector:
    return EnrolmentInspector(services.enrollment, settings.test_key, settings.service_key_tests)


@pytest.fixture(scope="session")
def reconciliation(services: Services, settings: Settings) -> Reconciliation:
    return Reconciliation(services.enrollment, settings.service_key_tests)


@pytest.fixture(scope="session")
def callbacks(services: Services, settings: Settings) -> OperatorCallbacks:
    """Send signed callbacks to the bank as the wallet operator would."""
    return OperatorCallbacks(services.enrollment, settings.operator_hmac_secret)


# ---------------------------------------------------------------- customers


@pytest.fixture
def make_customer(
    services: Services, orchestrator: EnrollmentControl
) -> Callable[[dict[str, Any]], Customer]:
    """Create a fresh customer from a template (see ``data.customer``) and log in."""

    def make(template: dict[str, Any]) -> Customer:
        created = expect(orchestrator.create_customer(template), 201, NewCustomer)
        return log_in(services, created.username, created.password, created.cards)

    return make


@pytest.fixture(scope="session")
def alice(services: Services, settings: Settings) -> Customer:
    """The seed customer alice, logged in. Read-only: never change her data."""
    return log_in(services, ALICE.username, settings.seed_user_password, [])


# ---------------------------------------------------------------- shared state


@pytest.fixture
def shared_clock(controls: dict[str, ServiceControl]) -> Iterator[ServiceControl]:
    """Move CardVault's shared clock in a ``serial`` test; real time is restored afterwards,
    whether the test passed or failed.

    Each service re-reads the clock at most once a second, so the reset is awaited on every
    service. Otherwise the next test could start while one service still runs ahead."""
    control = controls["auth"]
    yield control
    expect_status(control.set_clock(reset=True), 200)
    wait_until(
        lambda: [expect(c.clock(), 200, ClockView).offset_seconds for c in controls.values()],
        lambda offsets: not any(offsets),
        timeout=5,
        what="every service to be back on real time",
    )


@pytest.fixture
def operator(services: Services, settings: Settings) -> Iterator[OperatorControl]:
    """Make the wallet operator mock misbehave in a ``serial`` test; every control is turned
    off again afterwards, whether the test passed or failed."""
    control = OperatorControl(services.operator, settings.test_key)
    yield control
    expect_status(control.behave(), 200)


@pytest.fixture
def operator_records(services: Services, settings: Settings) -> Callable[[object], dict]:
    """Read the operator mock's record of one enrolment: what the outside world holds."""
    control = OperatorControl(services.operator, settings.test_key)

    def record(enrollment_id: object) -> dict:
        records = expect_status(control.state(), 200).json()["records"]
        found = [r for r in records if r["enrollment_id"] == str(enrollment_id)]
        assert found, f"the operator holds no record for enrolment {enrollment_id}"
        return found[0]

    return record


@pytest.fixture
def faults(controls: dict[str, ServiceControl]) -> Iterator[Callable[..., None]]:
    """Inject faults into a service in a ``serial`` test: ``faults("card", {...})``.
    Every service touched is cleared afterwards, whether the test passed or failed."""
    touched: set[str] = set()

    def inject(service: str, *specs: dict[str, Any]) -> None:
        touched.add(service)
        expect_status(controls[service].set_faults(list(specs)), 200)

    yield inject
    for service in touched:
        expect_status(controls[service].set_faults([]), 200)


@pytest.fixture(scope="session")
def operator_state(services: Services, settings: Settings) -> OperatorControl:
    """Change the operator mock's records directly (no controls). Safe in parallel when a
    test only touches records of its own fresh enrolments."""
    return OperatorControl(services.operator, settings.test_key)


@pytest.fixture
def watch(settings: Settings) -> Iterator[Callable[[str], EventWatch]]:
    """Start reading a Kafka topic from its current end: ``events = watch("auth.decided")``.
    Call it before the action, so the event cannot be published before the watch begins."""
    opened: list[EventWatch] = []

    def start(topic: str) -> EventWatch:
        w = EventWatch(settings.kafka_bootstrap, topic)
        opened.append(w)
        return w

    yield start
    for w in opened:
        w.close()


@pytest.fixture(scope="session")
def db(settings: Settings) -> ReadOnlyDb:
    """Read-only SQL against a service's own database (the ``<db>_ro`` role)."""
    return ReadOnlyDb(settings)
