"""Behaviours that most real APIs have: pages, safe retries, safe updates
and rate limits."""

import uuid

from api.cards_api import CardsApi
from api.profile_api import ProfileApi
from data.demo_customers import ALICE
from helpers import create_logged_in_customer

# ---------- Pagination: a long list comes back one page at a time ----------


def test_pages_of_two_cards_cover_all_of_alices_cards(alice_token):
    cards_api = CardsApi(alice_token)

    first_page = cards_api.list_cards(limit=2).json()
    second_page = cards_api.list_cards(limit=2, cursor=first_page["next_cursor"]).json()

    assert len(first_page["items"]) == 2
    assert len(second_page["items"]) == 2
    # No more pages after the last one.
    assert second_page["next_cursor"] is None
    # Together the pages hold each card exactly once.
    last4s = [card["last4"] for card in first_page["items"] + second_page["items"]]
    assert sorted(last4s) == sorted(ALICE["cards"])


def test_a_page_size_above_the_maximum_is_refused(alice_token):
    # The API documents a page size of 1 to 100.
    response = CardsApi(alice_token).list_cards(limit=101)

    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"


# ---------- Idempotency: sending the same request twice is safe ----------


def test_repeating_a_request_with_the_same_key_replays_the_first_answer(customer):
    cards_api = CardsApi(customer["token"])
    card_id = customer["wallet_card"]["card_id"]
    key = str(uuid.uuid4())  # a new random key, so no other test uses it

    first = cards_api.report_lost(card_id, idempotency_key=key)
    second = cards_api.report_lost(card_id, idempotency_key=key)

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json() == first.json()
    # This header shows the service replayed its answer instead of acting again.
    assert second.headers["Idempotent-Replayed"] == "true"


def test_reusing_a_key_for_a_different_request_is_refused(customer):
    cards_api = CardsApi(customer["token"])
    key = str(uuid.uuid4())
    cards_api.report_lost(customer["wallet_card"]["card_id"], idempotency_key=key)

    response = cards_api.report_lost(customer["new_card"]["card_id"], idempotency_key=key)

    assert response.status_code == 422
    assert response.json()["error_code"] == "IDEMPOTENCY_KEY_REUSED"


# ---------- Concurrent updates: do not overwrite a newer change ----------


def test_an_update_based_on_an_old_version_is_refused():
    someone = create_logged_in_customer(cards=[])
    profile_api = ProfileApi(someone["token"])
    old_version = profile_api.get_profile().json()["version"]
    # Someone else changes the profile first (for example in another browser tab).
    profile_api.update_profile({"email": "first-change@example.com"})

    response = profile_api.update_profile(
        {"email": "second-change@example.com"}, version=old_version
    )

    assert response.status_code == 412
    assert response.json()["error_code"] == "VERSION_MISMATCH"
    assert profile_api.get_profile().json()["email"] == "first-change@example.com"


def test_an_update_based_on_the_current_version_succeeds():
    someone = create_logged_in_customer(cards=[])
    profile_api = ProfileApi(someone["token"])
    version = profile_api.get_profile().json()["version"]

    response = profile_api.update_profile({"email": "new@example.com"}, version=version)

    assert response.status_code == 200
    assert response.json()["version"] == version + 1


# ---------- Rate limits: too many requests too fast are refused ----------


def test_asking_for_a_second_code_too_soon_is_refused():
    someone = create_logged_in_customer(cards=[], email_verified=False)
    profile_api = ProfileApi(someone["token"])
    profile_api.send_code("EMAIL")

    response = profile_api.send_code("EMAIL")

    # 429 Too Many Requests. The body says how long to wait before asking again.
    assert response.status_code == 429
    assert response.json()["error_code"] == "OTP_COOLDOWN"
    assert response.json()["details"]["retry_after_seconds"] > 0
