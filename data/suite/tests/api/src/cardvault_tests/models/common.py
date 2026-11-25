from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class ErrorBody(ApiModel):
    """The one error shape every service uses (spec section 5)."""

    error_code: str
    message: str
    correlation_id: str | None
    details: Any | None = None
