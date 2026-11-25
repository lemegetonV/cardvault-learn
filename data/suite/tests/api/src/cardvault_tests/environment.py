"""Getting the environment ready before the first test: wait, then reset and reseed.

This runs once per run, on the pytest controller (before any xdist worker starts). It is the
suite's version of ``make reset``: reset every service and mock, clear the clock offset,
then load the deterministic seed data.
"""

from __future__ import annotations

import time

import httpx

from cardvault_tests.clients.control import ServiceControl


class EnvironmentNotReady(RuntimeError):
    pass


def wait_until_ready(controls: dict[str, ServiceControl], timeout: float) -> None:
    deadline = time.monotonic() + timeout
    waiting = dict(controls)
    last: dict[str, str] = {}
    while waiting:
        for name, control in list(waiting.items()):
            try:
                resp = control.ready()
                if resp.status_code == 200:
                    del waiting[name]
                    continue
                last[name] = f"{resp.status_code} {resp.text[:200]}"
            except httpx.HTTPError as exc:
                last[name] = f"{type(exc).__name__}: {exc}"
        if waiting and time.monotonic() > deadline:
            detail = "\n".join(f"  {n}: {last.get(n, '?')}" for n in waiting)
            raise EnvironmentNotReady(
                f"Not ready after {timeout:.0f}s:\n{detail}\n"
                "Start the stack first (make up && make seed), or open the stage tunnel."
            )
        if waiting:
            time.sleep(1)


def reset_and_seed(controls: dict[str, ServiceControl]) -> None:
    for name, control in controls.items():
        _ok(control.reset(), f"reset {name}")
    _ok(next(iter(controls.values())).set_clock(reset=True), "clear the clock offset")
    for name, control in controls.items():
        _ok(control.seed(), f"seed {name}")


def _ok(resp: httpx.Response, what: str) -> None:
    if resp.status_code != 200:
        raise EnvironmentNotReady(f"{what} failed: {resp.status_code} {resp.text[:300]}")
