"""The MongoDB adapter: runs each case file through aggregation operators.

Usage: `python mongo.py <case-file>...`, inside the `mongo-adapter` Compose
service, which reaches the `mongo` service over its own network. Each value
goes in as a `$literal`, so the server never reads it as an expression.
"""

from __future__ import annotations

from collections.abc import Callable

from database_probe import accepts_scalar, server_error
from pymongo import MongoClient
from pymongo.errors import OperationFailure
from research_codec import Probe, Tool, run_adapter

CLIENT: MongoClient[dict[str, object]] = MongoClient(
    "mongo", serverSelectionTimeoutMS=10_000
)
"""A client for the `mongo` service, which runs without authentication."""

DATABASE = CLIENT["research"]
"""Any database will do: the probes aggregate over inline `$documents`."""

ACCEPTS = accepts_scalar(
    allows_bool=True, allows_non_finite=True, allows_nul=True
)
"""BSON has a boolean, and its doubles store NaN and the infinities."""


def aggregate(
    *, call: str, expression: Callable[[dict[str, object]], object]
) -> Probe:
    """Build a probe that evaluates `expression` on the case's value."""

    def run(value: object) -> object:
        """Project the expression over one inline document.

        A failure is named by the server's `codeName` (`ConversionFailure`),
        since pymongo raises `OperationFailure` for all of them.
        """
        project = {"_id": 0, "result": expression({"$literal": value})}
        pipeline = [{"$documents": [{}]}, {"$project": project}]

        try:
            documents = list(DATABASE.aggregate(pipeline))
        except OperationFailure as error:
            code_name = (error.details or {}).get("codeName")

            if not isinstance(code_name, str):
                raise

            raise server_error(code_name) from error

        return documents[0].get("result")

    return {"accepts": ACCEPTS, "call": call, "run": run}


def operator(name: str) -> Probe:
    """Build a probe for a one-argument operator, such as `$toBool`."""
    return aggregate(
        call=f"{{ {name}: value }}",
        expression=lambda literal: {name: literal},
    )


TOOLS: list[Tool] = [
    {
        "functions": {
            "safeParseBoolean": [operator("$toBool")],
            "safeParseInteger": [operator("$toLong")],
            "safeParseNumber": [operator("$toDouble")],
            "safeParseString": [
                operator("$toString"),
                aggregate(
                    call="{ $trim: { input: value } }",
                    expression=lambda literal: {"$trim": {"input": literal}},
                ),
            ],
        },
        # MongoDB compares strings bytewise unless a query names a collation.
        "locale": "simple",
        "name": "MongoDB",
        "tier": 3,
        "version": str(CLIENT.server_info()["version"]),
    }
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
