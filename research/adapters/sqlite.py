"""The SQLite adapter: runs each case file through SQLite expressions.

Usage: `python sqlite.py <case-file>...`, inside the `sqlite` Compose service.
SQLite comes from the Python image's `sqlite3` module (there's no official
SQLite image), so its version follows that image.
"""

from __future__ import annotations

import json
import sqlite3

from database_probe import is_json_list_and_key, is_json_pair
from research_codec import Probe, Tool, run_adapter

CONNECTION = sqlite3.connect(":memory:")
"""An in-memory database: the probes only evaluate expressions."""

KEY_JSON_SQL = (
    "SELECT json_group_object(item.value ->> ?, json(item.value))"
    " FROM json_each(?) AS item"
)
"""Group a JSON array's items into an object keyed by one field."""

SQLITE_MAX_INTEGER = 2**63 - 1
"""The largest integer SQLite stores: 9223372036854775807.

SQLite's INTEGER is "a signed integer, stored in 0, 1, 2, 3, 4, 6, or 8
bytes" (https://www.sqlite.org/datatype3.html), so its range is a signed
64-bit integer's. Python's `sqlite3` raises `OverflowError` for an int
outside it rather than binding a value.
"""

SQLITE_MIN_INTEGER = -(2**63)
"""The smallest integer SQLite stores: -9223372036854775808.

The other end of the signed 64-bit range; see `SQLITE_MAX_INTEGER`.
"""


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


def key_json(items: object, key: str) -> object:
    """Group a JSON array's items into an object keyed by `key`."""
    grouped = CONNECTION.execute(
        KEY_JSON_SQL, (key, json.dumps(items))
    ).fetchone()[0]

    if grouped is None:
        return None

    try:
        return json.loads(grouped)
    except json.JSONDecodeError:
        # A NULL key makes `json_group_object` return text that isn't JSON;
        # report that text, not Python's error reading it.
        return grouped


def patch_json(defaults: object, overrides: object) -> object:
    """Apply `overrides` to `defaults` as an RFC 7396 merge patch."""
    patched = CONNECTION.execute(
        "SELECT json_patch(?, ?)", (json.dumps(defaults), json.dumps(overrides))
    ).fetchone()[0]

    return json.loads(patched)


def select(sql: str) -> Probe:
    """Build a probe that binds the case's value into a one-column query."""

    def run(value: object) -> object:
        """Run the query and return its single value."""
        return CONNECTION.execute(sql, (value,)).fetchone()[0]

    return {"accepts": bindable, "call": sql, "run": run}


TOOLS: list[Tool] = [
    {
        "functions": {
            "deepMerge": [
                {
                    "accepts": is_json_pair,
                    "call": "SELECT json_patch(?, ?)",
                    "run": patch_json,
                }
            ],
            "keyBy": [
                {
                    "accepts": is_json_list_and_key,
                    "call": KEY_JSON_SQL,
                    "run": key_json,
                }
            ],
            "safeParseBoolean": [select("SELECT ? IS TRUE")],
            "safeParseInt": [select("SELECT CAST(? AS INTEGER)")],
            "safeParseJson": [select("SELECT json(?)")],
            "safeParseNumber": [select("SELECT CAST(? AS REAL)")],
            "safeParseString": [
                select("SELECT CAST(? AS TEXT)"),
                select("SELECT trim(?)"),
            ],
            "trimBlank": [select("SELECT trim(?)")],
        },
        "name": "SQLite",
        "tier": 3,
        "version": sqlite3.sqlite_version,
    }
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
