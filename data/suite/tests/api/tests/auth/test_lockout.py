"""Five failed logins lock a username for 15 minutes (spec 6.1, 16.6 rule 39).

The counter is per username, so each test uses its own fresh customer (or a made-up
username) and never locks out anyone another test needs.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_error, expect_status
from cardvault_tests.clients.auth import AuthClient
from cardvault_tests.data import customer
from cardvault_tests.models import Tokens


@pytest.fixture
def auth(services) -> AuthClient:
    return AuthClient(services.auth)


def fail_logins(auth: AuthClient, username: str, times: int) -> None:
    for _ in range(times):
        expect_error(auth.login(username, "wrong-password"), 401, "INVALID_CREDENTIALS")


def test_fifth_failure_locks_even_the_right_password_out(auth, make_customer):
    someone = make_customer(customer())
    fail_logins(auth, someone.username, 5)

    error = expect_error(auth.login(someone.username, someone.password), 423, "ACCOUNT_LOCKED")
    assert "locked_until" in error.details


def test_four_failures_do_not_lock(auth, make_customer):
    someone = make_customer(customer())
    fail_logins(auth, someone.username, 4)

    expect(auth.login(someone.username, someone.password), 200, Tokens)


def test_a_successful_login_resets_the_count(auth, make_customer):
    someone = make_customer(customer())
    fail_logins(auth, someone.username, 4)
    expect(auth.login(someone.username, someone.password), 200, Tokens)
    fail_logins(auth, someone.username, 4)

    # 8 failures in total, but never 5 in a row: still not locked.
    expect(auth.login(someone.username, someone.password), 200, Tokens)


def test_unknown_usernames_lock_too(auth):
    # Counting unknown names as well means a lockout does not reveal which names exist.
    made_up = f"nobody-{uuid.uuid4().hex[:8]}"
    fail_logins(auth, made_up, 5)

    expect_error(auth.login(made_up, "anything"), 423, "ACCOUNT_LOCKED")


@pytest.mark.serial
def test_lock_lifts_after_15_minutes(auth, make_customer, shared_clock):
    someone = make_customer(customer())
    fail_logins(auth, someone.username, 5)

    expect_status(shared_clock.set_clock(advance_seconds=14 * 60 + 50), 200)
    expect_error(auth.login(someone.username, someone.password), 423, "ACCOUNT_LOCKED")

    expect_status(shared_clock.set_clock(advance_seconds=20), 200)
    expect(auth.login(someone.username, someone.password), 200, Tokens)
