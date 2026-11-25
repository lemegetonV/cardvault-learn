"""The checkout wallet: the Wallet service (enrollment-service)."""

import pytest

from api.cards_api import CardsApi
from api.wallet_api import WalletApi
from data.demo_customers import ALICE
from helpers import create_logged_in_customer, wait_for_wallet_status


def test_alice_has_two_cards_in_the_wallet(alice_token):
    cards = WalletApi(alice_token).get_wallet().json()["cards"]

    enrolled = []
    for card in cards:
        if card["enrollment"] and card["enrollment"]["status"] == "ENROLLED":
            enrolled.append(card["last4"])
    assert sorted(enrolled) == sorted(ALICE["wallet_cards"])


def test_alices_other_cards_say_why_they_cannot_join(alice_token):
    cards = WalletApi(alice_token).get_wallet().json()["cards"]

    reasons = {}
    for card in cards:
        if not card["eligible"]:
            reasons[card["last4"]] = card["ineligible_reason"]
    assert reasons == ALICE["ineligible_cards"]


# Each row: the card and customer we create, and the reason we expect.
# The rules come from the wallet's eligibility requirements.
@pytest.mark.parametrize(
    "card, email_verified, phone_verified, expected_reason",
    [
        ({"product": "PREPAID"}, True, True, "PRODUCT_NOT_SUPPORTED"),
        ({"product": "CREDIT", "status": "LOST"}, True, True, "CARD_NOT_ACTIVE"),
        ({"product": "CREDIT", "used_days_ago": 91}, True, True, "NOT_RECENTLY_USED"),
        ({"product": "CREDIT", "used_days_ago": None}, True, True, "NOT_RECENTLY_USED"),
        ({"product": "CREDIT"}, False, True, "EMAIL_NOT_VERIFIED"),
        ({"product": "CREDIT"}, True, False, "PHONE_NOT_VERIFIED"),
    ],
    ids=[
        "prepaid",
        "lost-card",
        "used-91-days-ago",
        "never-used",
        "email-unverified",
        "phone-unverified",
    ],
)
def test_card_that_may_not_join_the_wallet(card, email_verified, phone_verified, expected_reason):
    someone = create_logged_in_customer([card], email_verified, phone_verified)
    card_id = someone["cards"][0]["card_id"]

    wallet_card = WalletApi(someone["token"]).get_card(card_id).json()

    assert wallet_card["eligible"] is False
    assert wallet_card["ineligible_reason"] == expected_reason


@pytest.mark.parametrize("product", ["CREDIT", "DEBIT"])
def test_recently_used_credit_and_debit_cards_may_join(product):
    # The rule is "used in the last 90 days", so 89 days ago is just inside it.
    someone = create_logged_in_customer([{"product": product, "used_days_ago": 89}])
    card_id = someone["cards"][0]["card_id"]

    wallet_card = WalletApi(someone["token"]).get_card(card_id).json()

    assert wallet_card["eligible"] is True
    assert wallet_card["ineligible_reason"] is None


@pytest.mark.smoke
def test_add_a_card_to_the_wallet(customer):
    wallet_api = WalletApi(customer["token"])
    card_id = customer["new_card"]["card_id"]

    response = wallet_api.add_card(card_id)

    # 202 Accepted: the bank has asked the wallet company, which confirms a moment later.
    assert response.status_code == 202
    assert response.json()["enrollment"]["status"] == "PENDING"
    wait_for_wallet_status(wallet_api, card_id, "ENROLLED")


def test_an_ineligible_card_cannot_be_added():
    someone = create_logged_in_customer([{"product": "PREPAID"}])
    card_id = someone["cards"][0]["card_id"]

    response = WalletApi(someone["token"]).add_card(card_id)

    assert response.status_code == 422
    assert response.json()["error_code"] == "CARD_INELIGIBLE"
    assert response.json()["details"]["reason"] == "PRODUCT_NOT_SUPPORTED"


def test_remove_a_card_from_the_wallet(customer):
    wallet_api = WalletApi(customer["token"])
    card_id = customer["wallet_card"]["card_id"]

    response = wallet_api.remove_card(card_id)

    assert response.status_code == 200
    assert response.json()["enrollment"]["status"] == "REMOVED"


def test_opting_out_removes_every_card(customer):
    wallet_api = WalletApi(customer["token"])

    response = wallet_api.opt_out()

    assert response.status_code == 200
    assert response.json()["opted_out"] is True
    for card in response.json()["cards"]:
        assert card["eligible"] is False
        assert card["ineligible_reason"] == "CUSTOMER_OPTED_OUT"


def test_a_lost_card_is_paused_in_the_wallet(customer):
    # Two services work together here: Cards records the loss and announces it,
    # then Wallet pauses the card. So we wait for the wallet to catch up.
    card_id = customer["wallet_card"]["card_id"]

    CardsApi(customer["token"]).report_lost(card_id)

    wait_for_wallet_status(WalletApi(customer["token"]), card_id, "SUSPENDED")
