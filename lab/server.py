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
  GET  /vm/ui-tests       the Playwright tests the runner can run
  POST /vm/ui-trace       run one Playwright test (or file) in a headless browser, streamed as
                          JSON lines: each action and expect() check (from pw-reporter.cjs), then
                          the screenshot, video and trace it recorded
  GET  /vm/ui-files/...   a file from one of the last few Playwright runs (screenshot, video,
                          trace, and the HTML report with its trace viewer)
  POST /vm/perf           run the suite's Locust load test, small and fixed (5 users for
                          20 seconds), streamed as JSON lines: the running totals every
                          few seconds, then the final results per kind of request

Settings (environment variables):
  CARDVAULT_DIR   the CardVault checkout that runs the stack (for scripts/reset.sh and .env)
  SUITE_DIR       the folder that holds the API suite (tests/api of a CardVault checkout)
  SUITE_PYTHON    the Python that has the suite's requirements installed
  UI_DIR          the folder that holds the Playwright suite (tests/ui, with node_modules)
  UI_BASE_URL     the web app the Playwright tests open (default http://127.0.0.1:3000)
  LAB_PORT        default 8790
"""

import json
import mimetypes
import os
import shutil
import queue
import re
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

CARDVAULT_DIR = Path(os.getenv("CARDVAULT_DIR", "/opt/cardvault"))
SUITE_DIR = Path(os.getenv("SUITE_DIR", "/opt/cardvault-suite/tests/api"))
SUITE_PYTHON = os.getenv("SUITE_PYTHON", str(SUITE_DIR / ".venv/bin/python"))
UI_DIR = Path(os.getenv("UI_DIR", "/opt/cardvault-suite/tests/ui"))
UI_BASE_URL = os.getenv("UI_BASE_URL", "http://127.0.0.1:3000")
UI_RUNS = Path(tempfile.gettempdir()) / "cardvault-lab-ui"
UI_KEEP_RUNS = 6
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

# The load test is fixed and small, because the server is shared. The page cannot change it.
LOCUSTFILE = SUITE_DIR.parent / "perf" / "locustfile.py"
PERF_USERS = 5
PERF_SECONDS = 20

# One reset or test run at a time, so they never trip over each other.
busy = threading.Lock()
tests_cache = {"ids": None, "ui": None}


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


def ui_env(run_dir):
    """The Playwright suite's settings: the web app, the services and the test key."""
    env = suite_env()
    env.update(
        BASE_URL=UI_BASE_URL,
        CARDS_URL=SERVICES["cards"],
        UI_DIR=str(UI_DIR),
        LAB_RUN_DIR=str(run_dir),
        PLAYWRIGHT_HTML_OPEN="never",
        FORCE_COLOR="0",
    )
    return env


def ui_command(*args):
    return [str(UI_DIR / "node_modules/.bin/playwright"), "test",
            "--config", str(LAB_DIR / "playwright.lab.config.cjs"), *args]


# The projects the site can run. The visual tests need the Playwright Docker image, and the
# phone project repeats framework tests, so neither is offered.
UI_PROJECTS = {"setup", "learn", "framework"}


def collect_ui_tests():
    """Every Playwright test as "file:line", with its project and title."""
    if tests_cache["ui"] is None:
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run(ui_command("--list", "--reporter=json"), cwd=UI_DIR,
                                    env=ui_env(folder), capture_output=True, text=True, timeout=90)
        tests = {}

        def walk(suite):
            for spec in suite.get("specs", []):
                for test in spec.get("tests", []):
                    if test.get("projectName") in UI_PROJECTS:
                        tests[f"{spec['file']}:{spec['line']}"] = {
                            "project": test["projectName"], "title": spec["title"]}
            for child in suite.get("suites", []):
                walk(child)

        try:
            for suite in json.loads(result.stdout).get("suites", []):
                walk(suite)
        except json.JSONDecodeError:
            return {}
        tests_cache["ui"] = tests
    return tests_cache["ui"]


def ui_target(node_id):
    """The project for a test ("learn/locators.spec.ts:28") or file, or None if not runnable."""
    tests = collect_ui_tests()
    if node_id in tests:
        return tests[node_id]["project"]
    projects = {t["project"] for key, t in tests.items() if key.rsplit(":", 1)[0] == node_id}
    return projects.pop() if len(projects) == 1 else None


def new_ui_run_dir():
    """A fresh folder for one run's results. Only the last few runs are kept."""
    UI_RUNS.mkdir(parents=True, exist_ok=True)
    runs = sorted(UI_RUNS.iterdir(), key=lambda p: p.stat().st_mtime)
    for old in runs[:-(UI_KEEP_RUNS - 1)] if len(runs) >= UI_KEEP_RUNS else []:
        shutil.rmtree(old, ignore_errors=True)
    run_id = time.strftime("%Y%m%d-%H%M%S") + "-" + os.urandom(3).hex()
    folder = UI_RUNS / run_id
    folder.mkdir()
    return run_id, folder


def runnable(node_id):
    """A file, a test, or a parametrized test with all its cases."""
    ids = collect_tests()
    files = {i.split("::", 1)[0] for i in ids}
    functions = {i.split("[", 1)[0] for i in ids}
    return node_id in ids or node_id in files or node_id in functions


# Locust prints a table every few seconds. Its last line holds the totals so far:
#          Aggregated     58     0(0.00%) |     14       5     123      8 |    2.92        0.00
AGGREGATED = re.compile(
    r"^\s+Aggregated\s+(?P<requests>\d+)\s+(?P<failures>\d+)\([^)]*\)\s+\|"
    r"\s+\d+\s+\d+\s+\d+\s+(?P<median>\d+)\s+\|\s+(?P<rps>[\d.]+)"
)
TABLE_START = ("Type ", "--------", "GET ", "POST ", "PATCH ", "PUT ", "DELETE ",
               "Response time percentiles", "Error report", "# occurrences")


def is_table_line(line):
    return line.startswith(TABLE_START) or line.startswith(" " * 9)


def percentile(response_times, share):
    """response_times maps a time in ms to how many requests took it (Locust's own rounding)."""
    total = sum(response_times.values())
    if not total:
        return None
    seen = 0
    for ms in sorted(response_times):
        seen += response_times[ms]
        if seen >= total * share:
            return round(ms)
    return round(max(response_times))


def final_stats(path):
    """Locust's final results, one row per kind of request plus a row for all of them."""
    if not path.exists():
        return []
    entries = json.loads(path.read_text())
    rows = []
    together = {"requests": 0, "failures": 0, "max": 0, "times": {}}
    for entry in entries:
        times = {float(ms): count for ms, count in entry["response_times"].items()}
        rows.append({
            "method": entry["method"],
            "name": entry["name"],
            "requests": entry["num_requests"],
            "failures": entry["num_failures"],
            "median": percentile(times, 0.5),
            "p95": percentile(times, 0.95),
            "max": round(entry["max_response_time"] or 0),
        })
        together["requests"] += entry["num_requests"]
        together["failures"] += entry["num_failures"]
        together["max"] = max(together["max"], rows[-1]["max"])
        for ms, count in times.items():
            together["times"][ms] = together["times"].get(ms, 0) + count
    rows.append({
        "method": "",
        "name": "All requests",
        "requests": together["requests"],
        "failures": together["failures"],
        "median": percentile(together["times"], 0.5),
        "p95": percentile(together["times"], 0.95),
        "max": together["max"],
    })
    return rows


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
        if self.path == "/vm/ui-tests":
            return self.send_json(200, {"tests": collect_ui_tests()})
        if self.path.startswith("/vm/ui-files/"):
            return self.ui_file(self.path[len("/vm/ui-files/"):])
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
        if self.path == "/vm/ui-trace":
            return self.run_ui_trace(body)
        if self.path == "/vm/perf":
            return self.run_perf()
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
        env = suite_env()
        env["PYTHONPATH"] = str(LAB_DIR)
        # The pass hook only sees asserts that pytest rewrote with the hook switched on,
        # so keep those rewritten files in a cache of the lab's own.
        env["PYTHONPYCACHEPREFIX"] = str(Path(tempfile.gettempdir()) / "cardvault-lab-pycache")
        command = [SUITE_PYTHON, "-m", "pytest", node_id, "--tb=short", "--color=no",
                   "-p", "no:cacheprovider", "-p", "labtrace",
                   "-o", "enable_assertion_pass_hook=true"]
        self.stream_traced_run(command, SUITE_DIR, env, {"node_id": node_id})

    def run_ui_trace(self, req):
        """Run a Playwright test with pw-reporter.cjs and stream every step as JSON lines."""
        node_id = str(req.get("node_id", ""))
        if not (UI_DIR / "node_modules").exists():
            return self.send_json(404, {"error": "the Playwright suite is not installed on this server"})
        project = ui_target(node_id)
        if project is None:
            return self.send_json(400, {"error": f"{node_id!r} is not a Playwright test the lab can run"})
        run_id, run_dir = new_ui_run_dir()
        command = ui_command(node_id, f"--project={project}")
        self.stream_traced_run(command, UI_DIR, ui_env(run_dir),
                               {"node_id": node_id, "project": project, "run": run_id},
                               {"run": run_id, "report": f"/vm/ui-files/{run_id}/report/index.html"})

    def stream_traced_run(self, command, cwd, env, start, done=None):
        """Run a command that writes JSON lines to LAB_TRACE_FD; stream them with its output."""
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
            env["LAB_TRACE_FD"] = str(write_end)
            process = subprocess.Popen(command, cwd=cwd, env=env, pass_fds=(write_end,),
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
                self.send_line(json.dumps({"type": "start", **start}))
                open_streams = 2
                while open_streams:
                    line = lines.get()
                    if line is None:
                        open_streams -= 1
                    elif line.strip():
                        self.send_line(line)
                process.wait()
                self.send_line(json.dumps({"type": "done", "exit_code": process.returncode, **(done or {})}))
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

    def ui_file(self, rest):
        """Serve one file of a recent Playwright run, and nothing outside that run's folder."""
        rest = rest.split("?", 1)[0]
        run_id, _, inner = rest.partition("/")
        if not re.fullmatch(r"\d{8}-\d{6}-[0-9a-f]{6}", run_id) or not inner:
            return self.send_json(404, {"error": "not found"})
        base = (UI_RUNS / run_id).resolve()
        target = (base / inner).resolve()
        if base not in target.parents or not target.is_file():
            return self.send_json(404, {"error": "that file is not there any more; run the test again"})
        kind = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if target.suffix == ".webmanifest":
            kind = "application/manifest+json"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(target.stat().st_size))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        with target.open("rb") as f:
            shutil.copyfileobj(f, self.wfile)

    def run_perf(self):
        """Run the Locust load test and stream progress and results as JSON lines."""
        if not LOCUSTFILE.exists():
            return self.send_json(404, {"error": "the load test is not installed on this server"})
        if not busy.acquire(blocking=False):
            return self.send_json(409, {"error": "another test run or a reset is in progress, try again shortly"})
        process = None
        try:
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Accel-Buffering", "no")
            self.send_header("Connection", "close")
            self.end_headers()
            with tempfile.TemporaryDirectory() as folder:
                results = Path(folder) / "stats.json"
                shown = (f"locust --headless --users {PERF_USERS} --spawn-rate {PERF_USERS} "
                         f"--run-time {PERF_SECONDS}s")
                command = [SUITE_PYTHON, "-m", "locust", "-f", str(LOCUSTFILE), "--headless",
                           "--users", str(PERF_USERS), "--spawn-rate", str(PERF_USERS),
                           "--run-time", f"{PERF_SECONDS}s", "--json-file", str(results)[:-5]]
                self.send_line(json.dumps({"type": "start", "command": shown,
                                           "users": PERF_USERS, "seconds": PERF_SECONDS}))
                env = suite_env()
                env["PYTHONUNBUFFERED"] = "1"  # print each stats table as soon as it is made
                started = time.monotonic()
                process = subprocess.Popen(command, cwd=LOCUSTFILE.parent, env=env,
                                           stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
                timer = threading.Timer(PERF_SECONDS + 60, process.kill)
                timer.start()
                last_count = None
                try:
                    for raw in process.stdout:
                        line = raw.decode("utf-8", "replace").rstrip("\n")
                        total = AGGREGATED.match(line)
                        if total:
                            count = int(total["requests"])
                            if count != last_count:
                                last_count = count
                                self.send_line(json.dumps({
                                    "type": "tick",
                                    "second": round(time.monotonic() - started),
                                    "requests": count,
                                    "failures": int(total["failures"]),
                                    "median": int(total["median"]),
                                    "rps": float(total["rps"]),
                                }))
                        elif line.strip() and not is_table_line(line):
                            self.send_line(json.dumps({"type": "log", "line": line}))
                    process.wait()
                finally:
                    timer.cancel()
                rows = final_stats(results)
                self.send_line(json.dumps({"type": "stats", "rows": rows}))
                self.send_line(json.dumps({"type": "done", "exit_code": process.returncode}))
        except (BrokenPipeError, ConnectionResetError):
            if process and process.poll() is None:
                process.kill()  # the page was closed mid-run
        finally:
            self.close_connection = True
            busy.release()

    def send_line(self, line):
        self.wfile.write(line.encode() + b"\n")
        self.wfile.flush()


if __name__ == "__main__":
    print(f"CardVault lab on 127.0.0.1:{PORT}, suite in {SUITE_DIR}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
