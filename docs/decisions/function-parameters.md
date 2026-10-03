---
type: Decision
title: How a function takes its parameters
description: Up to two positional parameters for the values a function works on, configuration in a trailing options object, and nothing variadic.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-03T21:14:18Z }
---

# How a function takes its parameters

A public export's parameters split into the values it works on, which are positional, and the configuration that tweaks its behavior, which goes in an object.

- This covers the public API — the exports of `src/`.
- Internal code (`scripts/`, and helpers no consumer imports) takes a single object for two or more parameters, per AGENTS.md.

## Decision

- **Values are positional, one or two of them.**
  - One value: `isSafePopulated(value)`, `safeParseJson(value)`, `upperFirst(text)`.
  - Two values, where the function naturally relates them: `isDeepEqual(a, b)`, `safeObjectHasOwn(value, key)`, `keyBy(items, key)`.
  - A function that wraps a native API keeps its parameters in the native order: `safeObjectHasOwn(value, key)`, like `Object.hasOwn(value, key)`.
- **Configuration goes in a trailing options object, even with one key.**
  - `deepSortObject(value, { sortArrays: true })`, never `deepSortObject(value, true)`.
  - `isDeepEqual(a, b, { ignoreArrayOrder: true })`.
  - The key names the setting at the call site, and new settings can be added later without breaking callers.
- **More than two values go in one object** with sorted keys.
- **Nothing is variadic.**
  - A trailing options object would be indistinguishable from one more value.
  - Every equality helper checked takes exactly two values: lodash's `isEqual`, es-toolkit's `isEqual`, ramda's `equals`, remeda's `isDeepEqual` (which throws on a third), and Node's `util.isDeepStrictEqual`.
  - Several values compare against the first: `rest.every((value) => isDeepEqual(first, value))`.

## Why

- Positional values read naturally for the one or two things a function is about: `isDeepEqual(a, b)`, not `isDeepEqual({ left, right })`.
- A bare positional flag or number hides its meaning: `deepSortObject(value, true)` doesn't say what `true` does, and `safeParseInteger(value, 10)` reads like `parseInt`'s radix.

## Consequences

- AGENTS.md's "Function parameters" rule states this as its public-API case, beside the rule for internal code.
- The base storage wrapper takes its area as configuration: `safeStorageGetItem(key, { area: "session" })`.
