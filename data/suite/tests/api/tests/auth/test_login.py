"""Logging in: who gets tokens, and what a failed login reveals (spec 6.1, 16.6 rule 39)."""

from __future__ import annotations

import pytest

from cardvault_tests.auth import BearerAuth
from cardvault_tests.checks import expect, expect_error
from cardvault_tests.clients.auth import AuthClient
from cardvault_tests.data import ALICE
from cardvault_tests.models import Me, Tokens


@pytest.fixture
def auth(services) -> AuthClient:
    return AuthClient(services.auth)


@pytest.mark.smoke
def test_seed_customer_logs_in_and_is_recognised(auth, settings):
    tokens = expect(auth.login(ALICE.username, settings.seed_user_password), 200, Tokens)

    # Lifetimes are the spec's: a 15-minute access token, a 7-day refresh token.
    assert tokens.expires_in == 15 * 60
    assert tokens.refresh_expires_in == 7 * 24 * 60 * 60
    assert tokens.customer_id == ALICE.customer_id

    me = expect(auth.me(BearerAuth(tokens.access_token)), 200, Me)
    assert (me.customer_id, me.username, me.display_name) == (
        ALICE.customer_id,
        ALICE.username,
        ALICE.display_name,
    )


def test_username_is_matched_without_case_or_surrounding_spaces(auth, settings):
    tokens = expect(auth.login("  ALICE ", settings.seed_user_password), 200, Tokens)

    assert tokens.customer_id == ALICE.customer_id


def test_wrong_password_and_unknown_user_look_the_same(auth):
    wrong_password = expect_error(
        auth.login(ALICE.username, "not-her-password"), 401, "INVALID_CREDENTIALS"
    )
    unknown_user = expect_error(
        auth.login("nobody-by-this-name", "whatever"), 401, "INVALID_CREDENTIALS"
    )

    # Same code and same message: a caller cannot use login to find out which usernames exist.
    assert wrong_password.message == unknown_user.message


@pytest.mark.parametrize(
    "body",
    [{}, {"username": "alice"}, {"password": "x"}, {"username": "", "password": "x"}],
    ids=["empty", "no-password", "no-username", "blank-username"],
)
def test_incomplete_login_is_a_validation_error(services, body):
    resp = services.auth.post("/v1/auth/login", json=body)

    error = expect_error(resp, 422, "VALIDATION_ERROR")
    assert error.details, "a validation error says which field is wrong"


def test_validation_error_never_echoes_the_password(services):
    resp = services.auth.post(
        "/v1/auth/login", json={"username": "x" * 65, "password": "s3cret-Do-Not-Echo"}
    )

    expect_error(resp, 422, "VALIDATION_ERROR")
    assert "s3cret-Do-Not-Echo" not in resp.text
