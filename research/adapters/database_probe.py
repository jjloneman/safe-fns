"""Probes shared by the database adapters: bind one value, read one back.

Each adapter connects to its own database service; this module only builds
the probes, so the drivers stay in the adapters that import them.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from typing import Protocol

from research_codec import Probe

INT64_MAX = 2**63 - 1
"""The largest integer every driver here binds as an integer.

A signed 64-bit integer's maximum, 9223372036854775807: PostgreSQL's
`bigint`, MySQL's `BIGINT`, SQL Server's `bigint`, and BSON's `long`. Past
it, each driver picks its own wider type (`numeric`, a `DECIMAL` literal),
so the answer would be the driver's rather than the database's.
"""

INT64_MIN = -(2**63)
"""The smallest integer every driver here binds as an integer.

The other end of the signed 64-bit range; see `INT64_MAX`.
"""


class Cursor(Protocol):
    """The slice of a DB-API cursor a probe uses."""

    def execute(self, query: str, params: tuple[object, ...]) -> object:
        """Run `query` with `params` bound to its placeholders."""
        ...

    def fetchone(self) -> Sequence[object] | None:
        """Return the next row, or `None` once there are none."""
        ...


class Connection(Protocol):
    """The slice of a DB-API connection a probe uses."""

    def cursor(self) -> Cursor:
        """Open a cursor."""
        ...


def accepts_scalar(
    *, allows_bool: bool, allows_nul: bool, allows_non_finite: bool
) -> Callable[..., bool]:
    """Build an `accepts` that passes what a driver binds as the value itself.

    - A bool counts only where the database has a boolean type; elsewhere a
      driver silently binds it as 1 or 0.

    - A string must encode as UTF-8, since a lone surrogate fails in the
      driver before the database sees it; a NUL counts only where the
      database's text can hold one.

    - A non-finite float counts only where the database stores one.
    """

    def accepts(value: object, *_rest: object) -> bool:
        """Report whether the driver binds `value` as itself."""
        if isinstance(value, bool):
            return allows_bool

        if isinstance(value, int):
            # A comparison, not `in range(…)`: `range` scans linearly for an
            # int subclass such as `JsBigInt`.
            return INT64_MIN <= value <= INT64_MAX

        if isinstance(value, float):
            return allows_non_finite or math.isfinite(value)

        if isinstance(value, str):
            return is_utf8(value) and (allows_nul or "\0" not in value)

        return value is None

    return accepts


def is_utf8(text: str) -> bool:
    """Report whether a string encodes as UTF-8."""
    try:
        text.encode("utf-8")
    except UnicodeEncodeError:
        return False

    return True


def query_scalar(
    *, connection: Connection, params: tuple[object, ...] = (), sql: str
) -> object:
    """Run a one-column query and return its first value, or `None`."""
    cursor = connection.cursor()
    cursor.execute(sql, params)
    row = cursor.fetchone()

    return None if row is None else row[0]


def select(
    *,
    accepts: Callable[..., bool],
    connection: Connection,
    error_name: Callable[[Exception], str | None] | None = None,
    prepare: Callable[[object], object] | None = None,
    sql: str,
) -> Probe:
    """Build a probe that binds the case's value into a one-column query.

    - `sql` uses the drivers' shared `%s` placeholder; the table header shows
      it as `?`, like the SQLite column's.

    - `prepare` wraps the value before binding, where the driver would
      otherwise pick a type the database's own literal wouldn't have.

    - `error_name` names a driver error by the server's own code, where the
      driver raises one class for every server error.
    """

    def run(value: object) -> object:
        """Run the query and return its single value."""
        bound = value if prepare is None else prepare(value)

        try:
            return query_scalar(connection=connection, params=(bound,), sql=sql)
        except Exception as error:
            name = None if error_name is None else error_name(error)

            if name is None:
                raise

            raise server_error(name) from error

    return {"accepts": accepts, "call": sql.replace("%s", "?"), "run": run}


def server_error(name: str) -> Exception:
    """Build an exception whose class is named for a server's error code.

    The adapter loop reports an error by its class name, so this is how a
    server's own code reaches the table.
    """
    return type(name, (Exception,), {})()
