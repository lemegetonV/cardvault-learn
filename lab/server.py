"""The live lab: lets the learning site talk to a running CardVault.

It runs on the machine that hosts CardVault, listens on 127.0.0.1 only, and sits
behind a password-protected reverse proxy. The site's Worker forwards /vm/* here.
Standard library only, so it needs nothing installed.

  GET  /vm/health         is each service up?
  POST /vm/request        send one customer API request, get the response back
  POST /vm/reset          put every service back to its starting data
  GET  /vm/tests          the tests the runner can run
  POST /vm/run            run one test (or one file) and stream pytest's output
  POST /vm/trace          the same run, streamed as JSON lines: each API call, database
                          query and event the tests make (from labtrace.py), plus the output

Settings (environment variables):
  CARDVAULT_DIR   the CardVault checkout that runs the stack (for scripts/reset.sh and .env)
  SUITE_DIR       the folder that holds the API suite (tests/api of a CardVault checkout)
  SUITE_PYTHON    the Python that has the suite's requirements installed
  LAB_PORT        default 8790
"""

import json
import os
import queue
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

CARDVAULT_DIR = Path(os.getenv("CARDVAULT_DIR", "/opt/cardvault"))
SUITE_DIR = Path(os.getenv("SUITE_DIR", "/opt/cardvault-suite/tests/api"))
SUITE_PYTHON = os.getenv("SUITE_PYTHON", str(SUITE_DIR / ".venv/bin/python"))
PORT = int(os.getenv("LAB_PORT", "8790"))
LAB_DIR = Path(__file__).resolve().parent

# The customer-facing services, by the name the site uses.
SERVICES = {
    "auth": "http://127.0.0.1:8001",
    "cards": "http://127.0.0.1:8002",
    "wallet": "http://127.0.0.1:8003",
    "transactions": "http://127.0.0.1:8004",
    "profile": "http://127.0.0.1:8005",
}
METHODS = {"GET", "POST", "PATCH", "PUT", "DELETE"}
REQUEST_HEADERS = {"authorization", "content-type", "accept", "idempotency-key", "if-match"}
MAX_BODY = 64 * 1024
MAX_RESPONSE = 256 * 1024
RUN_TIMEOUT = 180

# One reset or test run at a time, so they never trip over each other.
busy = threading.Lock()
tests_cache = {"ids": None}


def read_env_file(path):
    values = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip()
    return values


def path_allowed(path):
    """Only the public customer API: no test, internal or callback endpoints."""
    if not path.startswith("/") or ".." in path or "\\" in path or "//" in path:
        return False
    plain = path.split("?", 1)[0]
    if plain in ("/health", "/.well-known/jwks.json"):
        return True
    if not plain.startswith("/v1/"):
        return False
    return not plain.startswith(("/v1/test", "/v1/callbacks", "/v1/internal"))


def suite_env():
    """Point the suite at this machine's services, database and Kafka, with its keys."""
    env = dict(os.environ)
    stack_env = read_env_file(CARDVAULT_DIR / ".env")
    env.update(
        AUTH_URL=SERVICES["auth"],
        CARD_URL=SERVICES["cards"],
        WALLET_URL=SERVICES["wallet"],
        TRANSACTIONS_URL=SERVICES["transactions"],
        PROFILE_URL=SERVICES["profile"],
        CARD_NETWORK_URL="http://127.0.0.1:8102",
        DB_HOST="127.0.0.1",
        DB_PORT="5432",
        KAFKA_BOOTSTRAP="127.0.0.1:19092",
        PYTHONDONTWRITEBYTECODE="1",
    )
    if stack_env.get("TEST_KEY"):
        env["TEST_KEY"] = stack_env["TEST_KEY"]
    if stack_env.get("READONLY_DB_PASSWORD"):
        env["DB_READONLY_PASSWORD"] = stack_env["READONLY_DB_PASSWORD"]
    return env


