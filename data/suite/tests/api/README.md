# CardVault API tests

A pytest + httpx suite that tests CardVault from the outside, the way a QA team tests a
deployed system: over HTTP, with read-only database and Kafka checks where the API cannot
show the truth. Expected results come from `SPEC.md`, the seed data and each test's own
setup, never from copying a response.

## Run it locally

You need [uv](https://docs.astral.sh/uv/) and a running stack.

```bash
make up && make seed          # from the repo root
cd tests/api
uv sync                       # once: creates .venv with the suite's dependencies
uv run pytest                 # everything, one test at a time
uv run pytest -n auto         # in parallel (serial tests left out) ...
uv run pytest -m serial       # ... then the serial tests on their own
uv run pytest -m smoke        # the quick "is it up" subset
```

Every run first waits for each service's `/ready`, then resets and reseeds the stack once
(`RESET_AT_START=true`), so it always starts from the known seed state.

A failed test prints every request it sent under **CardVault requests**, each with its
`X-Correlation-ID`. Search `docker compose logs` for that ID to see what each service did.

### Report

```bash
uv run pytest -n auto --alluredir allure-results
npx allure@3.33.0 generate allure-results -o allure-report   # needs Node.js
npx allure@3.33.0 open allure-report
```

Each request and response is attached to its test in the report (keys, tokens and
passwords masked).

## Environments

`TEST_ENV` picks the environment: `local` (default) or `stage`. Settings are read from, in
order of priority: environment variables, `tests/api/.env.<env>` (untracked, for secrets),
then `envs/<env>.env` (committed, no secrets).

| Environment | Where the stack runs | Expected result |
| --- | --- | --- |
| `local` | `make up` on this machine, or `make ci-up` in GitHub Actions | All green |
| `stage` | The stage VM, through an SSH tunnel | Red where the stage's known defects are |

### Running against stage

1. Open the SSH tunnel to the VM (it forwards the services to 127.0.0.1:18001 to 18005,
   the mocks to 18101 and 18102, Postgres to 15432 and Kafka to 29092).
2. Copy `.env.stage.example` to `.env.stage` and fill in the keys from the VM's
   `/opt/cardvault/.env`.
3. Run with few workers, because the VM is small:

   ```bash
   TEST_ENV=stage uv run pytest -n 2
   ```

## Layout

```
envs/                   local.env, stage.env: URLs and non-secret settings
src/cardvault_tests/    framework code (imported by tests)
  settings.py           TEST_ENV and every setting
  http.py               one httpx client per service; correlation IDs and evidence
  auth.py               BearerAuth, ServiceKeyAuth, TestKeyAuth (httpx.Auth classes)
  clients/              one class per API area, plus the /test/* controls
  models/               pydantic models of the responses
  signing.py            HMAC signing of operator callbacks
  wallet.py             wallet_card(), wait_for_enrolment()
  transactions.py       wallet_purchase(), wait_for_transaction()
  events.py             EventWatch: read a Kafka topic from now on; schema checks
  db.py                 read-only SQL (the <db>_ro roles)
  checks.py             expect(), expect_status(), expect_error()
  waits.py              wait_until(): bounded polling instead of sleeps
  data.py               seed facts and templates for fresh customers
  customers.py          a logged-in customer and their clients
  environment.py        wait for /ready, reset and reseed before the run
tests/
  conftest.py           root fixtures (services, controls, card_network, make_customer,
                        alice, shared_clock, faults, enrolments, callbacks,
                        operator, operator_state, operator_records, reconciliation,
                        watch, db)
  health/ auth/ cards/ authorization/ clearing/ idempotency/ concurrency/
  eligibility/ enrolment/ callbacks/ profile/ transactions/ disputes/
  reconciliation/ events/ storage/ security/ journeys/
                        one folder per area of the spec
```

## Rules the suite keeps

- **Fresh data for every change.** A test that changes state creates its own customer with
  `make_customer(...)` (`POST /test/customers`). The seed customers are only read.
- **Shared switches run alone.** Tests that move the shared clock or inject faults are
  marked `serial`: while one runs, every other test would see the change. A parallel run
  (`-n`) leaves them out; run them afterwards with `pytest -m serial`. Their fixtures
  restore the clock or clear faults even when the test fails.
- **Wait, never sleep.** Anything that happens after the response is awaited with
  `wait_until`, which polls with a timeout and fails with the last value it saw.

## Markers

| Marker | Meaning |
| --- | --- |
| `smoke` | Quick check that the stack is up and the main paths answer |
| `serial` | Changes something every service shares (clock, faults, mock controls) |
| `slow` | Waits on retries, timeouts or delayed callbacks |

## CI

`.github/workflows/api-tests.yml` runs on pushes to `main` and `test/api` and on every pull
request: it starts the stack with the start-stack action, runs `pytest -n auto` and then
`pytest -m serial`, and
uploads the Allure report, JUnit XML and `docker compose logs` as one artifact.
