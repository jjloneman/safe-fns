---
type: Decision
title: What safeParseNumber and safeParseInteger accept
description: Finite numbers, safe-range bigints, and trimmed decimal strings parse; hex, units, separators, blanks, and non-finite values return the fallback, and a value outside min / max returns the fallback unless clamp is set.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-12T21:00:00Z }
---

# What safeParseNumber and safeParseInteger accept

Both parsers read a decimal number the same way on every engine, and return the caller's fallback for anything else.

## Decision

- **Signatures:**

  ```ts
  safeParseNumber(value: unknown, options?: { clamp?: boolean; fallback?: F; max?: number; min?: number }): number | F
  safeParseInteger(value: unknown, options?: { clamp?: boolean; fallback?: F; max?: number; min?: number }): number | F
  ```

- **Accepted input:**
  - a finite number primitive, returned as-is (including `-0`);
  - a bigint between `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER`, converted exactly (`12n` → `12`);
  - a string that, after trimming, is a decimal: an optional `+` / `-`, digits with an optional fraction (`5`, `5.`, `.5`, `5.25`), and an optional exponent (`1e3`, `2.5E-4`).
    - Trimming strips the same characters `isSafeEmpty` treats as blank (whitespace, zero-width and other invisible characters, and the braille blank) from both ends, through a shared internal `trimBlank`, so a number pasted with a zero-width space (`"\u200B42"`) parses.
    - Those characters inside the number (`"4\u200B2"`) still return the fallback.
    - Leading zeros parse (`"007"` → `7`), as do `"-0"`, `"5."`, and `".5"`; `"."`, `"+"`, `"e3"`, and `"1e"` don't.
- **Everything else returns the fallback,** never a coercion:
  - blank and whitespace-only strings (`Number("")` is `0`);
  - hex, binary, and octal strings (`"0x1f"`, `"0b1"`, `"0o7"`), which `Number()` accepts; a number has no base, only text does, so a hex literal in code (`0x1f`) arrives as the number `31` and parses, and hex text belongs to `Number.parseInt(text, 16)`;
  - digits from other scripts (`"٤٢"`, `"４２"`), which `Number()` also rejects, though Python accepts them;
  - trailing text (`"12px"`, which `parseFloat` reads as `12`) and digit separators (`"1_000"`, `"1,000"`);
  - `NaN`, `Infinity`, `"Infinity"`, and a string that overflows to `Infinity` (`"1e999"`);
  - a bigint outside the safe integer range, `null`, booleans, boxed numbers, arrays (`Number([5])` is `5`), and objects.
- **`safeParseInteger` also requires `Number.isSafeInteger`:**
  - `"1.5"` returns the fallback rather than truncating;
  - `"1.0"` and `"1e3"` parse, since their values are integers;
  - a value past `Number.MAX_SAFE_INTEGER` (2⁵³ − 1, the largest integer `n` where `n` and `n + 1` are both stored exactly in a 64-bit double) returns the fallback, since a different integer would come back;
  - `"-0"` and `-0` return `0`, since integers have no negative zero, as in Python and Ruby; `safeParseNumber` keeps `-0`, as `Number()` does.
- **`min` and `max` are inclusive bounds.**
  - By default, a value outside them returns the fallback.
  - `clamp: true` returns the nearest bound instead.
  - A bound that is `NaN`, a `safeParseInteger` bound that isn't a safe integer or `±Infinity`, or `min` greater than `max` returns the fallback for every input rather than guessing which bound the caller meant.

- **Rounding is accepted, as in every language:**
  - a long decimal is rounded to the nearest double, so `safeParseNumber("9007199254740993")` returns `9007199254740992`, as `Number()` does;
  - a value too small to represent becomes `0` or `-0` (`"1e-400"`), as in JavaScript, Python, Ruby, and Java;
  - only overflow to `±Infinity` returns the fallback, because the result must be finite.

## Why

- The owner's shared `safeParseNumber` defaulted to `0`, and most inline call sites let `NaN` from `Number()` or `parseFloat` propagate; neither shows the caller that the input was bad.
- `Number()` silently turns `""`, `null`, `true`, and `[5]` into numbers, and `parseFloat` silently drops trailing text, so a narrow decimal grammar is the only rule with no surprises.
- Every row of the grammar matches `Number()`, checked on Node 26 against `parseFloat`, lodash's `toNumber`, Python, and Ruby, apart from the inputs `Number()` gets wrong on purpose here (blanks, hex text, `null`, booleans, arrays).
- Clamping changes the caller's value, so it's opt-in; the owner asked for it as an option rather than the default.

## Consequences

- Callers that relied on `0` for bad input pass `{ fallback: 0 }`.
- Integers beyond the safe range need a `bigint`; a separate `safeParseBigInt` is a part 2b candidate, since an option that switched the return type between `number` and `bigint` would be easy to mistype.
- Locale-formatted input (`"1,234.50"`, `"1.234,50"`) belongs to a separate amount parser, which is parked (see [What the package leaves to native APIs and other libraries](native-first-scope.md)).
