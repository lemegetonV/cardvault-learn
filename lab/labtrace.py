"""A pytest plugin the lab loads to record what a test does, step by step.

The lab runs pytest with "-p labtrace" and gives it a pipe in LAB_TRACE_FD. While the
tests run, this plugin writes one JSON line per step to that pipe:

  {"type": "test", ...}      a test starts
  {"type": "http", ...}      one HTTP request and its response
  {"type": "db", ...}        one database query and the row it returned
  {"type": "topics", ...}    the topic list read from Kafka
  {"type": "event", ...}     an event the test waited for (or did not get)
  {"type": "assert", ...}    one assert line: the code, whether it held, and the values
  {"type": "outcome", ...}   how the test ended

It changes nothing about how the tests behave: it wraps the calls, records them, and
passes the results through. Secrets are hidden and long values are shortened.
"""

import json
import os
import re
import sys
import time
from urllib.parse import urlsplit

import pytest

SERVICES = {
    8001: "Auth",
    8002: "Cards",
    8003: "Wallet",
    8004: "Transactions",
    8005: "Profile",
    8101: "Wallet company simulator",
    8102: "Card network simulator",
}
MAX_TEXT = 6000
JWT = re.compile(r"eyJ[\w-]{6,}\.[\w-]{6,}\.[\w-]{6,}")
QUIET_RESPONSE_HEADERS = {"date", "server", "content-length", "connection"}

state = {"out": None, "phase": "setup"}


def emit(kind, **data):
    out = state["out"]
    if out is None:
        return
    try:
        out.write(json.dumps({"type": kind, "phase": state["phase"], **data}, default=str) + "\n")
        out.flush()
    except (OSError, ValueError):
        state["out"] = None  # the lab stopped listening; the tests carry on


def shorten(text):
    text = JWT.sub(lambda m: m.group(0)[:20] + "…", text)
    if len(text) > MAX_TEXT:
        text = text[:MAX_TEXT] + "\n… (shortened)"
    return text


def show_body(body, content_type):
    if body is None or body == b"" or body == "":
        return None
    if isinstance(body, bytes):
        if "json" in (content_type or "") or "text" in (content_type or ""):
            try:
                body = body.decode("utf-8")
            except UnicodeDecodeError:
                return f"({content_type or 'binary'}, {len(body)} bytes)"
        else:
            return f"({content_type or 'binary'}, {len(body)} bytes)"
    return shorten(body)


def show_request_headers(headers):
    shown = {}
    for name, value in headers.items():
        lower = name.lower()
        if lower in ("user-agent", "accept-encoding", "connection", "content-length"):
            continue
        if lower == "accept" and value == "*/*":
            continue
        if lower == "x-test-key":
            value = "(the test key, hidden)"
        elif lower == "authorization":
            value = shorten(value)
        shown[name] = value
    return shown


# ---------------------------------------------------------------- HTTP (requests)


def patch_requests():
    import requests

    original = requests.Session.send

    def send(self, request, **kwargs):
        started = time.monotonic()
        parts = urlsplit(request.url)
        record = {
            "method": request.method,
            "service": SERVICES.get(parts.port, parts.netloc),
            "path": parts.path + (f"?{parts.query}" if parts.query else ""),
            "request_headers": show_request_headers(request.headers),
            "request_body": show_body(request.body, request.headers.get("Content-Type", "")),
        }
        try:
            response = original(self, request, **kwargs)
        except Exception as error:
            emit("http", **record, error=f"{type(error).__name__}: {error}",
                 ms=round((time.monotonic() - started) * 1000))
            raise
        content_type = response.headers.get("Content-Type", "")
        emit(
            "http",
            **record,
            status=response.status_code,
            reason=response.reason,
            ms=round((time.monotonic() - started) * 1000),
            response_headers={k: v for k, v in response.headers.items()
                              if k.lower() not in QUIET_RESPONSE_HEADERS},
            response_body=show_body(response.content, content_type),
        )
        return response

    requests.Session.send = send


# ---------------------------------------------------------------- database.py and events.py


def jsonable(value):
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, str):
        return value if len(value) <= 80 else value[:80] + "…"
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)


def patch_database():
    try:
        import database
    except ImportError:
        return
    original = database.query_one

    def query_one(name, sql, values=()):
        started = time.monotonic()
        try:
            row = original(name, sql, values)
        except Exception as error:
            emit("db", database=name, sql=sql, values=[str(v) for v in values],
                 error=f"{type(error).__name__}: {error}")
            raise
        emit("db", database=name, sql=sql, values=[str(v) for v in values], row=jsonable(row),
             ms=round((time.monotonic() - started) * 1000))
        return row

    database.query_one = query_one


