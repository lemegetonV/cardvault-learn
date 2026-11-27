"""Cards: the Cards service (card-service)."""

import pytest

import config
from api.cards_api import CardsApi
from data.demo_customers import ALICE


@pytest.mark.smoke
def test_alice_has_her_four_cards(alice_token):
    response = CardsApi(alice_token).list_cards()

    assert response.status_code == 200
    cards = response.json()["items"]
    # Turn the list into {last4: product}, to compare with what we expect.
    found = {card["last4"]: card["product"] for card in cards}
    assert found == ALICE["cards"]


def test_the_card_list_answers_quickly(alice_token):
    response = CardsApi(alice_token).list_cards()

    # elapsed is the time from sending the request until the response headers arrived.
    seconds = response.elapsed.total_seconds()
    assert response.status_code == 200
    assert seconds < config.MAX_RESPONSE_SECONDS, f"took {seconds:.2f} s"


def test_every_card_has_the_fields_the_app_shows(alice_token):
    cards = CardsApi(alice_token).list_cards().json()["items"]

    for card in cards:
        for field in ["card_id", "product", "last4", "status", "expiry", "limit", "available"]:
            assert field in card, f"{field} is missing from card {card['last4']}"


def test_available_is_never_more_than_the_limit(alice_token):
    cards = CardsApi(alice_token).list_cards().json()["items"]

    for card in cards:
        assert 0 <= card["available"] <= card["limit"]


def test_get_one_card(customer):
    card_id = customer["wallet_card"]["card_id"]

    response = CardsApi(customer["token"]).get_card(card_id)

    assert response.status_code == 200
    assert response.json()["card_id"] == card_id
    assert response.json()["status"] == "ACTIVE"


def test_a_customer_cannot_see_someone_elses_card(customer, alice_token):
    alice_card_id = CardsApi(alice_token).list_cards().json()["items"][0]["card_id"]

    response = CardsApi(customer["token"]).get_card(alice_card_id)

    # 404, not 403: the app does not even admit that the card exists.
    assert response.status_code == 404
    assert response.json()["error_code"] == "CARD_NOT_FOUND"


def test_report_a_card_lost(customer):
    cards_api = CardsApi(customer["token"])
    card_id = customer["new_card"]["card_id"]

    response = cards_api.report_lost(card_id)

    assert response.status_code == 200
    assert response.json()["status"] == "LOST"
    # Check again with a fresh request: the change was really saved.
    assert cards_api.get_card(card_id).json()["status"] == "LOST"


def test_reporting_a_card_lost_twice_is_safe(customer):
    cards_api = CardsApi(customer["token"])
    card_id = customer["new_card"]["card_id"]
    cards_api.report_lost(card_id)

    response = cards_api.report_lost(card_id)

    assert response.status_code == 200
    assert response.json()["status"] == "LOST"


def test_reissue_gives_a_new_number_and_an_active_card(customer):
    cards_api = CardsApi(customer["token"])
    card = customer["new_card"]
    cards_api.report_lost(card["card_id"])

    response = cards_api.reissue(card["card_id"])

    assert response.status_code == 200
    assert response.json()["status"] == "ACTIVE"
    assert response.json()["last4"] != card["last4"]


def test_a_closed_card_cannot_be_reported_lost(customer):
    cards_api = CardsApi(customer["token"])
    card_id = customer["new_card"]["card_id"]
    cards_api.close(card_id)

    response = cards_api.report_lost(card_id)

    assert response.status_code == 409
    assert response.json()["error_code"] == "INVALID_STATE_TRANSITION"
