from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from cardvault_tests.models.common import ApiModel

TxnStatus = Literal[
    "AUTHORIZED",
    "DECLINED",
    "SETTLED",
    "PARTIALLY_REVERSED",
    "REVERSED",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
]


class Transaction(ApiModel):
    txn_id: uuid.UUID
    trace_id: str
    card_id: uuid.UUID
    merchant_name: str | None
    mcc: str | None
    status: TxnStatus
    decline_code: str | None
    amount: int | None
    cleared_amount: int
    reversed_amount: int
    refunded_amount: int
    currency: str
    occurred_at: datetime
    settled_at: datetime | None
    open_dispute_id: uuid.UUID | None


class TransactionPage(ApiModel):
    items: list[Transaction]
    next_cursor: str | None


class Receipt(ApiModel):
    filename: str
    content_type: Literal["application/pdf", "image/png", "image/jpeg"]
    size: int


class Dispute(ApiModel):
    dispute_id: uuid.UUID
    txn_id: uuid.UUID
    reason: Literal["UNRECOGNISED", "DUPLICATE", "WRONG_AMOUNT", "NOT_RECEIVED"]
    note: str | None
    status: Literal["OPEN"]
    receipt: Receipt | None
    created_at: datetime


class DisputePage(ApiModel):
    items: list[Dispute]
    next_cursor: str | None
