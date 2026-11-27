"""Calls to the Login service (auth-service)."""

import config
from api.client import http


class AuthApi:
    def __init__(self):
        self.base_url = config.AUTH_URL

    def login(self, username, password):
        """Log in. A successful response holds an access token."""
        body = {"username": username, "password": password}
        return http.post(f"{self.base_url}/v1/auth/login", json=body, timeout=config.TIMEOUT)

    def refresh(self, refresh_token):
        """Swap a refresh token for a new access token and a new refresh token."""
        body = {"refresh_token": refresh_token}
        return http.post(f"{self.base_url}/v1/auth/refresh", json=body, timeout=config.TIMEOUT)

    def logout(self, refresh_token):
        """End a session: the refresh token, and every one swapped for it, stop working."""
        body = {"refresh_token": refresh_token}
        return http.post(f"{self.base_url}/v1/auth/logout", json=body, timeout=config.TIMEOUT)

    def me(self, token):
        """Who is logged in with this token."""
        headers = {"Authorization": f"Bearer {token}"}
        return http.get(f"{self.base_url}/v1/auth/me", headers=headers, timeout=config.TIMEOUT)
