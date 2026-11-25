from __future__ import annotations

import uuid
from datetime import datetime

from cardvault_tests.models.common import ApiModel


class NewCard(ApiModel):
    card_id: uuid.UUID
    product: str
    status: str
    last4: str
    enrollment_id: uuid.UUID | None
    enrollment_status: str | None
    token_ref: str | None


class NewCustomer(ApiModel):
    """What ``POST /test/customers`` returns: a fresh login and its cards."""

    username: str
    password: str
    customer_id: uuid.UUID
    cards: list[NewCard]


class ClockView(ApiModel):
    now: datetime
    real_now: datetime
    offset_seconds: float
    service: str
