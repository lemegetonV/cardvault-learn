"""Security: a customer reaches only their own data, and only in allowed ways.

Two fresh customers are created for these tests: "owner" has the card, and
"intruder" tries to reach it with their own valid token.
"""

from api.cards_api import CardsApi
from api.profile_api import ProfileApi
from api.wallet_api import WalletApi
from helpers import create_logged_in_customer


def make_owner_and_intruder():
    owner = create_logged_in_customer(cards=[{"product": "CREDIT", "enrolled": True}])
    intruder = create_logged_in_customer(cards=[])
    return owner, intruder


def test_customer_cannot_read_another_customers_card():
    owner, intruder = make_owner_and_intruder()
    card_id = owner["cards"][0]["card_id"]

    response = CardsApi(intruder["token"]).get_card(card_id)

    # 404, not 403: the app does not even admit that the card exists.
    assert response.status_code == 404
    assert response.json()["error_code"] == "CARD_NOT_FOUND"


def test_customer_cannot_change_another_customers_card():
    owner, intruder = make_owner_and_intruder()
    card_id = owner["cards"][0]["card_id"]

    response = CardsApi(intruder["token"]).report_lost(card_id)

    assert response.status_code == 404
    # The real proof: the owner's card is unchanged.
    assert CardsApi(owner["token"]).get_card(card_id).json()["status"] == "ACTIVE"


def test_customer_cannot_see_another_customers_wallet_card():
    owner, intruder = make_owner_and_intruder()
    card_id = owner["cards"][0]["card_id"]

    response = WalletApi(intruder["token"]).get_card(card_id)

    assert response.status_code == 404
    assert response.json()["error_code"] == "CARD_NOT_FOUND"


def test_a_token_with_a_changed_signature_is_refused(alice_token):
    # The last part of a token is its signature. Changing one character there
    # must make the token worthless, or anyone could forge one.
    if alice_token.endswith("A"):
        tampered = alice_token[:-1] + "B"
    else:
        tampered = alice_token[:-1] + "A"

    response = CardsApi(tampered).list_cards()

    assert response.status_code == 401


def test_customer_cannot_mark_their_own_email_as_verified():
    # Sending a field the customer may not set, hoping the service saves it,
    # is called mass assignment. The service must ignore it.
    someone = create_logged_in_customer(cards=[], email_verified=False)
    profile_api = ProfileApi(someone["token"])

    response = profile_api.update_profile({"email_verified": True})

    assert response.status_code == 200
    assert profile_api.get_profile().json()["email_verified"] is False
