"""Read-only database access, for facts the API cannot show (how data is stored, whether
the outbox drained).

Each service owns its database, and each database has a ``<name>_ro`` role that can only
SELECT. The suite never writes to a database: state is set up through the APIs and the
``/test/*`` endpoints, so the services stay the only writers of their own data.

psycopg is the PostgreSQL driver for Python; ``dict_row`` returns each row as a dict.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import psycopg
from psycopg.rows import dict_row

from cardvault_tests.settings import Settings


@contextmanager
def connect(settings: Settings, database: str) -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=database,
        user=f"{database}_ro",
        password=settings.readonly_db_password,
        row_factory=dict_row,
        autocommit=True,
        connect_timeout=10,
    )
    try:
        yield conn
    finally:
        conn.close()


class ReadOnlyDb:
    """Small helpers over one connection per call; queries always use parameters."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def rows(self, database: str, sql: str, *params: Any) -> list[dict[str, Any]]:
        with connect(self.settings, database) as conn:
            return conn.execute(sql, params).fetchall()

    def one(self, database: str, sql: str, *params: Any) -> dict[str, Any]:
        found = self.rows(database, sql, *params)
        assert len(found) == 1, f"expected one row, got {len(found)}"
        return found[0]
