"""card-service's internal API, as the card network calls it.

In CardVault the network mock calls these endpoints for every purchase. The suite calls
them directly too, with the ``tests`` service key, because then each test chooses its own
``trace_id`` and ``clearing_id`` and can send exactly the request it needs (a duplicate, a
bad amount, a token from another card).
"""

from __future__ import annotations

import uuid
from typing import Any

import httpx


def new_trace_id() -> str:
    return f"trc-{uuid.uuid4().hex[:20]}"


def new_clearing_id() -> str:
    return f"clr-{uuid.uuid4().hex[:20]}"


class CardNetworkClient:
    def __init__(self, http: httpx.Client, auth: httpx.Auth) -> None:
        self.http = http
        self.auth = auth

    def authorize(self, body: dict[str, Any], auth: httpx.Auth | None = None) -> httpx.Response:
        return self.http.post("/internal/v1/authorizations", json=body, auth=auth or self.auth)

    def clear(self, body: dict[str, Any], auth: httpx.Auth | None = None) -> httpx.Response:
        return self.http.post("/internal/v1/clearing", json=body, auth=auth or self.auth)

    # Shorthands that build a valid body with fresh IDs ------------------------------------

    def purchase(
        self,
        card_id: object,
        amount: int,
        token_ref: str | None = None,
        trace_id: str | None = None,
        **overrides: Any,
    ) -> httpx.Response:
        """A WALLET purchase when ``token_ref`` is given, otherwise a plain CARD purchase."""
        body = {
            "trace_id": trace_id or new_trace_id(),
            "card_id": str(card_id),
            "token_ref": token_ref,
            "token_requestor": "WALLET" if token_ref else "CARD",
            "amount": amount,
            "currency": "USD",
            "merchant_name": "Suite Test Merchant",
            "mcc": "5999",
            **overrides,
        }
        return self.authorize(body)

    def settle(self, trace_id: str, amount: int, clearing_id: str | None = None) -> httpx.Response:
        return self._clearing("SETTLE", trace_id, amount, clearing_id)

    def reverse(self, trace_id: str, amount: int, clearing_id: str | None = None) -> httpx.Response:
        return self._clearing("REVERSE", trace_id, amount, clearing_id)

    def refund(self, trace_id: str, amount: int, clearing_id: str | None = None) -> httpx.Response:
        return self._clearing("REFUND", trace_id, amount, clearing_id)

    def _clearing(
        self, kind: str, trace_id: str, amount: int, clearing_id: str | None
    ) -> httpx.Response:
        return self.clear(
            {
                "clearing_id": clearing_id or new_clearing_id(),
                "trace_id": trace_id,
                "type": kind,
                "amount": amount,
                "currency": "USD",
            }
        )
