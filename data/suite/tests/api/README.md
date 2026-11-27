# CardVault API tests (pytest)

A small, readable API test suite for CardVault, written in Python with
[pytest](https://docs.pytest.org) and [requests](https://requests.readthedocs.io).
It calls the five backend services directly over HTTP and checks their answers.
A few tests also look inside a service's database (read-only) or read the events
the services send each other through Kafka.

## What is where

```
tests/api/
  requirements.txt      the libraries to install
  pytest.ini            pytest settings: where tests are, markers, logging
  config.py             service addresses and shared settings
  envs/
    stage.env             the addresses of another environment (TEST_ENV=stage)
  conftest.py           fixtures: alice's login, a fresh customer per test, a session logged out after
  helpers.py            create a logged-in customer, wait for slow changes
  database.py           query_one(): read a row from a service's database (read-only user)
  events.py             EventWatcher: wait for an event on a Kafka topic; list_topics()
  api/                  one class per service, one method per API call
    client.py             the shared HTTP session; logs every request and response
    auth_api.py           login, refresh, log out, who am I
    cards_api.py          list cards, report lost, reissue, close
    wallet_api.py         wallet status, add and remove cards, opt out
    transactions_api.py   list, detail, CSV export, disputes
    profile_api.py        contact details and verification
    customers_api.py      create a brand-new test customer (test-only endpoint)
    card_network_api.py   make and settle purchases (the card network simulator)
  data/
    demo_customers.py     what we expect about alice and other fixed values
    contact_details.json  good and bad emails and phone numbers, one test case per line
    schemas.py            JSON Schemas: the shape a card and an error must have
    files/                a receipt picture and a fake one, for dispute uploads
  tests/                the tests, one file per feature
    test_login.py  test_cards.py  test_wallet.py
    test_purchases.py  test_transactions.py  test_profile.py
    test_response_shape.py   responses checked against a JSON Schema
    test_security.py         other customers' data, forged tokens, fields you may not set
    test_api_behaviours.py   pages, idempotency keys, version checks, rate limits
    test_database.py         what is stored: hashed passwords, encrypted card numbers
    test_events.py           the broker's topics, and the events a change sends
```

## Run it

You need Python 3.11 or newer, and CardVault running on your computer
(`make up && make seed` in the repository root).

```bash
cd tests/api
python3 -m venv .venv            # a private folder for this project's libraries
source .venv/bin/activate        # use it (on Windows: .venv\Scripts\activate)
pip install -r requirements.txt

pytest                           # every test: 93 passed
pytest -m smoke                  # the 5 quick smoke tests
pytest -m "not database and not events"   # only the API tests (no Postgres or Kafka access needed)
pytest tests/test_cards.py       # one file
pytest -k lost                   # tests whose name contains "lost"
pytest --lf                      # only the tests that failed last time
pytest -n 4                      # spread the tests over 4 processes (pytest-xdist)
pytest --html=reports/report.html --self-contained-html   # with an HTML report
pytest --alluredir=allure-results                        # results for an Allure report
npx allure@3.33.0 generate allure-results --output allure-report   # build it (needs Node.js)
```

The Allure report shows every API call of a test as a step, with the request and
response bodies attached. The `api-tests` workflow builds both reports on every run
and keeps them as a download for 14 days.

## Rules the tests follow

- **Tests never change the demo customers.** Tests that only read data use alice.
  Tests that change data ask for the `customer` fixture, or call
  `create_logged_in_customer()`, and get a brand-new customer of their own.
- **Expected values come from the requirements or from known data**
  (`data/demo_customers.py`), never from copying what the app happened to return.
- **Safe to run in parallel.** Because every test that changes data has its own
  customer, tests never depend on each other or on their order, so `pytest -n 4` works.
- **No fixed sleeps.** Changes that finish a moment later (the wallet company
  confirming a card, a purchase reaching the transactions list) are waited for
  with the helpers in `helpers.py`, which give up after 10 seconds.

- **Every call is logged.** All API classes send through one `requests.Session` in
  `api/client.py`, which logs each request and response (tokens and passwords hidden).
  pytest shows that log under a failing test and in the HTML report.

- **Database and Kafka checks only where the API cannot show the fact.** They use
  read-only database users, and start watching a topic before the action, so an
  old event can never make a test pass.

## Another environment

Every setting in `config.py` can be changed with an environment variable, for
example `export CARD_URL=https://...` before running `pytest`. To switch a whole
environment at once, name it in `TEST_ENV`, and `config.py` reads its file in `envs/`:

```bash
export TEST_KEY=...  DB_READONLY_PASSWORD=...   # secrets never go in the file
TEST_ENV=stage pytest
```

A variable you set yourself still wins over the file. Where Postgres and Kafka are
not reachable, skip those tests with `-m "not database and not events"` (86 tests).

## Load test

A short Locust load test lives next door in `../perf/`; see its README.
