"""Calls to the Profile service (profile-service), made as one logged-in customer."""

import config
from api.client import http


class ProfileApi:
    def __init__(self, token):
        self.base_url = config.PROFILE_URL
        self.headers = {"Authorization": f"Bearer {token}"}

    def get_profile(self):
        return http.get(f"{self.base_url}/v1/profile", headers=self.headers, timeout=config.TIMEOUT)

    def update_profile(self, changes, version=None):
        """changes is a dictionary such as {"email": "new@example.com"}.

        version is the profile version you last read. With it, the service refuses
        the change if someone else changed the profile in the meantime.
        """
        headers = dict(self.headers)
        if version is not None:
            headers["If-Match"] = str(version)
        return http.patch(
            f"{self.base_url}/v1/profile",
            json=changes,
            headers=headers,
            timeout=config.TIMEOUT,
        )

    def send_code(self, channel):
        """channel is "EMAIL" or "PHONE"."""
        body = {"channel": channel}
        return http.post(
            f"{self.base_url}/v1/profile/verify/send",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def verify(self, channel, code):
        body = {"channel": channel, "code": code}
        return http.post(
            f"{self.base_url}/v1/profile/verify",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
