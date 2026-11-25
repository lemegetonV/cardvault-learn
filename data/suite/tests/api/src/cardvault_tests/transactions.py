"""Making wallet purchases and waiting for them to appear in the customer's history.

A wallet transaction is not written by the request that makes the purchase:

    card-service approves --> auth.decided event --> wallet-txn-service folds it into a row
    card-service clears   --> txn.cleared event  --> the same row, status recomputed

So the history is eventually consistent, and a test waits for the row to reach the state
it expects instead of reading it straight after the purchase.
"""

from __future__ import annotations

from collections.abc import Callable

from cardvault_tests.checks import expect
from cardvault_tests.clients.card_network import CardNetworkClient
from cardvault_tests.customers import Customer
from cardvault_tests.models import Authorization, NewCard, Transaction, TransactionPage
from cardvault_tests.waits import wait_until


def wallet_purchase(
    card_network: CardNetworkClient, own: NewCard, amount: int, **overrides
) -> Authorization:
    """A purchase made with the card's wallet token (only these reach the wallet history)."""
    assert own.token_ref, "the card must be enrolled (card(..., enrolled=True))"
    return expect(
        card_network.purchase(own.card_id, amount, own.token_ref, **overrides), 200, Authorization
    )


def find(customer: Customer, trace_id: str) -> Transaction | None:
    page = expect(customer.transactions.list(limit=100), 200, TransactionPage)
    return next((t for t in page.items if t.trace_id == trace_id), None)


def wait_for_transaction(
    customer: Customer,
    trace_id: str,
    until: Callable[[Transaction], bool] = lambda t: True,
    *,
    what: str = "",
    timeout: float = 15.0,
) -> Transaction:
    """Poll the customer's own history until the transaction is there and ``until`` holds."""
    return wait_until(
        lambda: find(customer, trace_id),
        lambda t: t is not None and until(t),
        timeout=timeout,
        what=what or f"transaction {trace_id} in the wallet history",
    )
