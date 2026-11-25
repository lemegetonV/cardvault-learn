"""Signing a callback the way the wallet operator does (spec 5, 16.6 rule 36).

The operator proves a callback is genuine with a shared secret:

    signed string = "{X-Timestamp}.{raw body}"
    X-Signature   = lowercase hex HMAC-SHA256(secret, signed string)

The bank recomputes the signature over the exact bytes it received, so the body must be
sent byte for byte as it was signed. ``X-Timestamp`` (Unix seconds) must be within 5
minutes of the bank's shared clock, which stops an old callback being replayed later.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any


def sign(secret: str, timestamp: int, body: bytes) -> str:
    message = f"{timestamp}.".encode() + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def signed_request(secret: str, payload: dict[str, Any], timestamp: int) -> tuple[bytes, dict]:
    """The body bytes and headers for a signed callback."""
    body = json.dumps(payload, separators=(",", ":")).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Timestamp": str(timestamp),
        "X-Signature": sign(secret, timestamp, body),
    }
    return body, headers