def patch_events():
    try:
        import events
    except ImportError:
        return
    watcher = events.EventWatcher
    original_init = watcher.__init__
    original_wait = watcher.wait_for
    original_topics = events.list_topics

    def init(self, topic):
        self._lab_topic = topic
        original_init(self, topic)
        emit("watch", topic=topic)

    def wait_for(self, field, value, timeout=10):
        started = time.monotonic()
        base = {"topic": getattr(self, "_lab_topic", "?"), "field": field, "value": str(value)}
        try:
            event = original_wait(self, field, value, timeout)
        except AssertionError:
            emit("event", **base, found=False, ms=round((time.monotonic() - started) * 1000))
            raise
        emit("event", **base, found=True, event=shorten(json.dumps(event, indent=2, default=str)),
             ms=round((time.monotonic() - started) * 1000))
        return event

    def list_topics():
        topics = original_topics()
        emit("topics", topics=sorted(topics))
        return topics

    watcher.__init__ = init
    watcher.wait_for = wait_for
    events.list_topics = list_topics


# ---------------------------------------------------------------- assert lines


def assert_values(explanation, brief=False):
    """pytest's explanation without "assert" in front: '200 == 200' plus any 'where' lines.

    brief keeps only those lines, for an assert that held: the full comparison of two
    equal values adds nothing there.
    """
    text = (explanation or "").strip()
    if text.startswith("assert "):
        text = text[len("assert "):]
    if brief:
        lines = text.splitlines()
        text = "\n".join(lines[:1] + [line for line in lines[1:] if re.match(r"\s*\+\s+where ", line)])
    return shorten(text)


def calling_file(lineno):
    """The file of the assert that just ran: the nearest frame outside pytest and this plugin."""
    frame = sys._getframe(1)
    while frame is not None:
        name = frame.f_code.co_filename
        if not any(part in name for part in ("/_pytest/", "/pluggy/", "labtrace.py")):
            return os.path.basename(name)
        frame = frame.f_back
    return "?"


def pytest_assertion_pass(item, lineno, orig, expl):
    # Called for every assert that held, when the lab passes
    # "-o enable_assertion_pass_hook=true". pytest gives the line, the code after
    # "assert", and the values it compared.
    emit("assert", passed=True, file=calling_file(lineno), line=lineno, code=f"assert {orig}",
         values=assert_values(expl, brief=True))


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    yield
    # An assert that did not hold: the last line in the traceback is the assert itself.
    if call.excinfo is None or not call.excinfo.errisinstance(AssertionError):
        return
    entry = call.excinfo.traceback[-1]
    try:
        code = str(entry.statement).strip()
    except Exception:  # noqa: BLE001  (no source available)
        code = ""
    if not code.startswith("assert"):
        code = ""
    message = str(call.excinfo.value)
    emit("assert", passed=False, file=entry.path.name if hasattr(entry.path, "name") else str(entry.path),
         line=entry.lineno + 1, code=code, values=assert_values(message))


# ---------------------------------------------------------------- pytest hooks


def pytest_configure(config):
    fd = os.getenv("LAB_TRACE_FD")
    if fd:
        state["out"] = os.fdopen(int(fd), "w", buffering=1)
    patch_requests()


def pytest_sessionstart(session):
    # By now pytest.ini has put the suite folder on the path, and no test file is imported
    # yet, so "from database import query_one" in a test picks up the recording version.
    patch_database()
    patch_events()


def pytest_runtest_logstart(nodeid, location):
    state["phase"] = "setup"
    emit("test", nodeid=nodeid)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_setup(item):
    state["phase"] = "setup"
    yield


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item):
    state["phase"] = "call"
    yield


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_teardown(item):
    state["phase"] = "teardown"
    yield


def pytest_runtest_logreport(report):
    # One outcome per test, sent after its tear-down, so calls a fixture makes while
    # cleaning up still belong to the test. The first phase that did not pass decides.
    reports = state.setdefault("reports", [])
    reports.append(report)
    if report.when != "teardown":
        return
    state["reports"] = []
    deciding = next((r for r in reports if not r.passed), None)
    if deciding is None:
        deciding = next((r for r in reports if r.when == "call"), report)
    message = None
    if deciding.failed:
        crash = getattr(deciding.longrepr, "reprcrash", None)
        message = crash.message if crash else str(deciding.longrepr)[-2000:]
    elif deciding.skipped and isinstance(deciding.longrepr, tuple):
        message = deciding.longrepr[2]
    emit("outcome", nodeid=report.nodeid, when=deciding.when, outcome=deciding.outcome,
         message=shorten(message) if message else None,
         seconds=round(sum(r.duration for r in reports), 2))
