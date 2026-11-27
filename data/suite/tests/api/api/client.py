"""The one HTTP session every API class uses, with a log line for each call.

requests.Session works like requests.get and requests.post, with two extras:
  - it keeps connections to a service open between calls, so tests run faster;
  - it can run a function after every response. Here log_call writes the call
    to the log, and pytest shows that log under any test that fails. In an Allure
    report, each call also becomes a step with the request and response attached.

So when a test fails, you see every request it sent and every answer it got.
"""

import logging
import re

import allure
import requests

log = logging.getLogger("api")

# A token or password in a log is a secret anyone with the log could use, so hide them.
TOKENS = re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]+|rt_[\w-]{10,}")
PASSWORDS = re.compile(r'("password"\s*:\s*")[^"]*')


def hide_secrets(text):
    text = TOKENS.sub("<token hidden>", text)
    return PASSWORDS.sub(r"\1<hidden>", text)


def log_call(response, *args, **kwargs):
    """requests calls this after every response (it is a "hook")."""
    request = response.request
    milliseconds = round(response.elapsed.total_seconds() * 1000)
    title = f"{request.method} {request.url} -> {response.status_code} in {milliseconds} ms"
    sent = describe_body(request)
    got = hide_secrets(response.text) if "json" in response.headers.get("Content-Type", "") else ""

    log.info(title)
    if sent:
        log.info(f"  sent: {sent[:500]}")
    if got:
        log.info(f"  got:  {got[:500]}")

    # Without --alluredir these do nothing, so plain pytest runs are not affected.
    with allure.step(title):
        if sent:
            allure.attach(sent, name="request body", attachment_type=allure.attachment_type.TEXT)
        if got:
            allure.attach(got, name="response body", attachment_type=allure.attachment_type.JSON)


def describe_body(request):
    """The body a request sent, as text with secrets hidden ("" if there was none)."""
    body = request.body
    if isinstance(body, bytes) and "json" in request.headers.get("Content-Type", ""):
        body = body.decode()  # a JSON body is text, sent as bytes
    if isinstance(body, str):
        return hide_secrets(body)
    if body:
        return f"{len(body)} bytes (a file upload)"
    return ""


http = requests.Session()
http.hooks["response"].append(log_call)
