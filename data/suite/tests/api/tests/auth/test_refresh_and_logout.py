"""Refresh tokens rotate, a reused one ends the session, logout revokes it
(spec 16.6 rules 37 and 38).

Each test works on its own fresh customer, because these flows revoke tokens.
"""

from __future__ import annotations

import pytest

from cardvault_tests.auth import BearerAuth
from cardvault_tests.checks import expect, expect_error, expect_status
from cardvault_tests.clients.auth import AuthClient
from cardvault_tests.data import customer
from cardvault_tests.models import Me, Tokens


@pytest.fixture
def someone(make_customer):
    return make_customer(customer())


def test_refresh_returns_a_new_pair_for_the_same_customer(someone):
    fresh = expect(someone.auth.refresh(someone.tokens.refresh_token), 200, Tokens)

    assert fresh.customer_id == someone.customer_id
    assert fresh.refresh_token != someone.tokens.refresh_token
    assert fresh.access_token != someone.tokens.access_token
    expect(someone.auth.me(BearerAuth(fresh.access_token)), 200, Me)


def test_reusing_a_refresh_token_revokes_the_whole_family(someone):
    first = someone.tokens.refresh_token
    second = expect(someone.auth.refresh(first), 200, Tokens).refresh_token

    # Someone replays the old token (as a thief would): the session is ended for everyone.
    expect_error(someone.auth.refresh(first), 401, "REFRESH_TOKEN_REUSED")
    expect_error(someone.auth.refresh(second), 401, "REFRESH_TOKEN_INVALID")


def test_unknown_refresh_token_is_invalid(services):
    expect_error(
        AuthClient(services.auth).refresh("rt_not-a-real-token"), 401, "REFRESH_TOKEN_INVALID"
    )


def test_logout_revokes_the_refresh_token(someone):
    expect_status(someone.auth.logout(someone.tokens.refresh_token), 204)

    expect_error(someone.auth.refresh(someone.tokens.refresh_token), 401, "REFRESH_TOKEN_INVALID")


def test_access_token_still_works_after_logout_until_it_expires(someone):
    # A documented limitation: access tokens are not looked up on each call, so logout can
    # only stop refreshes. The token dies at its 15-minute expiry.
    expect_status(someone.auth.logout(someone.tokens.refresh_token), 204)

    expect(someone.auth.me(), 200, Me)


def test_logout_with_an_unknown_token_still_says_204(someone):
    # Always 204, so logout cannot be used to test whether a token exists.
    expect_status(someone.auth.logout("rt_never-issued"), 204)


@pytest.mark.serial
def test_refresh_token_expires_after_7_days(someone, shared_clock):
    expect_status(shared_clock.set_clock(advance_seconds=7 * 24 * 3600 + 1), 200)

    expect_error(someone.auth.refresh(someone.tokens.refresh_token), 401, "REFRESH_TOKEN_EXPIRED")
