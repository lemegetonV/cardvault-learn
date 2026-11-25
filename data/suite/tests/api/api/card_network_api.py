"""The card network simulator: it plays the shops and the card network.

In real life a customer pays at a shop and the card network asks the bank to
approve. In tests we ask the simulator to do the same, so we can make
purchases whenever a test needs one.
"""

import requests

import config


class CardNetworkApi:
    def __init__(self):
        self.base_url = config.CARD_NETWORK_URL
        self.headers = {"X-Test-Key": config.TEST_KEY}

    def make_purchase(self, token_ref, amount, merchant_name="Test Shop"):
        """Pay with a card in the wallet. token_ref identifies that wallet card.

        amount is in cents: 2500 means $25.00. The response holds the bank's
        decision: APPROVED or DECLINED.
        """
        body = {"token_ref": token_ref, "amount": amount, "merchant_name": merchant_name}
        return requests.post(
            f"{self.base_url}/v1/test/purchases",
            json=body,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def settle(self, trace_id):
        """Tell the bank the purchase is final (the shop gets paid)."""
        return requests.post(
            f"{self.base_url}/v1/test/purchases/{trace_id}/settle",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
