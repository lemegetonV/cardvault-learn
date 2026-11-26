"""Database checks: facts the API does not show.

Almost every test checks through the API, because the API is what customers and other
services use. These few look inside a service's database (read-only) for things the API
cannot show: how secrets are stored, and that a refused change really wrote nothing.
"""

import pytest

from api.cards_api import CardsApi
from api.profile_api import ProfileApi
from database import query_one
from helpers import create_logged_in_customer

# Every test in this file needs access to the databases, so label them all at once.
pytestmark = pytest.mark.database


def test_reporting_a_card_lost_is_saved_in_the_database(customer):
    card_id = customer["new_card"]["card_id"]

    CardsApi(customer["token"]).report_lost(card_id)

    row = query_one("card", "SELECT status FROM cards WHERE card_id = %s", (card_id,))
    assert row["status"] == "LOST"


def test_passwords_are_stored_as_hashes_not_as_plain_text():
    someone = create_logged_in_customer(cards=[])

    row = query_one(
        "auth", "SELECT password_hash FROM users WHERE username = %s", (someone["username"],)
    )

    assert someone["password"] not in row["password_hash"]
    # scrypt is a slow, salted hashing method made for passwords.
    assert row["password_hash"].startswith("scrypt$")


def test_card_numbers_are_stored_encrypted(customer):
    card_id = customer["wallet_card"]["card_id"]

    row = query_one("card", "SELECT pan_encrypted FROM cards WHERE card_id = %s", (card_id,))

    # A card number in plain text would be 16 digits. Encrypted, it is not digits at all.
    assert not row["pan_encrypted"].isdigit()
    assert len(row["pan_encrypted"]) > 16


def test_a_refused_profile_update_writes_nothing():
    someone = create_logged_in_customer(cards=[])
    profile_api = ProfileApi(someone["token"])
    profile = profile_api.get_profile().json()

    response = profile_api.update_profile(
        {"email": "never-saved@example.com"}, version=profile["version"] + 5
    )

    assert response.status_code == 412
    row = query_one(
        "profile",
        "SELECT email, version FROM profiles WHERE customer_id = %s",
        (profile["customer_id"],),
    )
    assert row["email"] == profile["email"]
    assert row["version"] == profile["version"]
