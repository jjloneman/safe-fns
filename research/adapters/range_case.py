"""The shape of a `range` case, shared by the Python-driven adapters.

A case is `[end]`, `[start, end]`, or `[start, end, options]`, where the
options hold `step` and `inclusive`, as safe-fns' planned `range` takes them.
"""

from __future__ import annotations

import math
from typing import TypedDict, cast

MAX_RANGE_LENGTH = 10_000
"""The most items a `range` probe builds; a longer span is `n/a`.

A tool that loops builds every item, so a span near the array limit would
run for minutes or exhaust the container's memory.
"""


class RangeCase(TypedDict):
    """A `range` case's parts, with `None` for an argument it left out."""

    end: object
    """The end, which every form has."""

    inclusive: bool
    """Whether the options ask for `end` to be included."""

    start: object
    """The start, or `None` for the one-argument form."""

    step: object
    """The step, or `None` when the options leave it out."""


def is_number(value: object) -> bool:
    """Report whether a value is an int or a float, never a bool."""
    return isinstance(value, int | float) and not isinstance(value, bool)


def is_short_span(*, case: RangeCase, start: float) -> bool:
    """Report whether a numeric case holds at most `MAX_RANGE_LENGTH` items.

    The count is `|end - start| / |step|`, either way, with a missing step of
    1 and a missing start of `start`. Anything else (a non-number, a value
    that isn't finite, or a zero step) is not short.
    """
    parts = [
        start if case["start"] is None else case["start"],
        case["end"],
        1 if case["step"] is None else case["step"],
    ]

    if not all(is_number(part) for part in parts):
        return False

    first, end, step = (float(cast("float", part)) for part in parts)

    if not all(math.isfinite(part) for part in (first, end, step)) or not step:
        return False

    # Divide first: `end - first` overflows near the largest float.
    return abs(end / step - first / step) <= MAX_RANGE_LENGTH


def number_text(number: object) -> str:
    """Spell a case's number as text a decimal tool reads as the case means it.

    `repr` gives a fraction as written (`0.1`), but rounds an integer of 16 or
    more digits into exponent form (`1.152921504606847e+18`), so an integral
    float is spelled out exactly instead.
    """
    if (
        isinstance(number, float)
        and number.is_integer()
        and "e" in repr(number)
    ):
        return str(int(number))

    return repr(number)


def read_range_case(
    *args: object, has_end_form: bool, option_keys: frozenset[str]
) -> RangeCase | None:
    """Read a case's parts, or `None` if the call can't express its form.

    A one-argument case needs `has_end_form`, and options may hold only
    `option_keys`, with `inclusive` only as `True`.
    """
    if len(args) == 1:
        return (
            {"end": args[0], "inclusive": False, "start": None, "step": None}
            if has_end_form
            else None
        )

    if len(args) == 2:
        # `[end, options]` is safe-fns' own form; no other tool has it.
        if isinstance(args[1], dict):
            return None

        return {
            "end": args[1],
            "inclusive": False,
            "start": args[0],
            "step": None,
        }

    if len(args) != 3 or not isinstance(args[2], dict):
        return None

    options: dict[str, object] = args[2]

    if (
        not set(options) <= option_keys
        or options.get("inclusive", True) is not True
    ):
        return None

    return {
        "end": args[1],
        "inclusive": "inclusive" in options,
        "start": args[0],
        "step": options.get("step"),
    }
