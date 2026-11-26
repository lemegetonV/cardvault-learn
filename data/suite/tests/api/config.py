"""Where the CardVault services are, and the settings every test shares.

Each value is read from an environment variable if one is set, otherwise the
default after the comma is used. The defaults point at CardVault running on
your own computer, so the tests work with no extra set-up. To run against
another environment, set the variables first, for example:

    export CARD_URL=https://cards.example.test
"""

import os

# One address per backend service. Each service runs on its own port.
AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8001")
CARD_URL = os.getenv("CARD_URL", "http://localhost:8002")
WALLET_URL = os.getenv("WALLET_URL", "http://localhost:8003")
TRANSACTIONS_URL = os.getenv("TRANSACTIONS_URL", "http://localhost:8004")
PROFILE_URL = os.getenv("PROFILE_URL", "http://localhost:8005")

# The card network simulator, which the tests use to make purchases.
CARD_NETWORK_URL = os.getenv("CARD_NETWORK_URL", "http://localhost:8102")

# The key that unlocks the test-only endpoints (creating customers, making purchases).
TEST_KEY = os.getenv("TEST_KEY", "cv-test-key-local")

# The password shared by the demo customers (alice, bob, charlie and dana).
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "CardVault-Demo-1")

# Database checks connect straight to Postgres. Each service has its own database, and
# each database has a read-only user called "<database>_ro" (for example "card_ro"), so
# a test can look at the data but never change it. They all share this password.
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_READONLY_PASSWORD = os.getenv("DB_READONLY_PASSWORD", "cv-readonly-local")

# Event checks read Kafka, the message bus the services use to tell each other about changes.
KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "127.0.0.1:19092")

# How many seconds to wait for a response before giving up.
TIMEOUT = 10
