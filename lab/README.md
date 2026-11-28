# Live lab

The learning site's Try it panels, Live lab page and Run buttons call `/vm/*` on the site.
The site's Worker (`worker/index.js`) forwards those calls to this server, which runs on the
machine that hosts CardVault.

```
browser ──/vm/*──▶ Cloudflare Worker (signs in) ──▶ Caddy (basic auth) ──▶ lab/server.py ──▶ CardVault services
```

- `server.py`: standard library only. Listens on 127.0.0.1:8790. Forwards customer API
  requests (paths under `/v1/` on the five services, nothing else), resets the stack with
  CardVault's `scripts/reset.sh`, lists the suite's tests and runs one test or file at a time.
- `labtrace.py`: a pytest plugin the lab loads for `/vm/trace` (`-p labtrace`, on `PYTHONPATH`).
  It wraps `requests`, the suite's `database.query_one` and `events.EventWatcher`, and writes one
  JSON line per step (API call, query, event, test outcome) to a pipe the server reads. The site's
  Run buttons open a side panel that draws those steps. Test keys are hidden and tokens shortened.
- `pw-reporter.cjs` and `playwright.lab.config.cjs`: the same idea for the Playwright suite
  (`/vm/ui-trace`). The config is the suite's own `playwright.config.ts` with a trace, a video
  and a screenshot for every test, results in a folder per run, and the reporter added. The
  reporter writes one JSON line per test step (action, `expect()` check, `test.step`, hook),
  with the line of test code it came from. Each run's folder (screenshots, videos, traces and
  the HTML report with its trace viewer) is served from `/vm/ui-files/<run>/`; only the last
  six runs are kept. The tests open the public web app (`UI_BASE_URL`), and their API set-up
  calls go to the services on this machine. The visual tests and the phone project are not offered.
- API runs pass `-o enable_assertion_pass_hook=true`, so `labtrace.py` also records every
  assert that held (pytest's `pytest_assertion_pass` hook), not only the one that failed.
- No password on the page (the owner's requirement): the Worker signs in for it. Caddy keeps
  basic auth on the lab's site, and the Worker sends those credentials from its secret
  `LAB_AUTH` ("user:password"), set in the Cloudflare dashboard (Workers, cardvault-learn,
  Settings, Variables and Secrets). It is never in this repository or in the page.
- The Worker reads `LAB_UPSTREAM` from `wrangler.jsonc` (`.dev.vars` overrides it locally).

## Install on the server

1. `git clone https://github.com/lemegetonV/cardvault-learn /opt/cardvault-learn`
2. The suite: `/opt/cardvault-suite` is a CardVault checkout. Pull it, then give its tests a
   virtual environment: `cd /opt/cardvault-suite/tests/api && uv venv .venv && uv pip install --python .venv/bin/python -r requirements.txt`
3. The Playwright suite: Node.js 22, then `cd /opt/cardvault-suite/tests/ui && npm ci && npx playwright install --with-deps chromium`
   (as the user the service runs as, so the browser lands in that user's cache).
4. Install `cardvault-lab.service` (steps inside it) and stop the old runner unit if it exists.
5. The Caddy site for the lab keeps `basic_auth` and reverse-proxies to `127.0.0.1:8790` with
   `flush_interval -1`, so test output streams:

   ```
   run.140-245-206-220.sslip.io {
       import no_traversal
       basic_auth {
           <user> <bcrypt hash>
       }
       reverse_proxy 127.0.0.1:8790 {
           flush_interval -1
       }
   }
   ```

Update later with `git -C /opt/cardvault-learn pull && sudo systemctl restart cardvault-lab`. After the
suite changes: `git -C /opt/cardvault-suite pull`, then `npm ci` in `tests/ui` if its `package.json`
changed, and restart the lab (it reads the test lists once).

## Run it locally

With CardVault running locally and the suite's requirements in a virtual environment:

```
CARDVAULT_DIR=../cardvault SUITE_DIR=../cardvault/tests/api SUITE_PYTHON=/path/to/venv/bin/python UI_DIR=../cardvault/tests/ui python3 lab/server.py
echo 'LAB_UPSTREAM=http://127.0.0.1:8790' > .dev.vars
npx wrangler dev
```

