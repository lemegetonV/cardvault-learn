"""Logging in: the Login service (auth-service)."""

import pytest

import config
from api.auth_api import AuthApi
from api.cards_api import CardsApi
from data.demo_customers import ALICE
from helpers import create_logged_in_customer


@pytest.mark.smoke
def test_login_with_correct_password_returns_a_token():
    response = AuthApi().login("alice", config.DEMO_PASSWORD)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "Bearer"
    assert body["access_token"] != ""


def test_login_with_wrong_password_is_refused():
    # A new customer: wrong passwords count towards a lockout, so never use a shared account.
    someone = create_logged_in_customer(cards=[])

    response = AuthApi().login(someone["username"], "not-the-password")

    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"


def test_unknown_user_gets_the_same_error_as_a_wrong_password():
    # The app must not reveal which usernames exist.
    response = AuthApi().login("nobody-has-this-name", "not-the-password")

    assert response.status_code == 401
    assert response.json()["error_code"] == "INVALID_CREDENTIALS"


@pytest.mark.parametrize(
    "username, password",
    [
        ("", config.DEMO_PASSWORD),
        ("alice", ""),
    ],
)
def test_login_with_an_empty_field_is_refused(username, password):
    response = AuthApi().login(username, password)

    # 422: the request itself is invalid, so the password is never even checked.
    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_me_tells_who_is_logged_in(alice_token):
    response = AuthApi().me(alice_token)

    assert response.status_code == 200
    assert response.json()["username"] == ALICE["username"]
    assert response.json()["display_name"] == ALICE["display_name"]


def test_a_request_without_a_token_is_refused():
    response = CardsApi(token="").list_cards()

    assert response.status_code == 401


def test_a_made_up_token_is_refused():
    response = CardsApi(token="made-up-token").list_cards()

    assert response.status_code == 401


def test_account_locks_after_five_wrong_passwords():
    # A new customer, so locking them out does not affect any other test.
    someone = create_logged_in_customer(cards=[])

    for attempt in range(5):
        AuthApi().login(someone["username"], "wrong-password")

    # Locked: even the correct password is refused now.
    response = AuthApi().login(someone["username"], someone["password"])
    assert response.status_code == 423
    assert response.json()["error_code"] == "ACCOUNT_LOCKED"
