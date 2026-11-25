from __future__ import annotations

from typing import Any

import httpx


class ProfileClient:
    """profile-service: contact details and their verification."""

    def __init__(self, http: httpx.Client, auth: httpx.Auth) -> None:
        self.http = http
        self.auth = auth

    def get(self) -> httpx.Response:
        return self.http.get("/v1/profile", auth=self.auth)

    def patch(self, changes: dict[str, Any], if_match: str | int | None = None) -> httpx.Response:
        headers = {} if if_match is None else {"If-Match": str(if_match)}
        return self.http.patch("/v1/profile", json=changes, headers=headers, auth=self.auth)

    def send_code(self, channel: str) -> httpx.Response:
        return self.http.post("/v1/profile/verify/send", json={"channel": channel}, auth=self.auth)

    def verify(self, channel: str, code: str) -> httpx.Response:
        return self.http.post(
            "/v1/profile/verify", json={"channel": channel, "code": code}, auth=self.auth
        )
