"""The XML Schema adapter: decodes each case as an XSD 1.0 built-in type.

Usage: `python xml_schema.py <case-file>...`, inside the `xml-schema` Compose
service, whose image adds the `xmlschema` package to the pinned Python.
"""

from __future__ import annotations

import re
from importlib.metadata import version
from pathlib import Path
from xml.sax.saxutils import escape

import xmlschema
from research_codec import Probe, Tool, run_adapter

XML_UNSAFE = re.compile("[\x00-\x08\x0b-\x1f\ud800-\udfff\ufffe\uffff]")
"""Characters XML 1.0 content can't carry unchanged, so their cases are `n/a`.

Most C0 controls are forbidden outright, and `\\r` is normalized to `\\n`;
either way the outcome would be the XML parser's, not the type's.
"""

SCHEMA = xmlschema.XMLSchema10(Path(__file__).with_name("xml-schema.xsd"))
"""The schema whose elements name the built-in types (`xml-schema.xsd`)."""


def decode_as(*, element: str, value: str) -> object:
    """Decode a value as the content of one of the schema's elements."""
    return SCHEMA.decode(f"<{element}>{escape(value)}</{element}>")


def is_xml_text(value: object, *_rest: object) -> bool:
    """Accept only a string XML can carry as element content, unchanged."""
    return isinstance(value, str) and XML_UNSAFE.search(value) is None


def type_probe(element: str) -> Probe:
    """Build the probe that decodes a case as one built-in type."""
    return {
        "accepts": is_xml_text,
        "call": f"decode(<{element}>value</{element}>)",
        "run": lambda value: decode_as(element=element, value=value),
    }


TOOLS: list[Tool] = [
    {
        "functions": {
            "safeParseBoolean": [type_probe("boolean")],
            "safeParseInteger": [type_probe("integer")],
            "safeParseNumber": [type_probe("double")],
            "safeParseString": [type_probe("string"), type_probe("token")],
        },
        "name": "XML Schema 1.0",
        "tier": 3,
        "version": f"xmlschema {version('xmlschema')}",
    }
]
"""The one tool this adapter runs: XSD 1.0's built-in types."""


if __name__ == "__main__":
    run_adapter(tools=TOOLS)
