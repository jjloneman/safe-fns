"""The portable value format and adapter loop, for Python adapters.

The twin of `scripts/research/codec.ts`; the `codec` case file checks that
both decode and re-encode identically.
"""

from __future__ import annotations

import json
import locale
import math
import re
import sys
from collections.abc import Callable
from typing import NotRequired, TypeAlias, TypedDict

JsonValue: TypeAlias = (
    bool | float | int | str | None | list["JsonValue"] | dict[str, "JsonValue"]
)
"""A JSON value, possibly holding tagged objects; `EncodedValue` in TS."""

Outcome: TypeAlias = dict[str, JsonValue]
"""What one call did with one case: `value`, `error`, or `n/a`."""

BIGINT_PATTERN = re.compile(r"-?\d+", re.ASCII)
"""The digits a `$bigint` payload may hold, with an optional minus sign.

ASCII only, like the TS twin: Python's `\\d` would otherwise accept other
scripts' digits, such as Arabic-Indic `٤٢`.
"""

MAX_SAFE_INTEGER = 2**53 - 1
"""The largest integer a JavaScript number holds exactly: 9007199254740991.

JavaScript's `Number.MAX_SAFE_INTEGER`, per ECMA-262
(https://tc39.es/ecma262/#sec-number.max_safe_integer): a number is an IEEE
754 binary64 double, whose 53-bit significand holds every integer up to
2**53 - 1 and its successor; past it, neighbors collapse (2**53 + 1 reads as
2**53). A Python int beyond it is encoded as `$bigint`, so the TS side never
reads a rounded number.
"""

SPECIAL_NUMBERS: dict[str, float] = {
    "-0": -0.0,
    "-Infinity": -math.inf,
    "Infinity": math.inf,
    "NaN": math.nan,
}
"""The spellings `$number` accepts, each with its value."""


class JsBigInt(int):
    """An int decoded from `$bigint`, so it re-encodes as one."""


class Probe(TypedDict):
    """One expression a tool offers for a function."""

    accepts: NotRequired[Callable[..., bool]]
    """Whether the call can take these arguments at all; `n/a` otherwise."""

    call: str
    """The expression, as the table header shows it."""

    is_codec: NotRequired[bool]
    """Whether this is the codec round-trip, which sees every value."""

    run: Callable[..., object]
    """Runs the expression on one case's decoded arguments."""


class Tool(TypedDict):
    """A library or runtime, and its probes for each function."""

    functions: dict[str, list[Probe]]
    """Probes keyed by the function name in a case file."""

    name: str
    """The display name."""

    tier: int
    """The table tier."""

    version: str
    """The version that actually ran."""


class ToolError(Exception):
    """A failure a tool reports by name, such as a CLI's exit status.

    A driven tool (a shell, a C library) raises nothing Python can name, so
    its probe raises this, and the outcome's `error` is the name given.
    """

    def __init__(self, name: str) -> None:
        """Keep the name the outcome reports."""
        super().__init__(name)
        self.outcome_name = name


class Unrepresentable:
    """A value Python has no type for: `undefined`, or a `$js` value."""

    def __init__(self, *, payload: JsonValue, tag: str) -> None:
        """Keep the tag and payload, so the value re-encodes unchanged."""
        self.payload = payload
        self.tag = tag


def contains_unrepresentable(value: object) -> bool:
    """Report whether a decoded value holds anything Python can't express."""
    if isinstance(value, Unrepresentable):
        return True

    if isinstance(value, list):
        return any(contains_unrepresentable(item) for item in value)

    if isinstance(value, dict):
        return any(contains_unrepresentable(item) for item in value.values())

    return False


def current_locale() -> str:
    """Adopt the container's locale and return its name."""
    return locale.setlocale(locale.LC_ALL, "")


def decode(encoded: JsonValue) -> object:
    """Decode a value from the portable format.

    Raises:
        ValueError: for a malformed tag, exactly where `decodeValue` throws.
    """
    if isinstance(encoded, list):
        return [decode(item) for item in encoded]

    if not isinstance(encoded, dict):
        return encoded

    tags = [key for key in encoded if key.startswith("$")]

    if not tags:
        return {key: decode(item) for key, item in encoded.items()}

    if len(encoded) != 1:
        raise ValueError(f"a tag must be an object's only key: {tags[0]}")

    return decode_tag(payload=encoded[tags[0]], tag=tags[0])


