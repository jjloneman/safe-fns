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
import sys
import warnings
from urllib.parse import urljoin, urlsplit

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
                "deepSortObject": [
                    {
                        "accepts": is_string,
                        "call": "json.dumps(json.loads(value), "
                        'ensure_ascii=False, separators=(",", ":"), '
                        "sort_keys=True)",
                        "run": canonical_json,
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
                "safeJsonStringify": [
                    {
                        "call": 'json.dumps(value, separators=(",", ":"))',
                        "run": compact_json,
                    }
                ],
                "safeObjectHasOwn": [
                    {"call": "key in obj", "run": lambda obj, key: key in obj}
                ],
                "safeParseBoolean": [
                    {
                        "accepts": is_string,
                        "call": "ConfigParser().getboolean(…)",
                        "run": config_boolean,
                    }
                ],
                "safeParseInteger": [{"call": "int(value)", "run": int}],
                "safeParseJson": [
                    {
                        "accepts": is_string,
                        "call": "json.loads(value)",
                        "run": json.loads,
                    }
                ],
                "safeParseNumber": [{"call": "float(value)", "run": float}],
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
