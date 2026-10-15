"""The MySQL and MariaDB adapter: runs each case file through their casts.

Usage: `python mysql.py <case-file>...`, inside the `mysql-adapter` or
`mariadb-adapter` Compose service; `RESEARCH_DATABASE_HOST` names the server.
PyMySQL interpolates each value as a quoted literal, which the server parses
as it would one typed into a query.
"""

from __future__ import annotations

import os

import pymysql
from database_probe import accepts_scalar, query_scalar, select
from research_codec import Probe, Tool, run_adapter

CONNECTION = pymysql.connect(
    autocommit=True,
    charset="utf8mb4",
    host=os.environ["RESEARCH_DATABASE_HOST"],
    user="root",
)
"""The server's passwordless root, over its adapter's internal network."""

ACCEPTS = accepts_scalar(
    allows_bool=False, allows_non_finite=False, allows_nul=True
)
"""MySQL's `BOOLEAN` is `TINYINT(1)`, and a `DOUBLE` can't hold NaN."""


def cast(sql: str) -> Probe:
    """Build a probe that runs `sql` on the server."""
    return select(
        accepts=ACCEPTS,
        connection=CONNECTION,
        error_name=error_name,
        sql=sql,
    )


def error_name(error: Exception) -> str | None:
    """Name a server error by its number, as the MySQL manual lists it."""
    if isinstance(error, pymysql.MySQLError) and error.args:
        return f"Error {error.args[0]}"

    return None


def query_text(sql: str) -> str:
    """Run a query that returns one text value."""
    return str(query_scalar(connection=CONNECTION, sql=sql))


VERSION = query_text("SELECT VERSION()")
"""`9.7.1`, or `11.8.9-MariaDB-ubu2404` on MariaDB."""

IS_MARIADB = "MariaDB" in VERSION
"""MariaDB's `JSON` is an alias of `LONGTEXT`, so its JSON probes differ."""

JSON_FUNCTIONS: dict[str, list[Probe]] = (
    {
        "deepSortObject": [cast("SELECT JSON_NORMALIZE(%s)")],
        "safeParseJson": [
            cast("SELECT JSON_VALID(%s)"),
            cast("SELECT JSON_COMPACT(%s)"),
        ],
    }
    if IS_MARIADB
    else {
        "deepSortObject": [cast("SELECT CAST(CAST(%s AS JSON) AS CHAR)")],
        "safeParseJson": [cast("SELECT CAST(%s AS JSON)")],
    }
)
"""The JSON probes: MySQL's native type, or MariaDB's JSON functions."""

TOOLS: list[Tool] = [
    {
        "functions": {
            **JSON_FUNCTIONS,
            "safeParseBoolean": [cast("SELECT %s IS TRUE")],
            "safeParseInteger": [cast("SELECT CAST(%s AS SIGNED)")],
            "safeParseNumber": [cast("SELECT CAST(%s AS DOUBLE)")],
            "safeParseString": [
                cast("SELECT CAST(%s AS CHAR)"),
                cast("SELECT TRIM(%s)"),
            ],
        },
        "locale": query_text("SELECT @@collation_connection"),
        "name": "MariaDB" if IS_MARIADB else "MySQL",
        "tier": 3,
        "version": VERSION.split("-")[0],
    }
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
