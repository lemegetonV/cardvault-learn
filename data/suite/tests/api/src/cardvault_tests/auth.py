"""The three ways a caller proves who it is to CardVault, as ``httpx.Auth`` classes.

An ``httpx.Auth`` adds credentials to each request just before it is sent, so clients never
build headers by hand and a test can swap one caller for another by changing the auth.

* ``BearerAuth``: a customer's access token (``Authorization: Bearer <jwt>``).
* ``ServiceKeyAuth``: a machine caller's ``X-Service-Key`` (internal endpoints).
* ``TestKeyAuth``: the ``X-Test-Key`` that opens the ``/test/*`` controls (TEST_MODE only).
"""

from __future__ import annotations

from collections.abc import Generator

import httpx


class BearerAuth(httpx.Auth):
    """Sends ``Authorization: Bearer <token>``. ``token`` can be replaced after a refresh."""

    def __init__(self, token: str) -> None:
        self.token = token

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request


class HeaderAuth(httpx.Auth):
    """Sends one fixed header. The base for the two key-based callers."""

    header = ""

    def __init__(self, key: str) -> None:
        self.key = key

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers[self.header] = self.key
        yield request


class ServiceKeyAuth(HeaderAuth):
    header = "X-Service-Key"


class TestKeyAuth(HeaderAuth):
    __test__ = False  # not a test class, despite the name
    header = "X-Test-Key"
