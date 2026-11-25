"""Known starting data and templates for fresh customers.

Seed facts come from the spec (section 10 and rule 64) and the repo's fixed seed IDs. They
are the expected values for read-only tests, so they are written here once instead of being
copied from a response.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SeedCard:
    card_id: uuid.UUID
    product: str
    status: str
    last4: str


@dataclass(frozen=True)
class SeedCustomer:
    username: str
    customer_id: uuid.UUID
    display_name: str
    cards: tuple[SeedCard, ...]


def _card(card_id: str, product: str, status: str, last4: str) -> SeedCard:
    return SeedCard(uuid.UUID(card_id), product, status, last4)


ALICE = SeedCustomer(
    "alice",
    uuid.UUID("a11ce000-0000-4000-8000-000000000001"),
    "Alice Archer",
    (
        _card("ca4d0000-a11c-4000-8000-000000000001", "CREDIT", "ACTIVE", "4417"),
        _card("ca4d0000-a11c-4000-8000-000000000002", "DEBIT", "ACTIVE", "2045"),
        _card("ca4d0000-a11c-4000-8000-000000000003", "CREDIT", "ACTIVE", "7380"),
        _card("ca4d0000-a11c-4000-8000-000000000004", "PREPAID", "ACTIVE", "5521"),
    ),
)
BOB = SeedCustomer(
    "bob",
    uuid.UUID("b0b00000-0000-4000-8000-000000000002"),
    "Bob Baker",
    (
        _card("ca4d0000-b0b0-4000-8000-000000000001", "CREDIT", "ACTIVE", "1029"),
        _card("ca4d0000-b0b0-4000-8000-000000000002", "DEBIT", "LOST", "8836"),
    ),
)
SEED_CUSTOMERS = (ALICE, BOB)


def card(
    product: str = "CREDIT",
    *,
    status: str = "ACTIVE",
    used_days_ago: int | None = 5,
    enrolled: bool = False,
    limit: int = 300_000,
    available: int | None = None,
    expiry: str | None = None,
) -> dict[str, Any]:
    """One card in a ``POST /test/customers`` template. Amounts are cents."""
    out: dict[str, Any] = {
        "product": product,
        "status": status,
        "used_days_ago": used_days_ago,
        "enrolled": enrolled,
        "limit": limit,
    }
    if available is not None:
        out["available"] = available
    if expiry is not None:
        out["expiry"] = expiry
    return out


def customer(*cards: dict[str, Any], **profile: Any) -> dict[str, Any]:
    """A customer template: verified email and phone unless ``profile`` says otherwise."""
    return {"email_verified": True, "phone_verified": True, **profile, "cards": list(cards)}
