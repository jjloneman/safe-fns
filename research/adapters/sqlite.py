"""The SQLite adapter: runs each case file through SQLite expressions.

Usage: `python sqlite.py <case-file>...`, inside the `sqlite` Compose service.
SQLite comes from the Python image's `sqlite3` module (there's no official
SQLite image), so its version follows that image.
"""

from __future__ import annotations

import sqlite3

from research_codec import Probe, Tool, run_adapter

CONNECTION = sqlite3.connect(":memory:")

SQLITE_MAX_INTEGER = 2**63 - 1

SQLITE_MIN_INTEGER = -(2**63)


def bindable(value: object, *_rest: object) -> bool:
    """Accept only what SQLite binds as itself.

    A bool would bind silently as 1 or 0, and an int outside SQLite's 64-bit
    range fails to bind; neither is SQLite's answer, so both are `n/a`.
    """
    if isinstance(value, bool):
        return False

    if isinstance(value, int):
        # A comparison, not `in range(…)`: `range` scans linearly for an int
        # subclass such as `JsBigInt`.
        return SQLITE_MIN_INTEGER <= value <= SQLITE_MAX_INTEGER

    return value is None or isinstance(value, float | str)


def select(sql: str) -> Probe:
    """Build a probe that binds the case's value into a one-column query."""

    def run(value: object) -> object:
        """Run the query and return its single value."""
        return CONNECTION.execute(sql, (value,)).fetchone()[0]

    return {"accepts": bindable, "call": sql, "run": run}


TOOLS: list[Tool] = [
    {
        "functions": {
            "safeParseBoolean": [select("SELECT ? IS TRUE")],
            "safeParseInteger": [select("SELECT CAST(? AS INTEGER)")],
            "safeParseNumber": [select("SELECT CAST(? AS REAL)")],
            "safeParseString": [
                select("SELECT CAST(? AS TEXT)"),
                select("SELECT trim(?)"),
            ],
        },
        "name": "SQLite",
        "tier": 3,
        "version": sqlite3.sqlite_version,
    }
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
