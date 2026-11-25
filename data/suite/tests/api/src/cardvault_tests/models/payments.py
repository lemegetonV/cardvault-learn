from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from cardvault_tests.models.common import ApiModel


class Authorization(ApiModel):
    trace_id: str
    card_id: uuid.UUID
    decision: Literal["APPROVED", "DECLINED"]
    decline_code: str | None
    amount: int
    currency: Literal["USD"]
    hold_id: uuid.UUID | None
    decided_at: datetime


class Clearing(ApiModel):
    clearing_id: str
    trace_id: str
    type: Literal["SETTLE", "REVERSE", "REFUND"]
    amount: int
    card_id: uuid.UUID
    hold_status: Literal["ACTIVE", "SETTLED", "RELEASED"]
    hold_amount: int
    cleared_amount: int
    reversed_amount: int
    refunded_amount: int
    available: int
    cleared_at: datetime
