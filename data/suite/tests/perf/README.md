# CardVault load test (Locust)

A small load test, written in Python with [Locust](https://locust.io). Many
simulated customers log in and browse their cards, transactions and profile at
the same time, and Locust measures how fast the services answer and how many
requests fail.

## What is where

```
tests/perf/
  requirements.txt   the library to install (locust)
  locustfile.py      who the users are, what they do, and the budgets a run must meet
```

## Run it

You need CardVault running on your computer (`make up && make seed` in the
repository root).

```bash
cd tests/perf
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

locust          # open http://localhost:8089, choose users and press Start
locust --headless --users 10 --spawn-rate 5 --run-time 30s --only-summary
locust --headless --users 10 --spawn-rate 5 --run-time 30s --html report.html
```

`--users` is how many customers run at once, `--spawn-rate` how many start each
second, and `--run-time` how long the test lasts.

## Pass or fail

When a run ends, `check_budgets()` in `locustfile.py` prints `PASSED` or
`FAILED` and sets the exit code: the run fails if 95% of requests were not
faster than 500 ms, or if more than 1% of requests failed. That is what lets
the `api-tests` workflow run a 30-second load test after the API tests and
stop if the services became slow.

## Be careful where you point it

A load test sends many requests on purpose. Run it against your own computer
or a test environment you are allowed to load, never against a shared server
at full strength without asking its owner.
