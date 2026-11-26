"""Checking the shape of a response with JSON Schema.

A test that checks two or three values can miss a field that disappeared or
changed type. A schema check looks at every field at once.
"""

from jsonschema import validate

from api.auth_api import AuthApi
from api.cards_api import CardsApi
from data.schemas import CARD_PAGE_SCHEMA, CARD_SCHEMA, ERROR_SCHEMA

UNKNOWN_CARD_ID = "00000000-0000-4000-8000-000000000000"


def test_card_list_matches_its_schema(alice_token):
    response = CardsApi(alice_token).list_cards()

    assert response.status_code == 200
    # validate() does nothing when the response fits the schema, and fails the
    # test with the field and the reason when it does not.
    validate(instance=response.json(), schema=CARD_PAGE_SCHEMA)


def test_one_card_matches_its_schema(alice_token):
    cards_api = CardsApi(alice_token)
    card_id = cards_api.list_cards().json()["items"][0]["card_id"]

    response = cards_api.get_card(card_id)

    assert response.status_code == 200
    validate(instance=response.json(), schema=CARD_SCHEMA)


def test_every_error_has_the_same_shape(alice_token):
    errors = [
        CardsApi(token="").list_cards(),  # 401: no token
        CardsApi(alice_token).get_card(UNKNOWN_CARD_ID),  # 404: no such card
        AuthApi().login("", "any-password"),  # 422: the request is invalid
    ]

    for response in errors:
        assert response.status_code >= 400
        validate(instance=response.json(), schema=ERROR_SCHEMA)
