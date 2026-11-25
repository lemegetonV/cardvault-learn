"""Purchases: the bank approves or declines each one (the Cards service decides).

The card network simulator plays the shop. It sends the purchase to the bank
and returns the bank's decision.
"""

import pytest

from api.card_network_api import CardNetworkApi
from api.cards_api import CardsApi
from helpers import create_logged_in_customer


@pytest.mark.smoke
def test_a_purchase_is_approved_and_the_money_is_held(customer):
    card = customer["wallet_card"]
    cards_api = CardsApi(customer["token"])
    available_before = cards_api.get_card(card["card_id"]).json()["available"]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=2500)

    assert response.status_code == 200
    assert response.json()["decision"] == "APPROVED"
    available_after = cards_api.get_card(card["card_id"]).json()["available"]
    assert available_after == available_before - 2500


def test_a_purchase_above_the_available_amount_is_declined():
    someone = create_logged_in_customer([{"product": "CREDIT", "enrolled": True, "limit": 10000}])
    card = someone["cards"][0]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=10001)

    assert response.json()["decision"] == "DECLINED"
    assert response.json()["decline_code"] == "INSUFFICIENT_FUNDS"


def test_a_purchase_of_exactly_the_available_amount_is_approved():
    someone = create_logged_in_customer([{"product": "CREDIT", "enrolled": True, "limit": 10000}])
    card = someone["cards"][0]

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=10000)

    assert response.json()["decision"] == "APPROVED"


def test_a_lost_card_is_declined(customer):
    card = customer["wallet_card"]
    CardsApi(customer["token"]).report_lost(card["card_id"])

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=1000)

    assert response.json()["decision"] == "DECLINED"
    assert response.json()["decline_code"] == "CARD_LOST"


def test_a_declined_purchase_holds_no_money():
    someone = create_logged_in_customer([{"product": "CREDIT", "enrolled": True, "limit": 10000}])
    card = someone["cards"][0]

    CardNetworkApi().make_purchase(card["token_ref"], amount=50000)

    available = CardsApi(someone["token"]).get_card(card["card_id"]).json()["available"]
    assert available == 10000


def test_settling_a_purchase_charges_it(customer):
    card = customer["wallet_card"]
    network = CardNetworkApi()
    purchase = network.make_purchase(card["token_ref"], amount=1500).json()

    response = network.settle(purchase["trace_id"])

    assert response.status_code == 200
    assert response.json()["hold_status"] == "SETTLED"
    assert response.json()["cleared_amount"] == 1500
