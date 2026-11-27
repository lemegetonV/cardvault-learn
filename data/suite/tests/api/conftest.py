"""Fixtures: set-up code that pytest runs for a test when the test asks for it by name.

A test asks for a fixture by naming it as a parameter, for example:

    def test_something(alice_token):
        ...

pytest finds the fixture with that name here, runs it, and passes in what it returns.
"""

import pytest

import config
from api.auth_api import AuthApi
from helpers import create_logged_in_customer


@pytest.fixture(scope="session")
def alice_token():
    """Log in as alice once for the whole run, and share her token.

    scope="session" means this runs only once, however many tests use it.
    Tests that use alice only read her data.
    """
    response = AuthApi().login("alice", config.DEMO_PASSWORD)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def alice_session():
    """A new login for alice that is logged out again after the test.

    Everything before "yield" is set-up. The test runs at the "yield" and gets the
    login response. Everything after it is clean-up, and pytest runs it even when
    the test fails, so no session is left behind.
    """
    login = AuthApi().login("alice", config.DEMO_PASSWORD)
    assert login.status_code == 200, login.text
    session = login.json()

    yield session

    AuthApi().logout(session["refresh_token"])


@pytest.fixture
def customer():
    """A brand-new customer for one test, logged in.

    They have two cards:
      - a CREDIT card that is already in the wallet ("wallet_card")
      - a DEBIT card that may join the wallet but has not yet ("new_card")

    With no scope given, this runs again for every test that asks for it,
    so each test gets its own customer and can change anything it likes.
    """
    created = create_logged_in_customer(
        cards=[
            {"product": "CREDIT", "enrolled": True},
            {"product": "DEBIT"},
        ]
    )
    return {
        "token": created["token"],
        "wallet_card": created["cards"][0],
        "new_card": created["cards"][1],
    }
