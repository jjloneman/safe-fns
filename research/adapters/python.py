"""The Python adapter: runs each case file through the standard library.

Usage: `python python.py <case-file>...`, inside the `python` or `python311`
Compose service. On Python 3.11 it runs only APIs removed in 3.12 (and the
codec check), so the two images never duplicate a column.
"""

from __future__ import annotations

import configparser
import copy
import json
import platform
import re
import sys
import warnings
from base64 import b64decode, b64encode, urlsafe_b64decode
from datetime import UTC, datetime
from urllib.parse import quote, unquote, urljoin, urlsplit

from research_codec import Probe, Tool, run_adapter

CODEC_PROBE: Probe = {
    "call": "value",
    "is_codec": True,
    "run": lambda value: value,
}
"""Returns each value unchanged, for the `codec` round-trip check."""

VERSION = platform.python_version()
"""The Python that actually ran, reported with every column."""


def are_two_strings(*args: object) -> bool:
    """Accept exactly two string arguments: a value and a base."""
    return len(args) == 2 and all(isinstance(arg, str) for arg in args)


def canonical_json(value: str) -> str:
    """Re-serialize JSON text with sorted keys, compactly, keeping non-ASCII."""
    return json.dumps(
        json.loads(value),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def compact_json(value: object) -> str:
    """Serialize a value as compact JSON, as `JSON.stringify` spaces it."""
    return json.dumps(value, separators=(",", ":"))


def config_boolean(value: str) -> bool:
    """Read a value the way `ConfigParser.getboolean` reads an option."""
    # No interpolation, so a `%` reaches `getboolean` instead of failing first.
    parser = configparser.ConfigParser(interpolation=None)
    parser.read_dict({"section": {"key": value}})

    return parser.getboolean("section", "key")


def current_tools() -> list[Tool]:
    """List the probes the current Python offers."""
    return [
        {
            "functions": {
                "codec": [CODEC_PROBE],
                "decodeBase64": [
                    {
                        "accepts": is_string,
                        "call": "b64decode(value, validate=True).decode()",
                        "run": lambda value: b64decode(
                            value, validate=True
                        ).decode(),
                    },
                    {
                        "accepts": is_string,
                        "call": "b64decode(value).decode()",
                        "run": lambda value: b64decode(value).decode(),
                    },
                    {
                        "accepts": is_string,
                        "call": "urlsafe_b64decode(value).decode()",
                        "run": lambda value: urlsafe_b64decode(value).decode(),
                    },
                ],
                "deepSortObject": [
                    {
                        "accepts": is_string,
                        "call": "json.dumps(json.loads(value), "
                        'ensure_ascii=False, separators=(",", ":"), '
                        "sort_keys=True)",
                        "run": canonical_json,
                    }
                ],
                "encodeBase64": [
                    {
                        "accepts": is_string,
                        "call": "b64encode(value.encode()).decode()",
                        "run": lambda value: b64encode(value.encode()).decode(),
                    }
                ],
                "isPlainObject": [
                    {
                        "call": "type(value) is dict",
                        "run": lambda value: type(value) is dict,
                    }
                ],
                "isSafeEmpty": [
                    {"call": "not value", "run": lambda value: not value}
                ],
                "safeDateToIsoString": [
                    {
                        "accepts": is_number,
                        "call": "datetime.fromtimestamp(value / 1000, tz=UTC)"
                        '.isoformat(timespec="milliseconds")',
                        "run": lambda value: datetime.fromtimestamp(
                            value / 1000, tz=UTC
                        ).isoformat(timespec="milliseconds"),
                    }
                ],
                "safeDecodeUriComponent": [
                    {
                        "accepts": is_string,
                        "call": "unquote(value)",
                        "run": unquote,
                    },
                    {
                        "accepts": is_string,
                        "call": 'unquote(value, errors="strict")',
                        "run": lambda value: unquote(value, errors="strict"),
                    },
                ],
                "safeEncodeUriComponent": [
                    {
                        "accepts": is_string,
                        "call": 'quote(value, safe="")',
                        "run": lambda value: quote(value, safe=""),
                    }
                ],
                "safeJsonStringify": [
                    {
                        "call": 'json.dumps(value, separators=(",", ":"))',
                        "run": compact_json,
                    }
                ],
                "safeObjectHasOwn": [
                    {"call": "key in obj", "run": lambda obj, key: key in obj}
                ],
                "safeParseBigInt": [{"call": "int(value)", "run": int}],
                "safeParseBoolean": [
                    {
                        "accepts": is_string,
                        "call": "ConfigParser().getboolean(…)",
                        "run": config_boolean,
                    }
                ],
                "safeParseDate": [
                    {
                        "accepts": is_string,
                        "call": "datetime.fromisoformat(value).astimezone(UTC)"
                        '.isoformat(timespec="milliseconds")',
                        "run": lambda value: (
                            datetime.fromisoformat(value)
                            .astimezone(UTC)
                            .isoformat(timespec="milliseconds")
                        ),
                    }
                ],
                "safeParseInt": [{"call": "int(value)", "run": int}],
                "safeParseJson": [
                    {
                        "accepts": is_string,
                        "call": "json.loads(value)",
                        "run": json.loads,
                    }
                ],
                "safeParseNumber": [{"call": "float(value)", "run": float}],
                "safeParseRegExp": [
                    {
                        "accepts": is_lone_string,
                        "call": "re.compile(value).pattern",
                        "run": lambda value: re.compile(value).pattern,
                    }
                ],
                "safeParseString": [
                    {"call": "str(value)", "run": str},
                    {
                        "call": "str(value).strip()",
                        "run": lambda value: str(value).strip(),
                    },
                ],
                "safeParseUrl": [
                    {
                        "accepts": is_lone_string,
                        "call": "urlsplit(value).geturl()",
                        "run": lambda value: urlsplit(value).geturl(),
                    },
                    {
                        "accepts": are_two_strings,
                        "call": "urljoin(base, value)",
                        "run": lambda value, base: urljoin(base, value),
                    },
                ],
                "safeStructuredClone": [
                    {"call": "copy.deepcopy(value)", "run": copy.deepcopy}
                ],
            },
            "name": "Python",
            "tier": 2,
            "version": VERSION,
        }
    ]


def is_lone_string(*args: object) -> bool:
    """Accept exactly one argument, a string."""
    return len(args) == 1 and isinstance(args[0], str)


def is_number(value: object, *_rest: object) -> bool:
    """Accept a number first argument: an int or a float, never a bool."""
    return isinstance(value, int | float) and not isinstance(value, bool)


def is_string(value: object, *_rest: object) -> bool:
    """Accept only a string first argument."""
    return isinstance(value, str)


def legacy_tools() -> list[Tool]:
    """List the probes only Python 3.11 and older offer."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        from distutils.util import strtobool

    return [
        {
            "functions": {
                "codec": [CODEC_PROBE],
                "safeParseBoolean": [
                    {
                        "accepts": is_string,
                        "call": "distutils.util.strtobool(value)",
                        "run": strtobool,
                    }
                ],
            },
            "name": "Python",
            "tier": 2,
            "version": VERSION,
        }
    ]


if __name__ == "__main__":
    is_legacy = sys.version_info < (3, 12)
    run_adapter(tools=legacy_tools() if is_legacy else current_tools())
