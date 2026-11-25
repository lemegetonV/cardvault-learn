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

## Start here: the learning path

The suite is large because it covers the whole spec. You do not need to read all of it. The
23 tests marked `lesson` are the ones the learning site walks through, one or two per idea;
everything else repeats their patterns for more rules. Read them in this order:

| # | Idea | Test |
| --- | --- | --- |
| 1 | The first test | `health/test_health.py::test_health_reports_the_service_by_name` |
| 2 | Expected values from the seed data | `cards/test_reading_cards.py::test_alice_sees_exactly_her_four_seed_cards` |
| 3 | A fresh customer for every change | `cards/test_card_lifecycle.py::test_card_transition` |
| 4 | A serial test that moves the clock | `auth/test_access_tokens.py::test_access_token_expires_after_15_minutes_of_shared_clock_time` |
| 5 | A boundary in business time | `eligibility/test_time_boundaries.py::test_recent_use_means_at_most_90_days` |
| 6 | A table of cases | `authorization/test_decision_table.py::test_card_purchase_is_declined` |
| 7 | Money worked out by hand | `clearing/test_hold_maths.py::test_only_credit_may_settle_above_the_hold`, `::test_partial_reverse_releases_that_part_of_the_hold` |
| 8 | Retries and races | `idempotency/test_idempotency_keys.py::test_same_key_replays_the_first_response`, `concurrency/test_parallel_money.py::test_parallel_purchases_never_spend_more_than_available` |
| 9 | Rules and their reasons | `eligibility/test_eligibility_rules.py::test_eligibility_and_reason` |
| 10 | A flow that finishes later | `enrolment/test_add_and_remove.py::test_adding_an_eligible_card_ends_enrolled_with_a_working_token` |
| 11 | Playing the operator | `callbacks/test_operator_callbacks.py::test_an_older_operator_version_is_ignored_as_stale`, `enrolment/test_operator_failures.py::test_a_short_outage_is_retried_and_the_card_still_enrols`, `::test_a_long_outage_ends_failed_after_five_attempts` |
| 12 | Reconciliation | `reconciliation/test_reconciliation.py::test_a_different_status_is_a_status_mismatch` |
| 13 | Events | `events/test_published_events.py::test_a_wallet_purchase_publishes_auth_decided`, `events/test_consuming_events.py::test_a_redelivered_event_changes_nothing` |
| 14 | The database, read-only | `storage/test_how_data_is_stored.py::test_a_card_number_is_never_stored_in_clear`, `::test_the_suite_cannot_write` |
| 15 | Who may call what | `security/test_who_may_call_what.py::test_a_customer_endpoint_refuses_a_service_key`, `::test_an_internal_endpoint_refuses_a_customer_token` |
| 16 | A customer journey | `journeys/test_customer_journeys.py::test_add_a_card_pay_with_it_and_dispute_the_charge` |

Run just these with `uv run pytest -m lesson` (some are parametrised, so pytest reports
more cases than tests). The learning site's explorer shows every file with these tests
badged and linked to their lessons.

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

### Running from the learning site (the stage runner)

`runner/serve.py` is a small page that runs one test or file on stage and streams pytest's
output. The learning site's "Run on stage" buttons open it. It runs on the VM with
`TEST_ENV=vm` (`envs/vm.env`: stage's own local ports, no tunnel; secrets in the VM's
untracked `tests/api/.env.vm`). It listens on 127.0.0.1:8790 only, Caddy publishes it with
basic auth, it allows one run at a time, and each run resets and reseeds stage first.

On the VM: `uv sync --frozen` in `tests/api`, create `.env.vm`, install
`runner/cardvault-runner.service` (instructions inside it), then add a Caddy site that
reverse-proxies to 127.0.0.1:8790 with basic auth and `flush_interval -1`.

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
| `lesson` | Walked through on the learning site; the suggested reading path (see Start here) |

## CI

`.github/workflows/api-tests.yml` runs on pushes to `main` and `test/api` and on every pull
request: it starts the stack with the start-stack action, runs `pytest -n auto` and then
`pytest -m serial`, and
uploads the Allure report, JUnit XML and `docker compose logs` as one artifact.
