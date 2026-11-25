from __future__ import annotations

import uuid
from typing import Literal

from cardvault_tests.models.common import ApiModel


class Tokens(ApiModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: str
    refresh_expires_in: int
    customer_id: uuid.UUID


class Me(ApiModel):
    customer_id: uuid.UUID
    username: str
    display_name: str
