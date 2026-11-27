"""A small load test: many CardVault customers browsing their cards at the same time.

Locust starts many "users" at once. Each user logs in, then keeps doing the tasks
below, with a short pause between them, like a real person using the app. Locust
measures how long every request takes and how many fail.

Run it, with CardVault running on your computer:
    cd tests/perf
    pip install -r requirements.txt
    locust                    # then open http://localhost:8089 and press Start
    locust --headless --users 10 --spawn-rate 2 --run-time 30s

At the end of a run, check_budgets (at the bottom) makes the run fail if it was too
slow or had errors, so a CI job can use it as a pass or fail check.
"""

import os
import random

from locust import HttpUser, between, events, task

# Where the services are. The same settings as the API suite's config.py.
AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8001")
CARD_URL = os.getenv("CARD_URL", "http://localhost:8002")
TRANSACTIONS_URL = os.getenv("TRANSACTIONS_URL", "http://localhost:8004")
PROFILE_URL = os.getenv("PROFILE_URL", "http://localhost:8005")

# The budgets a run must meet. 95% of requests must be faster than this:
P95_BUDGET_MS = 500
# And no more than this share of requests may fail (0.01 = 1%):
MAX_FAILURE_RATIO = 0.01

# The demo customers all share this password. A load test only reads their data.
DEMO_USERS = ["alice", "bob", "charlie", "dana"]
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "CardVault-Demo-1")


class CardVaultCustomer(HttpUser):
    # Locust needs one default address. Each request below gives its full address,
    # because CardVault's services each have their own.
    host = AUTH_URL

    # After each task, a user waits between 1 and 3 seconds, like a person reading.
    wait_time = between(1, 3)

    def on_start(self):
        """Runs once when each user starts: log in as one of the demo customers."""
        username = random.choice(DEMO_USERS)
        response = self.client.post(
            f"{AUTH_URL}/v1/auth/login",
            json={"username": username, "password": DEMO_PASSWORD},
            name="log in",
        )
        token = response.json()["access_token"]
        # Every later request from this user sends the token.
        self.client.headers["Authorization"] = f"Bearer {token}"

    # @task marks what a user does. The number is a weight: listing cards (3)
    # happens three times as often as opening the profile (1).
    @task(3)
    def list_cards(self):
        self.client.get(f"{CARD_URL}/v1/cards", name="list cards")

    @task(2)
    def list_transactions(self):
        self.client.get(
            f"{TRANSACTIONS_URL}/v1/wallet/transactions?limit=10", name="list transactions"
        )

    @task(1)
    def view_profile(self):
        self.client.get(f"{PROFILE_URL}/v1/profile", name="view profile")


@events.quitting.add_listener
def check_budgets(environment, **kwargs):
    """Runs when Locust stops. A non-zero exit code tells CI the run failed."""
    total = environment.stats.total
    p95 = total.get_response_time_percentile(0.95)
    if total.fail_ratio > MAX_FAILURE_RATIO:
        print(f"FAILED: {total.fail_ratio:.1%} of requests failed (budget {MAX_FAILURE_RATIO:.0%})")
        environment.process_exit_code = 1
    elif p95 > P95_BUDGET_MS:
        print(f"FAILED: 95% of requests took up to {p95} ms (budget {P95_BUDGET_MS} ms)")
        environment.process_exit_code = 1
    else:
        print(f"PASSED: p95 {p95} ms, {total.fail_ratio:.1%} failed")
        environment.process_exit_code = 0
