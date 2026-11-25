"""Small helpers that several test files use."""

import time

from api.auth_api import AuthApi
from api.customers_api import CustomersApi


def create_logged_in_customer(cards, email_verified=True, phone_verified=True):
    """Create a brand-new customer, log them in, and return what tests need.

    Returns a dictionary with the customer's "username", "password", "token"
    and "cards" (a list, in the same order as the cards asked for).
    """
    response = CustomersApi().create_customer(cards, email_verified, phone_verified)
    assert response.status_code == 201, response.text
    customer = response.json()

    login = AuthApi().login(customer["username"], customer["password"])
    assert login.status_code == 200, login.text

    return {
        "username": customer["username"],
        "password": customer["password"],
        "token": login.json()["access_token"],
        "cards": customer["cards"],
    }


def wait_for_wallet_status(wallet_api, card_id, expected_status, timeout=10):
    """Some changes finish a moment after the response, for example when the
    wallet company confirms a new card. Ask again every half second until the
    card's wallet status is the expected one, or fail after `timeout` seconds.
    """
    deadline = time.time() + timeout
    status = None
    while time.time() < deadline:
        response = wallet_api.get_card(card_id)
        status = response.json()["enrollment"]["status"]
        if status == expected_status:
            return
        time.sleep(0.5)
    raise AssertionError(
        f"Wallet status was {status}, expected {expected_status} within {timeout}s"
    )


def wait_for_transactions(transactions_api, count, status=None, timeout=10):
    """Wait until the customer has at least `count` transactions, then return them.
    With `status`, count only transactions with that status (for example "SETTLED").

    A purchase reaches the transactions list a moment after it is approved,
    because the Transactions service hears about it through an event.
    """
    deadline = time.time() + timeout
    items = []
    while time.time() < deadline:
        items = transactions_api.list_transactions(status=status).json()["items"]
        if len(items) >= count:
            return items
        time.sleep(0.5)
    raise AssertionError(f"Found {len(items)} transactions, expected {count} within {timeout}s")
