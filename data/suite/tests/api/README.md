# CardVault API tests (pytest)

A small, readable API test suite for CardVault, written in Python with
[pytest](https://docs.pytest.org) and [requests](https://requests.readthedocs.io).
It calls the five backend services directly over HTTP and checks their answers.

## What is where

```
tests/api/
  requirements.txt      the libraries to install
  pytest.ini            pytest settings: where tests are, markers
  config.py             service addresses and shared settings
  conftest.py           fixtures: alice's login, a fresh customer per test
  helpers.py            create a logged-in customer, wait for slow changes
  api/                  one class per service, one method per API call
    auth_api.py           login, who am I
    cards_api.py          list cards, report lost, reissue, close
    wallet_api.py         wallet status, add and remove cards, opt out
    transactions_api.py   list, detail, CSV export, disputes
    profile_api.py        contact details and verification
    customers_api.py      create a brand-new test customer (test-only endpoint)
    card_network_api.py   make and settle purchases (the card network simulator)
  data/
    demo_customers.py     what we expect about alice and other fixed values
  tests/                the tests, one file per feature
    test_login.py  test_cards.py  test_wallet.py
    test_purchases.py  test_transactions.py  test_profile.py
```

## Run it

You need Python 3.11 or newer, and CardVault running on your computer
(`make up && make seed` in the repository root).

```bash
cd tests/api
python3 -m venv .venv            # a private folder for this project's libraries
source .venv/bin/activate        # use it (on Windows: .venv\Scripts\activate)
pip install -r requirements.txt

pytest                           # every test: 54 passed
pytest -m smoke                  # the 5 quick smoke tests
pytest tests/test_cards.py       # one file
pytest -k lost                   # tests whose name contains "lost"
pytest --html=reports/report.html --self-contained-html   # with an HTML report
```

## Rules the tests follow

- **Tests never change the demo customers.** Tests that only read data use alice.
  Tests that change data ask for the `customer` fixture, or call
  `create_logged_in_customer()`, and get a brand-new customer of their own.
- **Expected values come from the requirements or from known data**
  (`data/demo_customers.py`), never from copying what the app happened to return.
- **No fixed sleeps.** Changes that finish a moment later (the wallet company
  confirming a card, a purchase reaching the transactions list) are waited for
  with the helpers in `helpers.py`, which give up after 10 seconds.

## Another environment

Every address in `config.py` can be changed with an environment variable, for
example `export CARD_URL=https://...` before running `pytest`.
