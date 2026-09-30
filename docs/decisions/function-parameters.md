---
type: Decision
title: When a function takes positional parameters
description: Two or more parameters go in one object, except for a function that mirrors a native signature or compares two values; nothing is variadic.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-30T20:24:01Z }
---

# When a function takes positional parameters

Most exports take one object; a few keep the positional shape their callers already know.

## Decision

- **The default:** one positional parameter is fine; with two or more, the function takes a single object with sorted keys.
  - Options always go in an object, even when there is only one.
- **The exception (owner's call, 2026-09-30):** positional parameters are allowed for a function that
  - mirrors a native API's signature — `safeObjectHasOwn(value, key)`, like `Object.hasOwn(value, key)`; or
  - compares two values — `isDeepEqual(a, b)`.
  - Options still follow as a trailing object: `isDeepEqual(a, b, { ignoreArrayOrder: true })`.
- **Nothing is variadic.**
  - A trailing options object would be indistinguishable from one more value to compare.
  - Every equality helper checked takes exactly two values: lodash's `isEqual`, es-toolkit's `isEqual`, ramda's `equals`, remeda's `isDeepEqual` (which throws on a third), and Node's `util.isDeepStrictEqual`.
  - Several values compare against the first: `rest.every((value) => isDeepEqual(first, value))`.

## Why

- `isDeepEqual({ left, right })` and `safeObjectHasOwn({ key, value })` read worse than the positional forms, and break the "stay close to native" naming rule (see [When a name starts with `safe`](safe-prefix-naming.md)).
- Everywhere else, an object keeps call sites self-describing and lets options grow without breaking changes.

## Consequences

- AGENTS.md's "Function parameters" rule names this exception.
