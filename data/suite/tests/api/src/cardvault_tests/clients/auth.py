from __future__ import annotations

import httpx


class AuthClient:
    """auth-service: login, refresh, logout, who-am-I and the public signing keys."""

    def __init__(self, http: httpx.Client, auth: httpx.Auth | None = None) -> None:
        self.http = http
        self.auth = auth

    def login(self, username: str, password: str) -> httpx.Response:
        return self.http.post("/v1/auth/login", json={"username": username, "password": password})

    def refresh(self, refresh_token: str) -> httpx.Response:
        return self.http.post("/v1/auth/refresh", json={"refresh_token": refresh_token})

    def logout(self, refresh_token: str) -> httpx.Response:
        return self.http.post("/v1/auth/logout", json={"refresh_token": refresh_token})

    def me(self, auth: httpx.Auth | None = None) -> httpx.Response:
        return self.http.get("/v1/auth/me", auth=auth or self.auth or httpx.USE_CLIENT_DEFAULT)

    def jwks(self) -> httpx.Response:
        return self.http.get("/.well-known/jwks.json")
