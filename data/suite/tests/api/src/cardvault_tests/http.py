"""One configured ``httpx.Client`` per service, and the evidence it collects.

Every request the suite sends:

* carries a fresh ``X-Correlation-ID`` (``t-`` plus 12 hex digits), so a failing call can
  be found in ``docker compose logs`` on any service it touched;
* is recorded (method, URL, status, correlation ID, a short body) in the current test's
  exchange log, which ``conftest.py`` prints under a failed test;
* is attached to the Allure report when the run writes one.

Request and response bodies in the evidence are cut to 2,000 characters. CardVault never
returns a full card number, and the suite never logs credentials it sends (passwords and
keys live in headers or login bodies, which are masked below).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field

import allure
import httpx

MAX_BODY = 2_000
MASKED_HEADERS = {"authorization", "x-test-key", "x-service-key", "x-signature"}
MASKED_FIELDS = {"password", "refresh_token", "access_token"}


@dataclass
class Exchange:
    method: str
    url: str
    status: int
    correlation_id: str
    request_body: str
    response_body: str

    def line(self) -> str:
        return (
            f"{self.method} {self.url} -> {self.status}  [X-Correlation-ID: {self.correlation_id}]"
        )


@dataclass
class ExchangeLog:
    """The exchanges of the test that is running now. Reset by an autouse fixture."""

    items: list[Exchange] = field(default_factory=list)

    def clear(self) -> None:
        self.items.clear()

    def report(self) -> str:
        blocks = []
        for ex in self.items:
            blocks.append(ex.line())
            if ex.request_body:
                blocks.append(f"  request:  {ex.request_body}")
            blocks.append(f"  response: {ex.response_body}")
        return "\n".join(blocks)


exchanges = ExchangeLog()


def new_correlation_id() -> str:
    return f"t-{uuid.uuid4().hex[:12]}"


def _mask_json(text: str) -> str:
    try:
        data = json.loads(text)
    except ValueError:
        return text
    if isinstance(data, dict):
        data = {k: ("***" if k in MASKED_FIELDS else v) for k, v in data.items()}
    return json.dumps(data)


def _short(text: str) -> str:
    return text if len(text) <= MAX_BODY else text[:MAX_BODY] + f"... ({len(text)} chars)"


def _body_text(content: bytes, content_type: str) -> str:
    if not content:
        return ""
    if "json" in content_type or "text" in content_type or "csv" in content_type:
        return _short(_mask_json(content.decode("utf-8", "replace")))
    return f"<{len(content)} bytes of {content_type or 'binary'}>"


def _request_body(request: httpx.Request) -> str:
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/"):
        # A multipart upload is streamed, so its bytes are not kept; its size is enough.
        return f"<multipart form, {request.headers.get('content-length', '?')} bytes>"
    return _body_text(request.content, content_type)


def _add_correlation_id(request: httpx.Request) -> None:
    request.headers.setdefault("X-Correlation-ID", new_correlation_id())


def _record(response: httpx.Response) -> None:
    response.read()
    request = response.request
    ex = Exchange(
        method=request.method,
        url=str(request.url),
        status=response.status_code,
        correlation_id=request.headers.get("X-Correlation-ID", ""),
        request_body=_request_body(request),
        response_body=_body_text(response.content, response.headers.get("content-type", "")),
    )
    exchanges.items.append(ex)
    headers = {k: ("***" if k.lower() in MASKED_HEADERS else v) for k, v in request.headers.items()}
    allure.attach(
        "\n".join(
            [
                ex.line(),
                "",
                "request headers: " + json.dumps(headers),
                "request body: " + (ex.request_body or "(none)"),
                "",
                "response headers: " + json.dumps(dict(response.headers)),
                "response body: " + (ex.response_body or "(none)"),
            ]
        ),
        name=f"{ex.method} {request.url.path} -> {ex.status}",
        attachment_type=allure.attachment_type.TEXT,
    )


def make_client(base_url: str, timeout: float, record: bool = True) -> httpx.Client:
    """An httpx client for one service: base URL, a timeout on every call, evidence hooks.

    ``record=False`` is for calls made outside any test (preparing the run), where there is
    no test to attach evidence to.
    """
    return httpx.Client(
        base_url=base_url,
        timeout=timeout,
        event_hooks={"request": [_add_correlation_id], "response": [_record] if record else []},
    )
