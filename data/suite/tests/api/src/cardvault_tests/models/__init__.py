"""Pydantic models of CardVault's responses.

Validating a response against its model checks its shape (fields present, right types,
allowed values) in one line, so tests can assert on business values only. Models allow
extra fields, because a new field is not a breaking change for a client.
"""

from cardvault_tests.models.auth import Me, Tokens
from cardvault_tests.models.cards import Card, CardPage
from cardvault_tests.models.common import ErrorBody
from cardvault_tests.models.payments import Authorization, Clearing
from cardvault_tests.models.testsupport import ClockView, NewCard, NewCustomer
from cardvault_tests.models.transactions import (
    Dispute,
    DisputePage,
    Receipt,
    Transaction,
    TransactionPage,
)
from cardvault_tests.models.wallet import (
    CallbackAck,
    Enrolment,
    Finding,
    Profile,
    ReconciliationRun,
    Wallet,
    WalletCard,
)

__all__ = [
    "Dispute",
    "DisputePage",
    "Receipt",
    "Transaction",
    "TransactionPage",
    "CallbackAck",
    "Finding",
    "ReconciliationRun",
    "Enrolment",
    "Profile",
    "Wallet",
    "WalletCard",
    "Authorization",
    "Clearing",
    "Card",
    "CardPage",
    "ClockView",
    "ErrorBody",
    "Me",
    "NewCard",
    "NewCustomer",
    "Tokens",
]
