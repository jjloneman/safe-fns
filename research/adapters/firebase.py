"""The Firebase adapter: checks which values each emulator keeps.

Usage: `python3 firebase.py <case-file>...`, inside the `firebase-adapter`
Compose service, which runs from the emulators' own image and reaches the
`firebase` service over its own network. It needs only the standard library.

Firebase has an opinion only on emptiness: the Realtime Database deletes a
node whose value is empty, while Firestore stores what it's given. Each probe
writes the value, reads it back, and reports whether it vanished.
"""

from __future__ import annotations

import json
import math
import urllib.request

from database_probe import INT64_MAX, INT64_MIN
from research_codec import JsonValue, Tool, run_adapter

AUTHORIZATION = {"Authorization": "Bearer owner"}
"""The emulators' admin token, which bypasses security rules."""

FIRESTORE_DOCUMENT = (
    "http://firebase:8080/v1/projects/demo-research/databases/(default)"
    "/documents/research/probe"
)
"""The one Firestore document every probe overwrites."""

FIREBASE_TOOLS_MANIFEST = (
    "/opt/firebase/node_modules/firebase-tools/package.json"
)
"""The installed `firebase-tools`, whose version names both emulators'."""

REALTIME_DATABASE_NODE = (
    "http://firebase:9000/research/probe.json?ns=demo-research"
)
"""The one Realtime Database node every probe overwrites."""


def firestore_value(value: object) -> JsonValue:
    """Encode a value as a Firestore REST `Value`.

    Raises:
        TypeError: for a value Firestore has no field type for.
    """
    if value is None:
        return {"nullValue": None}

    if isinstance(value, bool):
        return {"booleanValue": value}

    if isinstance(value, int):
        return {"integerValue": str(value)}

    if isinstance(value, float):
        return {"doubleValue": float_json(value)}

    if isinstance(value, str):
        return {"stringValue": value}

    if isinstance(value, list):
        return {
            "arrayValue": {"values": [firestore_value(item) for item in value]}
        }

    if isinstance(value, dict):
        fields = {key: firestore_value(item) for key, item in value.items()}

        return {"mapValue": {"fields": fields}}

    raise TypeError(type(value).__name__)


def firestore_vanishes(value: object) -> bool:
    """Write a field to Firestore and report whether it's gone on reading."""
    body = {"fields": {"value": firestore_value(value)}}
    request(body=body, method="PATCH", url=FIRESTORE_DOCUMENT)
    document = request(body=None, method="GET", url=FIRESTORE_DOCUMENT)
    fields = document.get("fields", {}) if isinstance(document, dict) else {}

    return not isinstance(fields, dict) or "value" not in fields


def float_json(value: float) -> float | str:
    """Spell a float as protobuf's JSON does: NaN and the infinities as text."""
    if math.isnan(value):
        return "NaN"

    if math.isinf(value):
        return "Infinity" if value > 0 else "-Infinity"

    return value


def is_finite_json(value: object, *_rest: object) -> bool:
    """Report whether JSON can carry a value: no NaN or infinities inside."""
    if isinstance(value, float):
        return math.isfinite(value)

    if isinstance(value, list):
        return all(is_finite_json(item) for item in value)

    if isinstance(value, dict):
        return all(is_finite_json(item) for item in value.values())

    return True


def is_int64(value: object, *_rest: object) -> bool:
    """Report whether every int inside a value fits Firestore's 64 bits."""
    if isinstance(value, bool):
        return True

    if isinstance(value, int):
        return INT64_MIN <= value <= INT64_MAX

    if isinstance(value, list):
        return all(is_int64(item) for item in value)

    if isinstance(value, dict):
        return all(is_int64(item) for item in value.values())

    return True


def realtime_database_vanishes(value: object) -> bool:
    """Write a node to the Realtime Database and report whether it's gone."""
    request(body={"value": value}, method="PUT", url=REALTIME_DATABASE_NODE)
    node = request(body=None, method="GET", url=REALTIME_DATABASE_NODE)

    return not isinstance(node, dict) or "value" not in node


def request(*, body: object, method: str, url: str) -> object:
    """Send one JSON request to an emulator and parse its JSON reply.

    Raises:
        urllib.error.HTTPError: when the emulator rejects the request.
    """
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {**AUTHORIZATION, "Content-Type": "application/json"}

    with urllib.request.urlopen(
        urllib.request.Request(url, data=data, headers=headers, method=method)
    ) as response:
        return json.load(response)


def tools_version() -> str:
    """Read the installed `firebase-tools` version."""
    with open(FIREBASE_TOOLS_MANIFEST, encoding="utf-8") as manifest:
        return str(json.load(manifest)["version"])


VERSION = f"firebase-tools {tools_version()}"
"""The CLI that pins both emulators; it ships the jars it runs."""

TOOLS: list[Tool] = [
    {
        "functions": {
            "isSafeEmpty": [
                {
                    "accepts": is_finite_json,
                    "call": "set(ref, { value }); value is gone on get",
                    "run": realtime_database_vanishes,
                }
            ],
        },
        "name": "Firebase Realtime Database",
        "tier": 3,
        "version": VERSION,
    },
    {
        "functions": {
            "isSafeEmpty": [
                {
                    "accepts": is_int64,
                    "call": "setDoc(doc, { value }); value is gone on get",
                    "run": firestore_vanishes,
                }
            ],
        },
        "name": "Cloud Firestore",
        "tier": 3,
        "version": VERSION,
    },
]

if __name__ == "__main__":
    run_adapter(tools=TOOLS)
