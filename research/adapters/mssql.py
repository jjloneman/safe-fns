"""The SQL Server adapter: runs each case file through T-SQL casts.

Usage: `python mssql.py <case-file>...`, inside the `mssql-adapter` Compose
service, which reaches the `mssql` service over its own network. pytds binds
a string as `nvarchar`, an int as `bigint`, and a float as `float`.
"""

from __future__ import annotations

import os

import pytds
from database_probe import accepts_scalar, query_scalar, select
from research_codec import Probe, Tool, run_adapter

CONNECTION = pytds.connect(
    autocommit=True,
    database="master",
    password=os.environ["MSSQL_SA_PASSWORD"],
    server="mssql",
    user="sa",
)
"""The `sa` login, over its adapter's internal network."""

ACCEPTS = accepts_scalar(
    allows_bool=False, allows_non_finite=False, allows_nul=True
)
"""SQL Server's `bit` isn't a boolean, and a `float` can't hold NaN."""


def cast(sql: str) -> Probe:
    """Build a probe that runs `sql` on SQL Server."""
    return select(
        accepts=ACCEPTS,
        connection=CONNECTION,
        error_name=error_name,
        sql=sql,
    )


def error_name(error: Exception) -> str | None:
    """Name a server error by its message number, as SQL Server prints it.

    pytds raises `OperationalError` for nearly every server error, so the
    number is what tells a failed conversion (245) from an overflow (8115).
    """
    if isinstance(error, pytds.Error) and getattr(error, "msg_no", 0):
        return f"Msg {error.msg_no}"

    return None


def server_property(name: str) -> str:
    """Read one `SERVERPROPERTY`."""
    return str(
        query_scalar(
            connection=CONNECTION,
            sql=f"SELECT CAST(SERVERPROPERTY('{name}') AS nvarchar(128))",
        )
    )


TOOLS: list[Tool] = [
    {
        "functions": {
            "safeParseBoolean": [cast("SELECT CAST(%s AS bit)")],
            "safeParseInt": [cast("SELECT CAST(%s AS bigint)")],
            "safeParseJson": [cast("SELECT ISJSON(%s)")],
            "safeParseNumber": [cast("SELECT CAST(%s AS float)")],
            "safeParseString": [
                cast("SELECT CAST(%s AS nvarchar(max))"),
                cast("SELECT TRIM(%s)"),
            ],
        },
        "locale": server_property("Collation"),
        "name": "SQL Server",
        "tier": 3,
        "version": server_property("ProductVersion"),
    }
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
