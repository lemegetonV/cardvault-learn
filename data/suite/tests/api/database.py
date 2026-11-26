"""Read a service's database, for the few checks the API cannot show.

Each CardVault service keeps its data in its own Postgres database: "auth", "card",
"profile", "enrollment" and "wallet_txn". Tests connect as that database's read-only
user, so they can look at the data but can never change it.
"""

import psycopg
from psycopg.rows import dict_row

import config


def query_one(database, sql, values=()):
    """Run one SELECT in a service's database and return the first row.

    The row is a dictionary, for example {"status": "LOST"}, or None if no row matched.
    Put %s in the SQL where a value goes, and pass the values separately:

        query_one("card", "SELECT status FROM cards WHERE card_id = %s", (card_id,))

    psycopg fills them in safely, so a value can never change the SQL itself.
    """
    # "with" closes the connection at the end, even if the query fails.
    with psycopg.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=database,
        user=f"{database}_ro",
        password=config.DB_READONLY_PASSWORD,
        connect_timeout=config.TIMEOUT,
        row_factory=dict_row,
    ) as connection:
        return connection.execute(sql, values).fetchone()
