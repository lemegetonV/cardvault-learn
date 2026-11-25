"""Waiting for an enrolment to reach a status.

Most wallet changes finish later: the bank queues a request to the wallet operator, the
operator answers with a signed callback about 2 seconds later, and only then does the
status change. Tests wait for that with a bounded poll of the customer's own API.
"""

from __future__ import annotations

from cardvault_tests.checks import expect
from cardvault_tests.customers import Customer
from cardvault_tests.models import WalletCard
from cardvault_tests.waits import wait_until


def wallet_card(customer: Customer, card_id: object) -> WalletCard:
    return expect(customer.wallet.card(card_id), 200, WalletCard)


def wait_for_enrolment(
    customer: Customer, card_id: object, status: str, timeout: float = 20.0
) -> WalletCard:
    return wait_until(
        lambda: wallet_card(customer, card_id),
        lambda c: c.enrollment is not None and c.enrollment.status == status,
        timeout=timeout,
        what=f"enrolment of card {card_id} to become {status}",
    )
