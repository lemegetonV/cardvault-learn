"""Where the suite points and with which keys.

``TEST_ENV`` picks the environment (``local`` by default, or ``stage``). Values are read in
this order, the first one found wins:

1. environment variables (``TEST_KEY=... pytest``)
2. ``tests/api/.env.<TEST_ENV>``: untracked secrets for that environment
3. ``tests/api/envs/<TEST_ENV>.env``: the committed, secret-free settings
4. the defaults below
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SUITE_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    test_env: str = "local"

    # Base URLs of the five bank services and the two mocks
    auth_url: str
    card_url: str
    enrollment_url: str
    wallet_txn_url: str
    profile_url: str
    operator_url: str
    network_url: str

    # Keys the suite presents
    test_key: str = ""  # X-Test-Key for /test/* controls
    service_key_tests: str = ""  # X-Service-Key of the "tests" caller (sweep, reconciliation)
    operator_hmac_secret: str = ""  # signs callbacks the suite sends as the operator
    seed_user_password: str = "CardVault-Demo-1"  # alice, bob, charlie and dana

    # What access tokens must say about who issued them and for whom
    jwt_issuer: str = "cardvault-auth"
    jwt_audience: str = "cardvault"

    # Read-only database and Kafka access (later steps)
    db_host: str = "127.0.0.1"
    db_port: int = 5432
    readonly_db_password: str = ""
    kafka_bootstrap: str = "127.0.0.1:19092"

    # Run behaviour
    http_timeout_seconds: float = 10.0
    ready_wait_seconds: float = 60.0
    reset_at_start: bool = True

    @property
    def services(self) -> dict[str, str]:
        """Every service and mock by name, in reset order (the operator mock last)."""
        return {
            "auth": self.auth_url,
            "card": self.card_url,
            "profile": self.profile_url,
            "enrollment": self.enrollment_url,
            "wallet-txn": self.wallet_txn_url,
            "network-mock": self.network_url,
            "wallet-operator-mock": self.operator_url,
        }


@lru_cache
def get_settings() -> Settings:
    env = os.environ.get("TEST_ENV", "local")
    committed = SUITE_ROOT / "envs" / f"{env}.env"
    if not committed.exists():
        raise RuntimeError(f"Unknown TEST_ENV {env!r}: no file {committed}")
    secrets = SUITE_ROOT / f".env.{env}"
    files = [committed] + ([secrets] if secrets.exists() else [])
    # Later files win over earlier ones; environment variables win over both.
    return Settings(_env_file=files, test_env=env)
