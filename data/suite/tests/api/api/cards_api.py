"""Calls to the Cards service (card-service), made as one logged-in customer."""

import requests

import config


class CardsApi:
    def __init__(self, token):
        self.base_url = config.CARD_URL
        self.headers = {"Authorization": f"Bearer {token}"}

    def list_cards(self):
        return requests.get(
            f"{self.base_url}/v1/cards", headers=self.headers, timeout=config.TIMEOUT
        )

    def get_card(self, card_id):
        return requests.get(
            f"{self.base_url}/v1/cards/{card_id}", headers=self.headers, timeout=config.TIMEOUT
        )

    def report_lost(self, card_id):
        return requests.post(
            f"{self.base_url}/v1/cards/{card_id}/report-lost",
            headers=self.headers,
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
