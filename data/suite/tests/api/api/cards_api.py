"""Calls to the Cards service (card-service), made as one logged-in customer."""

import requests

import config


class CardsApi:
    def __init__(self, token):
        self.base_url = config.CARD_URL
        self.headers = {"Authorization": f"Bearer {token}"}

    def list_cards(self, limit=None, cursor=None):
        """One page of cards. limit is the page size; cursor asks for the next page.

        requests leaves out any query parameter whose value is None.
        """
        params = {"limit": limit, "cursor": cursor}
        return requests.get(
            f"{self.base_url}/v1/cards",
            params=params,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def get_card(self, card_id):
        return requests.get(
            f"{self.base_url}/v1/cards/{card_id}", headers=self.headers, timeout=config.TIMEOUT
        )

    def report_lost(self, card_id, idempotency_key=None):
        """With an idempotency key, sending the same request again is safe:
        the service replays its first answer instead of acting twice."""
        headers = dict(self.headers)  # a copy, so the shared headers stay unchanged
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        return requests.post(
            f"{self.base_url}/v1/cards/{card_id}/report-lost",
            headers=headers,
            timeout=config.TIMEOUT,
        )

    def reissue(self, card_id):
        return requests.post(
            f"{self.base_url}/v1/cards/{card_id}/reissue",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def close(self, card_id):
        return requests.post(
            f"{self.base_url}/v1/cards/{card_id}/close",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
