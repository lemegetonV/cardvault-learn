from __future__ import annotations

import httpx

TERMS_VERSION = "2026-01"  # the wallet terms version the seed data was accepted under


class WalletClient:
    """enrollment-service customer API: the wallet as the customer sees it."""

    def __init__(self, http: httpx.Client, auth: httpx.Auth) -> None:
        self.http = http
        self.auth = auth

    def get(self) -> httpx.Response:
        return self.http.get("/v1/wallet", auth=self.auth)

    def card(self, card_id: object) -> httpx.Response:
        return self.http.get(f"/v1/wallet/cards/{card_id}", auth=self.auth)

    def add(self, card_id: object, terms_version: str | None = TERMS_VERSION) -> httpx.Response:
        body = {} if terms_version is None else {"terms_version": terms_version}
        return self.http.post(f"/v1/wallet/cards/{card_id}", json=body, auth=self.auth)

    def remove(self, card_id: object) -> httpx.Response:
        return self.http.delete(f"/v1/wallet/cards/{card_id}", auth=self.auth)

    def opt_out(self) -> httpx.Response:
        return self.http.post("/v1/wallet/opt-out", auth=self.auth)

    def opt_in(self, terms_version: str | None = TERMS_VERSION) -> httpx.Response:
        body = {} if terms_version is None else {"terms_version": terms_version}
        return self.http.post("/v1/wallet/opt-in", json=body, auth=self.auth)
