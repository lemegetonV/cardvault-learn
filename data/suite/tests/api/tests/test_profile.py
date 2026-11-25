"""Profile: contact details and verifying them (profile-service)."""

from api.profile_api import ProfileApi
from api.wallet_api import WalletApi
from data.demo_customers import TEST_VERIFICATION_CODE
from helpers import create_logged_in_customer, wait_for_wallet_status


def test_alice_has_a_verified_email_and_phone(alice_token):
    response = ProfileApi(alice_token).get_profile()

    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == "alice@example.com"
    assert profile["email_verified"] is True
    assert profile["phone_verified"] is True


def test_changing_the_email_makes_it_unverified(customer):
    profile_api = ProfileApi(customer["token"])

    response = profile_api.update_profile({"email": "new.address@example.com"})

    assert response.status_code == 200
    assert response.json()["email"] == "new.address@example.com"
    assert response.json()["email_verified"] is False


def test_an_invalid_email_is_refused(customer):
    response = ProfileApi(customer["token"]).update_profile({"email": "not-an-email"})

    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


def test_verify_the_phone_with_a_code():
    someone = create_logged_in_customer([], phone_verified=False)
    profile_api = ProfileApi(someone["token"])

    sent = profile_api.send_code("PHONE")
    response = profile_api.verify("PHONE", TEST_VERIFICATION_CODE)

    assert sent.status_code == 202
    assert response.status_code == 200
    assert profile_api.get_profile().json()["phone_verified"] is True


def test_a_wrong_code_does_not_verify():
    someone = create_logged_in_customer([], phone_verified=False)
    profile_api = ProfileApi(someone["token"])
    profile_api.send_code("PHONE")

    response = profile_api.verify("PHONE", "123456")

    assert response.status_code == 422
    assert profile_api.get_profile().json()["phone_verified"] is False


def test_changing_the_email_takes_cards_out_of_the_wallet(customer):
    # Profile announces the change; Wallet reacts because the email is no longer verified.
    ProfileApi(customer["token"]).update_profile({"email": "changed@example.com"})

    wait_for_wallet_status(
        WalletApi(customer["token"]), customer["wallet_card"]["card_id"], "REMOVED"
    )
