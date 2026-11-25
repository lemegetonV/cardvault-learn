"""Assertion helpers that turn a raw response into a clear pass or a clear failure.

Each helper fails with the method, URL, status and body of the response, so the reason is
on screen without re-running the test.
"""

from __future__ import annotations

import re
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from cardvault_tests.models import ErrorBody

M = TypeVar("M", bound=BaseModel)


def describe(resp: httpx.Response) -> str:
    return f"{resp.request.method} {resp.request.url} -> {resp.status_code}: {resp.text[:500]}"


def expect(resp: httpx.Response, status: int, model: type[M]) -> M:
    """Assert the status, then parse the body into ``model`` (which checks its shape)."""
    assert resp.status_code == status, f"expected {status}, got {describe(resp)}"
    try:
        return model.model_validate(resp.json())
    except ValidationError as exc:
        raise AssertionError(
            f"body does not match {model.__name__}: {exc}\n{describe(resp)}"
        ) from None


def expect_status(resp: httpx.Response, status: int) -> httpx.Response:
    assert resp.status_code == status, f"expected {status}, got {describe(resp)}"
    return resp


def expect_error(resp: httpx.Response, status: int, error_code: str) -> ErrorBody:
    """Assert CardVault's error shape: the status, the ``error_code``, and a correlation ID
    equal to the one the request carried (so the failure can be found in the logs)."""
    body = expect(resp, status, ErrorBody)
    assert body.error_code == error_code, f"expected {error_code}, got {describe(resp)}"
    sent = resp.request.headers.get("X-Correlation-ID")
    assert body.correlation_id == sent, (
        f"error correlation_id {body.correlation_id!r} != request's {sent!r}"
    )
    return body


# A card number (PAN) is 13 to 19 digits standing on their own, whose last digit is the
# Luhn check digit. Digits inside a longer ID (a hex trace ID, a UUID) are not a PAN, and
# the Luhn test removes most chance matches such as timestamps.
_DIGIT_RUN = re.compile(r"(?<![0-9A-Za-z])\d{13,19}(?![0-9A-Za-z])")


def luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 1:
            d = d * 2 - 9 if d > 4 else d * 2
        total += d
    return total % 10 == 0


def pan_like(text: str | bytes) -> list[str]:
    """Every value in ``text`` that could be a card number."""
    if isinstance(text, bytes):
        text = text.decode("utf-8", "replace")
    return [m for m in _DIGIT_RUN.findall(text) if luhn_ok(m)]
