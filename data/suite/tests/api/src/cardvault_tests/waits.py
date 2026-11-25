"""Waiting for things that happen later, without sleeping for a guessed time.

CardVault finishes some work after the response: callbacks, events, the outbox relay. A test
that sleeps for "long enough" is slow when the system is fast and flaky when it is slow.
``wait_until`` asks again every ``interval`` seconds until the answer is right or the
``timeout`` runs out, then fails with the last answer it saw.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


class WaitTimeout(AssertionError):
    pass


def wait_until(
    probe: Callable[[], T],
    done: Callable[[T], bool],
    *,
    timeout: float = 15.0,
    interval: float = 0.25,
    what: str = "condition",
) -> T:
    """Call ``probe()`` until ``done(result)`` is true; return that result."""
    deadline = time.monotonic() + timeout
    last: T | None = None
    while True:
        last = probe()
        if done(last):
            return last
        if time.monotonic() >= deadline:
            raise WaitTimeout(f"{what} not reached within {timeout}s; last value: {last!r}")
        time.sleep(interval)
