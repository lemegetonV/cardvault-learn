"""Calls to the Login service (auth-service)."""

import requests

import config


class AuthApi:
    def __init__(self):
        self.base_url = config.AUTH_URL

    def login(self, username, password):
        """Log in. A successful response holds an access token."""
        body = {"username": username, "password": password}
        return requests.post(f"{self.base_url}/v1/auth/login", json=body, timeout=config.TIMEOUT)

    def me(self, token):
        """Who is logged in with this token."""
        headers = {"Authorization": f"Bearer {token}"}
        return requests.get(f"{self.base_url}/v1/auth/me", headers=headers, timeout=config.TIMEOUT)
