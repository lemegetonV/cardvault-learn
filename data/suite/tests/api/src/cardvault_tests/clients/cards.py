from __future__ import annotations

import httpx


class CardsClient:
    """card-service customer API. Every call is made as the customer whose auth it holds."""

    def __init__(self, http: httpx.Client, auth: httpx.Auth) -> None:
        self.http = http
        self.auth = auth

    def list(self, limit: int | None = None, cursor: str | None = None) -> httpx.Response:
        params = {k: v for k, v in {"limit": limit, "cursor": cursor}.items() if v is not None}
        return self.http.get("/v1/cards", params=params, auth=self.auth)

    def get(self, card_id: object) -> httpx.Response:
        return self.http.get(f"/v1/cards/{card_id}", auth=self.auth)

    def report_lost(self, card_id: object, idempotency_key: str | None = None) -> httpx.Response:
        return self._post(f"/v1/cards/{card_id}/report-lost", idempotency_key)

    def reissue(self, card_id: object, idempotency_key: str | None = None) -> httpx.Response:
        return self._post(f"/v1/cards/{card_id}/reissue", idempotency_key)

    def close(self, card_id: object, idempotency_key: str | None = None) -> httpx.Response:
        return self._post(f"/v1/cards/{card_id}/close", idempotency_key)

    def _post(self, path: str, idempotency_key: str | None) -> httpx.Response:
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else {}
        return self.http.post(path, headers=headers, auth=self.auth)
