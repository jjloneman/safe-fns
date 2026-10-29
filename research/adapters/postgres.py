"""The PostgreSQL adapter: runs each case file through PostgreSQL casts.

Usage: `python postgres.py <case-file>...`, inside the `postgres-adapter`
Compose service, which reaches the `postgres` service over its own network.
psycopg binds a string with no type, so PostgreSQL resolves it exactly as it
would a quoted literal.
"""

from __future__ import annotations

import psycopg
from database_probe import accepts_scalar, query_scalar, select
from psycopg.types.numeric import Int4, Int8
from research_codec import Probe, Tool, run_adapter

CONNECTION = psycopg.connect("host=postgres user=postgres", autocommit=True)
"""Autocommit, so a failed cast never aborts the queries after it."""

ACCEPTS = accepts_scalar(
    allows_bool=True, allows_non_finite=True, allows_nul=False
)
"""PostgreSQL has `boolean` and NaN, but its text can't hold a NUL."""

INT32_MAX = 2**31 - 1
"""The largest `integer` (`int4`): 2147483647."""

INT32_MIN = -(2**31)
"""The smallest `integer` (`int4`): -2147483648."""


def as_literal_type(value: object) -> object:
    """Type an int as PostgreSQL types an integer literal.

    psycopg binds a small int as `smallint`, which has no cast to `boolean`;
    a literal is `integer` when it fits and `bigint` otherwise.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        return value

    return Int4(value) if INT32_MIN <= value <= INT32_MAX else Int8(value)


def cast(sql: str) -> Probe:
    """Build a probe that runs `sql` on PostgreSQL."""
    return select(
        accepts=ACCEPTS,
        connection=CONNECTION,
        error_name=error_name,
        prepare=as_literal_type,
        sql=sql,
    )


def error_name(error: Exception) -> str | None:
    """Name a server error by its SQLSTATE (`22P02`), as PostgreSQL reports it.

    psycopg's class names (`InvalidTextRepresentation`) are its own spelling
    of the condition; the SQLSTATE is the server's.
    """
    if isinstance(error, psycopg.Error) and error.sqlstate is not None:
        return error.sqlstate

    return None


def query_text(sql: str) -> str:
    """Run a query that returns one text value."""
    return str(query_scalar(connection=CONNECTION, sql=sql))


TOOLS: list[Tool] = [
    {
        "functions": {
            "deepSortObject": [cast("SELECT CAST(%s AS jsonb)::text")],
            "safeParseBoolean": [cast("SELECT CAST(%s AS boolean)")],
            "safeParseInt": [cast("SELECT CAST(%s AS bigint)")],
            "safeParseJson": [
                cast("SELECT CAST(%s AS json)::text"),
                cast("SELECT CAST(%s AS jsonb)::text"),
            ],
            "safeParseNumber": [cast("SELECT CAST(%s AS double precision)")],
            "safeParseString": [
                cast("SELECT CAST(%s AS text)"),
                cast("SELECT trim(%s)"),
            ],
            "trimBlank": [cast("SELECT trim(%s)")],
        },
        # PostgreSQL 16 dropped the `lc_ctype` setting; the database keeps it.
        "locale": query_text(
            "SELECT datctype FROM pg_database"
            " WHERE datname = current_database()"
        ),
        "name": "PostgreSQL",
        "tier": 3,
        # `18.6 (Debian 18.6-1.pgdg12+1)` names the build too; keep the release.
        "version": query_text("SHOW server_version").split(" ")[0],
    }
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
