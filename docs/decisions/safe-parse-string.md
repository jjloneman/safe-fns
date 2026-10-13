---
type: Decision
title: What safeParseString accepts and returns
description: Strings, finite numbers, bigints, and booleans come back as a trimmed, non-blank string; blank text and every other value return the fallback.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-12T01:20:00Z }
---

# What safeParseString accepts and returns

`safeParseString(value, { fallback })` turns a value that has an obvious text form into trimmed, non-blank text.

## Decision

- **Accepted input, and what it becomes:**
  - a string, trimmed of the same characters `isSafeEmpty` treats as blank (whitespace, zero-width and other invisible characters, and the braille blank), through the shared internal `trimBlank`;
  - a finite number, as `String(value)` (`1.5` → `"1.5"`, `-0` → `"0"`);
  - a bigint, as `String(value)` (`12n` → `"12"`);
  - a boolean, as `"true"` or `"false"`.
- **A blank result returns the fallback,** judged by the same test as `isSafeEmpty` (see [What "empty" means](is-safe-empty.md)), so `""`, `"   "`, and `"\u200B"` never come back.
- **Everything else returns the fallback:**
  - `null`, `undefined`, `NaN`, and `±Infinity`;
  - symbols, functions, arrays, and objects, including boxed strings and anything with a custom `toString`.

## Why

- It replaces the `isNonBlankString` type guard, which [How predicates are named](predicate-naming.md) dropped: callers that wanted "a usable string or nothing" get it in one call.
- The owner chose to stringify primitives, so a numeric ID or a boolean flag read from loosely typed data comes through as text.
- Objects are excluded because their text form is either `"[object Object]"` or a `toString` that can throw or lie.

## Consequences

- The returned string can differ from the input string by its surrounding whitespace; a caller that needs the exact text checks `typeof value === "string"` instead.
