from __future__ import annotations

from typing import Any

import httpx


class TransactionsClient:
    """wallet-txn-service: the customer's wallet transactions, the CSV export and disputes."""

    def __init__(self, http: httpx.Client, auth: httpx.Auth) -> None:
        self.http = http
        self.auth = auth

    def list(self, **filters: Any) -> httpx.Response:
        """Filters: card_id and status (a value or a list), from_ and to, cursor, limit."""
        return self.http.get("/v1/wallet/transactions", params=_params(filters), auth=self.auth)

    def get(self, txn_id: object) -> httpx.Response:
        return self.http.get(f"/v1/wallet/transactions/{txn_id}", auth=self.auth)

    def export(self, **filters: Any) -> httpx.Response:
        return self.http.get(
            "/v1/wallet/transactions/export", params=_params(filters), auth=self.auth
        )

    def open_dispute(
        self,
        txn_id: object,
        reason: str,
        note: str | None = None,
        receipt: tuple[str, bytes] | None = None,
        idempotency_key: str | None = None,
    ) -> httpx.Response:
        """A multipart form: ``reason`` and ``note`` as fields, ``receipt`` as (filename, bytes).

        httpx builds the multipart body from ``data`` (text fields) and ``files``. The part's
        own Content-Type is sent as application/octet-stream on purpose: the bank must judge
        the file by its bytes, not by what the client claims.
        """
        data = {"reason": reason}
        if note is not None:
            data["note"] = note
        files = None
        if receipt is not None:
            name, content = receipt
            files = {"receipt": (name, content, "application/octet-stream")}
        headers = {"Idempotency-Key": idempotency_key} if idempotency_key else {}
        return self.http.post(
            f"/v1/wallet/transactions/{txn_id}/disputes",
            data=data,
            files=files,
            headers=headers,
            auth=self.auth,
        )

    def disputes(self, **params: Any) -> httpx.Response:
        return self.http.get("/v1/wallet/disputes", params=params, auth=self.auth)

    def dispute(self, dispute_id: object) -> httpx.Response:
        return self.http.get(f"/v1/wallet/disputes/{dispute_id}", auth=self.auth)


def _params(filters: dict[str, Any]) -> dict[str, Any]:
    # ``from`` is a Python keyword, so callers write ``from_``.
    out = {("from" if k == "from_" else k): v for k, v in filters.items() if v is not None}
    for key in ("card_id", "status"):
        if key in out and not isinstance(out[key], list):
            out[key] = [out[key]]
    return out
