"""Calls to the Profile service (profile-service), made as one logged-in customer."""

import requests

import config


class ProfileApi:
    def __init__(self, token):
        self.base_url = config.PROFILE_URL
        self.headers = {"Authorization": f"Bearer {token}"}

    def get_profile(self):
        return requests.get(
            f"{self.base_url}/v1/profile", headers=self.headers, timeout=config.TIMEOUT
        )

    def update_profile(self, changes):
        """changes is a dictionary such as {"email": "new@example.com"}."""
        return requests.patch(
            f"{self.base_url}/v1/profile",
            json=changes,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def send_code(self, channel):
        """channel is "EMAIL" or "PHONE"."""
        body = {"channel": channel}
        return requests.post(
            f"{self.base_url}/v1/profile/verify/send",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def verify(self, channel, code):
        body = {"channel": channel, "code": code}
        return requests.post(
            f"{self.base_url}/v1/profile/verify",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