def decode_tag(*, payload: JsonValue, tag: str) -> object:
    """Decode one tagged object, given its tag and payload.

    Raises:
        ValueError: for an unknown tag or a payload the tag doesn't accept.
    """
    if tag == "$bigint" and isinstance(payload, str):
        if not BIGINT_PATTERN.fullmatch(payload):
            raise ValueError(f"not an integer: {payload}")

        return JsBigInt(int(payload))

    if tag == "$js" and isinstance(payload, str):
        return Unrepresentable(payload=payload, tag=tag)

    if tag == "$number" and isinstance(payload, str):
        if payload not in SPECIAL_NUMBERS:
            raise ValueError(f"not a special number: {payload}")

        return SPECIAL_NUMBERS[payload]

    if tag == "$object" and isinstance(payload, dict):
        return {key: decode(item) for key, item in payload.items()}

    if tag == "$undefined" and payload is True:
        return Unrepresentable(payload=payload, tag=tag)

    raise ValueError(f"unknown tag or bad payload: {tag}")


def encode(value: object) -> JsonValue:
    """Encode a value into the portable format.

    Anything the format has no tag for is described by `$repr`, which never
    decodes.
    """
    if isinstance(value, Unrepresentable):
        return {value.tag: value.payload}

    if isinstance(value, bool | str) or value is None:
        return value

    if isinstance(value, JsBigInt):
        return {"$bigint": str(int(value))}

    if isinstance(value, int):
        return encode_int(value)

    if isinstance(value, float):
        return encode_float(value)

    if isinstance(value, list | tuple):
        return [encode(item) for item in value]

    if isinstance(value, dict) and all(isinstance(key, str) for key in value):
        return encode_entries(value)

    return {"$repr": type(value).__name__}


def encode_entries(entries: dict[str, object]) -> JsonValue:
    """Encode a dict, wrapped in `$object` when a key could pass for a tag."""
    encoded = {key: encode(item) for key, item in entries.items()}

    if any(key.startswith("$") for key in encoded):
        return {"$object": encoded}

    return encoded


def encode_float(value: float) -> JsonValue:
    """Encode a float, tagging the values JSON can't hold."""
    if math.isnan(value):
        return {"$number": "NaN"}

    if math.isinf(value):
        return {"$number": "Infinity" if value > 0 else "-Infinity"}

    if value == 0 and math.copysign(1, value) < 0:
        return {"$number": "-0"}

    return value


def encode_int(value: int) -> JsonValue:
    """Encode an int, as a bigint once a JavaScript number would lose it."""
    if abs(value) > MAX_SAFE_INTEGER:
        return {"$bigint": str(value)}

    return value


def read_case_file(path: str) -> dict[str, JsonValue]:
    """Read and parse one case file.

    An unreadable file isn't wrapped: Python's `OSError` already names it.

    Raises:
        ValueError: naming the file when it isn't UTF-8 JSON, chained to the
            decoding error.
    """
    with open(path, encoding="utf-8") as file:
        try:
            return json.load(file)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError(f"{path} isn't valid JSON") from error


def run_adapter(*, tools: list[Tool]) -> None:
    """Run the case files named on the command line and print the columns.

    `json.dump` can't fail here: every outcome is already encoded, so nothing
    left is a value JSON can't hold.
    """
    columns: list[dict[str, object]] = []
    locale_name = current_locale()

    for path in sys.argv[1:]:
        case_file = read_case_file(path)
        function = case_file["function"]

        for tool in tools:
            for probe in tool["functions"].get(function, []):
                outcomes = [
                    run_probe(args=case["args"], probe=probe)
                    for case in case_file["cases"]
                ]

                columns.append(
                    {
                        "call": probe["call"],
                        "function": function,
                        "locale": locale_name,
                        "name": tool["name"],
                        "outcomes": outcomes,
                        "tier": tool["tier"],
                        "version": tool["version"],
                    }
                )

    json.dump({"columns": columns}, sys.stdout)


def run_probe(*, args: list[JsonValue], probe: Probe) -> Outcome:
    """Run one probe on one case's encoded arguments."""
    decoded = [decode(arg) for arg in args]
    is_codec = probe.get("is_codec", False)

    if not is_codec and any(contains_unrepresentable(arg) for arg in decoded):
        return {"kind": "n/a"}

    accepts = probe.get("accepts")

    if accepts is not None and not accepts(*decoded):
        return {"kind": "n/a"}

    try:
        return {"kind": "value", "value": encode(probe["run"](*decoded))}
    except ToolError as error:
        return {"error": error.outcome_name, "kind": "error"}
    except Exception as error:  # every failure is a result, never a crash
        return {"error": type(error).__name__, "kind": "error"}
