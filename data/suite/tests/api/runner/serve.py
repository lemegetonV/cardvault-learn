"""A small web page that runs one part of the suite on the stage VM and shows pytest live.

The learning site's "Run on stage" buttons open ``/run?test=<node id>``. This server checks the
node id names a real test file, runs ``uv run pytest`` on it with ``TEST_ENV=vm`` (the stage
stack, reached from the VM itself), and streams the output into the page line by line.

It is a training tool for one person, so it stays simple:

- It listens on 127.0.0.1 only. Caddy publishes it with a password (basic auth); this file
  has no login of its own.
- One run at a time: stage is shared, and every run resets and reseeds it first.
- Standard library only, so it needs nothing beyond the suite's own environment.

Run it from ``tests/api``: ``python3 runner/serve.py`` (the systemd unit in this folder does).
"""

from __future__ import annotations

import html
import os
import re
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SUITE = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("RUNNER_PORT", "8790"))
RUN_TIMEOUT_SECONDS = 15 * 60
ONE_RUN = threading.Lock()

# A file under tests/, optionally one test in it, optionally one parametrised case.
NODE_ID = re.compile(r"^tests/[a-z0-9_/]+\.py(::[A-Za-z0-9_]+(\[[A-Za-z0-9_.:/\-]+\])?)?$")
MARKERS = {"lesson", "smoke"}

PAGE_HEAD = """<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><style>
:root {{ color-scheme: light dark; --bg:#f5f7f6; --ink:#15211c; --muted:#5f6d67; --code:#12201b;
  --code-ink:#dbe7e1; --pass:#8fd3a0; --fail:#f08a80; --warn:#f0c674; }}
body {{ margin:0; font:15px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--ink); }}
header {{ padding:16px 20px 8px; }} h1 {{ font-size:1.15rem; margin:0 0 4px; }}
p {{ margin:0 0 8px; color:var(--muted); }} code {{ font-family:ui-monospace, Menlo, monospace; }}
pre {{ margin:8px 20px 24px; padding:14px 16px; border-radius:12px; background:var(--code);
  color:var(--code-ink); font:13px/1.55 ui-monospace, Menlo, monospace; white-space:pre-wrap;
  overflow-wrap:anywhere; }}
.pass {{ color:var(--pass); }} .fail {{ color:var(--fail); font-weight:600; }}
.warn {{ color:var(--warn); }} .done {{ display:block; margin-top:10px; font-weight:600; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#0e1512; --ink:#e5ece8; --muted:#93a39c; }} }}
</style></head><body>"""


def css_class(line: str) -> str:
    if re.search(r"\bFAILED\b|\bERROR\b|^E\s", line):
        return "fail"
    if re.search(r"\bPASSED\b|\d+ passed", line) and "failed" not in line:
        return "pass"
    if re.search(r"\bSKIPPED\b|\bXFAIL\b|warning", line):
        return "warn"
    return ""


class Runner(BaseHTTPRequestHandler):
    server_version = "cardvault-runner"

    def do_GET(self) -> None:  # noqa: N802 (the name http.server expects)
        url = urlparse(self.path)
        if url.path in ("/", "/run"):
            query = parse_qs(url.query)
            self.run(query.get("test", [""])[0], query.get("m", [""])[0])
        elif url.path == "/health":
            self.reply(200, "text/plain", b"ok")
        else:
            self.reply(404, "text/plain", b"not found")

    def reply(self, status: int, kind: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", f"{kind}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def page(self, status: int, title: str, message: str) -> None:
        body = PAGE_HEAD.format(title=html.escape(title)) + (
            f"<header><h1>{html.escape(title)}</h1><p>{message}</p></header></body></html>"
        )
        self.reply(status, "text/html", body.encode())

    def run(self, test: str, marker: str) -> None:
        if marker:
            if marker not in MARKERS:
                return self.page(400, "Not a marker this page runs", "Use lesson or smoke.")
            args, label = ["-m", marker], f"-m {marker}"
        else:
            path = test.split("::")[0]
            if not NODE_ID.match(test) or not (SUITE / path).is_file():
                return self.page(
                    400,
                    "Not a test in the suite",
                    "Open this page from a Run on stage button, or pass "
                    "<code>?test=tests/&lt;area&gt;/test_&lt;name&gt;.py::test_&lt;name&gt;</code>.",
                )
            args, label = [test], test
        if not ONE_RUN.acquire(blocking=False):
            return self.page(
                409,
                "A run is already going",
                "Stage is shared and each run resets it, so runs go one at a time. "
                "Reload this page in a minute.",
            )
        try:
            self.stream(args, label)
        finally:
            ONE_RUN.release()

    def stream(self, args: list[str], label: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        command = ["uv", "run", "--frozen", "pytest", *args, "-v", "--color=no"]
        command += ["-p", "no:cacheprovider"]
        shown = html.escape(" ".join(command))
        head = PAGE_HEAD.format(title=f"Stage run · {html.escape(label)}") + (
            f"<header><h1>Running on stage</h1><p><code>TEST_ENV=vm {shown}</code></p>"
            "<p>Stage has known defects switched on, so a red result can be the test "
            "doing its job. The run resets and reseeds stage first.</p></header><pre>"
        )
        self.write(head)
        env = {**os.environ, "TEST_ENV": "vm", "PYTHONUNBUFFERED": "1"}
        process = subprocess.Popen(
            command, cwd=SUITE, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
        )
        timer = threading.Timer(RUN_TIMEOUT_SECONDS, process.kill)
        timer.start()
        try:
            for line in process.stdout:
                text = html.escape(line.rstrip("\n"))
                kind = css_class(line)
                self.write(f'<span class="{kind}">{text}</span>\n' if kind else f"{text}\n")
            code = process.wait()
        except (BrokenPipeError, ConnectionResetError):
            process.kill()  # the page was closed; stop the run
            return
        finally:
            timer.cancel()
        verdict = {0: "All passed.", 1: "Some tests failed.", 5: "No tests were selected."}
        outcome = verdict.get(code, f"pytest exit code {code}")
        self.write(f'<span class="done">Finished: {outcome}</span></pre></body></html>')

    def write(self, text: str) -> None:
        self.wfile.write(text.encode())
        self.wfile.flush()

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    print(f"runner: http://127.0.0.1:{PORT}/run?test=... (suite at {SUITE})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Runner).serve_forever()
