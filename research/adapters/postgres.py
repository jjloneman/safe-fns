"""The PostgreSQL adapter: runs each case file through PostgreSQL casts.

Usage: `python postgres.py <case-file>...`, inside the `postgres-adapter`
Compose service, which reaches the `postgres` service over its own network.
psycopg binds a string with no type, so PostgreSQL resolves it exactly as it
would a quoted literal.
"""

from __future__ import annotations

import decimal
import json
import typing

import psycopg
from database_probe import (
    accepts_scalar,
    is_json_list_and_key,
    is_json_pair,
    query_scalar,
    select,
    server_error,
)
from psycopg.types.numeric import Int4, Int8
from range_case import is_short_span, number_text, read_range_case
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

KEY_JSONB_SQL = (
    "SELECT jsonb_object_agg(item ->> %s, item)"
    " FROM jsonb_array_elements(CAST(%s AS jsonb)) AS item"
)
"""Key a `jsonb` array's items by one field; a later duplicate wins."""

SERIES_SQL = (
    "SELECT coalesce(array_agg(value::text ORDER BY ordinal), '{}')"
    " FROM generate_series("
    "CAST(%s AS numeric), CAST(%s AS numeric), CAST(%s AS numeric)"
    ") WITH ORDINALITY AS series(value, ordinal)"
)
"""List a `numeric` series as text; it includes `stop` when it lands on it."""


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


def concatenate_jsonb(defaults: object, overrides: object) -> object:
    """Concatenate two values as `jsonb`, which merges only the top level."""
    return query_server(
        params=(json.dumps(defaults), json.dumps(overrides)),
        sql="SELECT CAST(%s AS jsonb) || CAST(%s AS jsonb)",
    )


def error_name(error: Exception) -> str | None:
    """Name a server error by its SQLSTATE (`22P02`), as PostgreSQL reports it.

    psycopg's class names (`InvalidTextRepresentation`) are its own spelling
    of the condition; the SQLSTATE is the server's.
    """
    if isinstance(error, psycopg.Error) and error.sqlstate is not None:
        return error.sqlstate

    return None


def is_short_series(*args: object) -> bool:
    """Accept `[start, stop]` or `[start, stop, options]`, if short.

    `generate_series` always includes `stop`, so `inclusive: true` asks for
    nothing more; a long or unbounded span is `n/a`.
    """
    case = read_range_case(
        *args, has_end_form=False, option_keys=frozenset({"inclusive", "step"})
    )

    return case is not None and is_short_span(case=case, start=0)


def key_jsonb(items: object, key: str) -> object:
    """Aggregate a `jsonb` array's items into an object keyed by `key`."""
    return query_server(params=(key, json.dumps(items)), sql=KEY_JSONB_SQL)


def query_server(*, params: tuple[object, ...], sql: str) -> object:
    """Run a one-value query, naming a server error by its SQLSTATE.

    Raises:
        Exception: one whose class is named for the server's SQLSTATE.
    """
    try:
        return query_scalar(connection=CONNECTION, params=params, sql=sql)
    except psycopg.Error as error:
        name = error_name(error)

        if name is None:
            raise

        raise server_error(name) from error


def query_text(sql: str) -> str:
    """Run a query that returns one text value."""
    return str(query_scalar(connection=CONNECTION, sql=sql))


def range_options(rest: list[object]) -> dict[str, object]:
    """Read a `range` case's options, the empty dict when it has none."""
    return typing.cast("dict[str, object]", rest[0]) if rest else {}


def series(*args: object) -> object:
    """List `generate_series(start, stop, step)`, with a missing step of 1."""
    start, stop, *rest = args
    options = range_options(rest)

    values = query_server(
        # As text, so `numeric` reads each number as the case means it;
        # psycopg would bind a float as `float8`, whose cast keeps 15 digits.
        params=tuple(
            number_text(number)
            for number in (start, stop, options.get("step", 1))
        ),
        sql=SERIES_SQL,
    )

    return [series_value(text) for text in typing.cast("list[str]", values)]


def series_value(text: str) -> object:
    """Read one `numeric` value as the number JSON can hold exactly.

    An integer becomes an int, which the codec spells as a bigint past the
    safe range; a fraction a float holds exactly becomes that float, and any
    other stays its text, so the column never shows rounding PostgreSQL
    didn't do.
    """
    exact = decimal.Decimal(text)

    if exact == exact.to_integral_value():
        return int(exact)

    approximate = float(exact)

    return approximate if decimal.Decimal(repr(approximate)) == exact else text


TOOLS: list[Tool] = [
    {
        "functions": {
            "deepMerge": [
                {
                    "accepts": is_json_pair,
                    "call": "SELECT CAST(? AS jsonb) || CAST(? AS jsonb)",
                    "run": concatenate_jsonb,
                }
            ],
            "deepSortObject": [cast("SELECT CAST(%s AS jsonb)::text")],
            "keyBy": [
                {
                    "accepts": is_json_list_and_key,
                    "call": KEY_JSONB_SQL.replace("%s", "?"),
                    "run": key_jsonb,
                }
            ],
            "range": [
                {
                    "accepts": is_short_series,
                    "call": "generate_series(start, stop, step)",
                    "run": series,
                }
            ],
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
