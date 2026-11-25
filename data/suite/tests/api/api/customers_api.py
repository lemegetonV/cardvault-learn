"""Creates brand-new customers for tests, through a test-only endpoint.

Tests that change data (report a card lost, open a dispute) each get their own
new customer, so they never disturb each other or the demo customers.
This endpoint exists only in test environments and needs the test key.
"""

import requests

import config


class CustomersApi:
    def __init__(self):
        self.base_url = config.WALLET_URL
        self.headers = {"X-Test-Key": config.TEST_KEY}

    def create_customer(self, cards, email_verified=True, phone_verified=True):
        """cards is a list of dictionaries, one per card, for example:

            [{"product": "CREDIT", "enrolled": True}, {"product": "DEBIT"}]

        The response holds the new username, password and the cards created.
        """
        body = {
            "cards": cards,
            "email_verified": email_verified,
            "phone_verified": phone_verified,
        }
        return requests.post(
            f"{self.base_url}/test/customers",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
