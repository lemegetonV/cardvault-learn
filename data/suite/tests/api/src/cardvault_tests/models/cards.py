from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from cardvault_tests.models.common import ApiModel

Product = Literal["CREDIT", "DEBIT", "PREPAID"]
CardStatus = Literal["ACTIVE", "LOST", "CLOSED"]


class Card(ApiModel):
    card_id: uuid.UUID
    product: Product
    last4: str = Field(pattern=r"^\d{4}$")
    expiry: str = Field(pattern=r"^\d{4}-\d{2}$")
    status: CardStatus
    limit: int
    available: int
    currency: Literal["USD"]
    last_used_at: datetime | None
    created_at: datetime


class CardPage(ApiModel):
    items: list[Card]
    next_cursor: str | None
