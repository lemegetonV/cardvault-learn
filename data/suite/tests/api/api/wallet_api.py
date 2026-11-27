"""Calls to the Wallet service (enrollment-service), made as one logged-in customer."""

import config
from api.client import http

# The version of the wallet terms a customer accepts when adding a card.
TERMS_VERSION = "2026-01"


class WalletApi:
    def __init__(self, token):
        self.base_url = config.WALLET_URL
        self.headers = {"Authorization": f"Bearer {token}"}

    def get_wallet(self):
        """Every card of the customer, with whether it may join and its wallet status."""
        return http.get(f"{self.base_url}/v1/wallet", headers=self.headers, timeout=config.TIMEOUT)

    def get_card(self, card_id):
        return http.get(
            f"{self.base_url}/v1/wallet/cards/{card_id}",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def add_card(self, card_id):
        body = {"terms_version": TERMS_VERSION}
        return http.post(
            f"{self.base_url}/v1/wallet/cards/{card_id}",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def remove_card(self, card_id):
        return http.delete(
            f"{self.base_url}/v1/wallet/cards/{card_id}",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def opt_out(self):
        return http.post(
            f"{self.base_url}/v1/wallet/opt-out", headers=self.headers, timeout=config.TIMEOUT
        )