def collect_tests():
    if tests_cache["ids"] is None:
        result = subprocess.run(
            [SUITE_PYTHON, "-m", "pytest", "--collect-only", "-qq", "-p", "no:cacheprovider"],
            cwd=SUITE_DIR, env=suite_env(), capture_output=True, text=True, timeout=60,
        )
        ids = [line.strip() for line in result.stdout.splitlines() if "::" in line]
        tests_cache["ids"] = ids
    return tests_cache["ids"]


def runnable(node_id):
    """A file, a test, or a parametrized test with all its cases."""
    ids = collect_tests()
    files = {i.split("::", 1)[0] for i in ids}
    functions = {i.split("[", 1)[0] for i in ids}
    return node_id in ids or node_id in files or node_id in functions


class Handler(BaseHTTPRequestHandler):
    server_version = "cardvault-lab"

    def log_message(self, fmt, *args):
        # Keep request lines, never bodies (they can hold tokens).
        print(f"{self.address_string()} {fmt % args}", flush=True)

    # ---- helpers ----
    def send_json(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("request too large")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw or b"{}")

    # ---- routes ----
    def do_GET(self):
        if self.path == "/vm/health":
            return self.health()
        if self.path == "/vm/tests":
            return self.send_json(200, {"tests": collect_tests()})
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        try:
            body = self.read_json()
        except (ValueError, json.JSONDecodeError) as e:
            return self.send_json(400, {"error": f"bad request: {e}"})
        if self.path == "/vm/request":
            return self.forward(body)
        if self.path == "/vm/reset":
            return self.reset()
        if self.path == "/vm/run":
            return self.run_test(body)
        if self.path == "/vm/trace":
            return self.run_trace(body)
        self.send_json(404, {"error": "not found"})

    def health(self):
        status = {}
        for name, base in SERVICES.items():
            try:
                with urllib.request.urlopen(base + "/health", timeout=3) as r:
                    status[name] = "up" if r.status == 200 else f"status {r.status}"
            except Exception:
                status[name] = "down"
        self.send_json(200, {"services": status, "busy": busy.locked()})

    def forward(self, req):
        service = req.get("service")
        method = str(req.get("method", "")).upper()
        path = str(req.get("path", ""))
        if service not in SERVICES:
            return self.send_json(400, {"error": f"unknown service {service!r}"})
        if method not in METHODS:
            return self.send_json(400, {"error": f"method {method!r} is not allowed"})
        if not path_allowed(path):
            return self.send_json(400, {"error": "only the customer API (paths under /v1/) can be called"})
        headers = {}
        for name, value in (req.get("headers") or {}).items():
            if name.lower() in REQUEST_HEADERS and isinstance(value, str):
                headers[name] = value
        body = req.get("body")
        data = body.encode() if isinstance(body, str) and body != "" else None
        if data is not None and len(data) > MAX_BODY:
            return self.send_json(400, {"error": "request body too large"})
        if data is not None and not any(h.lower() == "content-type" for h in headers):
            headers["Content-Type"] = "application/json"

        outgoing = urllib.request.Request(SERVICES[service] + path, data=data, method=method, headers=headers)
        started = time.monotonic()
        try:
            response = urllib.request.urlopen(outgoing, timeout=15)
        except urllib.error.HTTPError as e:
            response = e  # 4xx and 5xx still carry a status, headers and a body
        except Exception as e:
            return self.send_json(502, {"error": f"the service did not answer: {e}"})
        with response:
            raw = response.read(MAX_RESPONSE + 1)
            elapsed = round((time.monotonic() - started) * 1000)
            self.send_json(200, {
                "status": response.status,
                "reason": response.reason,
                "headers": dict(response.headers.items()),
                "body": raw[:MAX_RESPONSE].decode("utf-8", "replace"),
                "truncated": len(raw) > MAX_RESPONSE,
                "ms": elapsed,
            })

    def reset(self):
        if not busy.acquire(blocking=False):
            return self.send_json(409, {"error": "a reset or test run is already in progress"})
        try:
            result = subprocess.run(
                [str(CARDVAULT_DIR / "scripts/reset.sh")], cwd=CARDVAULT_DIR,
                capture_output=True, text=True, timeout=120,
            )
            ok = result.returncode == 0
            self.send_json(200 if ok else 500, {"ok": ok, "output": (result.stdout + result.stderr)[-4000:]})
        except subprocess.TimeoutExpired:
            self.send_json(500, {"ok": False, "output": "reset took longer than 2 minutes"})
        finally:
            busy.release()

    def run_test(self, req):
        node_id = str(req.get("node_id", ""))
        if not runnable(node_id):
            return self.send_json(400, {"error": f"{node_id!r} is not a test in the suite"})
        if not busy.acquire(blocking=False):
            return self.send_json(409, {"error": "another test run or a reset is in progress, try again shortly"})
        process = None
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Connection", "close")
            self.end_headers()
            command = [SUITE_PYTHON, "-m", "pytest", node_id, "--tb=short", "--color=no",
                       "-p", "no:cacheprovider"]
            self.wfile.write(f"$ pytest {node_id}\n".encode())
            self.wfile.flush()
            process = subprocess.Popen(command, cwd=SUITE_DIR, env=suite_env(),
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            timer = threading.Timer(RUN_TIMEOUT, process.kill)
            timer.start()
            try:
                for line in process.stdout:
                    self.wfile.write(line)
                    self.wfile.flush()
                process.wait()
            finally:
                timer.cancel()
        except (BrokenPipeError, ConnectionResetError):
            if process and process.poll() is None:
                process.kill()  # the page was closed mid-run
        finally:
            self.close_connection = True
            busy.release()


    def run_trace(self, req):
        """Run a test with labtrace.py and stream every step as one JSON object per line."""
        node_id = str(req.get("node_id", ""))
        if not runnable(node_id):
            return self.send_json(400, {"error": f"{node_id!r} is not a test in the suite"})
        if not busy.acquire(blocking=False):
            return self.send_json(409, {"error": "another test run or a reset is in progress, try again shortly"})
        process = None
        read_end, write_end = os.pipe()
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Connection", "close")
            self.end_headers()
            env = suite_env()
            env["PYTHONPATH"] = str(LAB_DIR)
            env["LAB_TRACE_FD"] = str(write_end)
            command = [SUITE_PYTHON, "-m", "pytest", node_id, "--tb=short", "--color=no",
                       "-p", "no:cacheprovider", "-p", "labtrace"]
            process = subprocess.Popen(command, cwd=SUITE_DIR, env=env, pass_fds=(write_end,),
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            os.close(write_end)
            write_end = None
            lines = queue.Queue()

            def pump(stream, kind):
                for raw in stream:
                    text = raw.decode("utf-8", "replace").rstrip("\n")
                    lines.put(text if kind == "trace" else json.dumps({"type": "log", "line": text}))
                lines.put(None)

            trace_stream = os.fdopen(read_end, "rb")
            read_end = None
            for stream, kind in ((process.stdout, "log"), (trace_stream, "trace")):
                threading.Thread(target=pump, args=(stream, kind), daemon=True).start()
            timer = threading.Timer(RUN_TIMEOUT, process.kill)
            timer.start()
            try:
                self.send_line(json.dumps({"type": "start", "node_id": node_id}))
                open_streams = 2
                while open_streams:
                    line = lines.get()
                    if line is None:
                        open_streams -= 1
                    elif line.strip():
                        self.send_line(line)
                process.wait()
                self.send_line(json.dumps({"type": "done", "exit_code": process.returncode}))
            finally:
                timer.cancel()
                trace_stream.close()
        except (BrokenPipeError, ConnectionResetError):
            if process and process.poll() is None:
                process.kill()  # the page was closed mid-run
        finally:
            for fd in (read_end, write_end):
                if fd is not None:
                    os.close(fd)
            self.close_connection = True
            busy.release()

    def send_line(self, line):
        self.wfile.write(line.encode() + b"\n")
        self.wfile.flush()


if __name__ == "__main__":
    print(f"CardVault lab on 127.0.0.1:{PORT}, suite in {SUITE_DIR}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
