"""Calls to the Transactions service (wallet-txn-service), made as one logged-in customer."""

import config
from api.client import http


class TransactionsApi:
    def __init__(self, token):
        self.base_url = config.TRANSACTIONS_URL
        self.headers = {"Authorization": f"Bearer {token}"}

    def list_transactions(self, status=None, card_id=None):
        """The customer's wallet purchases, newest first. Filters are optional."""
        params = {}
        if status:
            params["status"] = status
        if card_id:
            params["card_id"] = card_id
        return http.get(
            f"{self.base_url}/v1/wallet/transactions",
            params=params,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def get_transaction(self, txn_id):
        return http.get(
            f"{self.base_url}/v1/wallet/transactions/{txn_id}",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def export_csv(self):
        """The same list as a CSV file (text, not JSON)."""
        return http.get(
            f"{self.base_url}/v1/wallet/transactions/export",
            headers=self.headers,
            timeout=config.TIMEOUT,
        )

    def open_dispute(self, txn_id, reason, note=None, receipt_file=None):
        """Disputes are sent as a form (like a web page form), not as JSON.

        receipt_file is an optional file opened for reading, for example
        open("data/files/receipt.png", "rb"). requests uploads it with the form.
        """
        form = {"reason": reason}
        if note:
            form["note"] = note
        files = {}
        if receipt_file:
            files["receipt"] = receipt_file
        return http.post(
            f"{self.base_url}/v1/wallet/transactions/{txn_id}/disputes",
            data=form,
            files=files,
            headers=self.headers,
            timeout=config.TIMEOUT,
        )
