---
type: Decision
title: What safeParseJson returns
description: A JsonValue by default; an optional guard checks the shape at runtime and returns the fallback when it fails, and an explicit type argument is the caller's own unchecked assertion.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T03:42:10Z }
---

# What safeParseJson returns

`safeParseJson` parses JSON text and types the result as exactly what JSON can hold, unless the caller supplies a check or vouches for a type.

## Decision

- **Signature:**

  ```ts
  export type JsonValue = boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

  safeParseJson<T = JsonValue, F = undefined>(
    value: unknown,
    options?: {
      fallback?: F;
      guard?: (value: unknown) => value is T;
    },
  ): T | F
  ```

- **Input that isn't a string, or isn't valid JSON, returns the fallback.**
- **Without a guard, the result is a `JsonValue`,** the precise union of what `JSON.parse` can produce.
- **With a guard, the result is the guard's type.**
  - The guard runs after parsing; a value it rejects, or a guard that throws, returns the fallback.
  - `safeParseJson(text, { guard: isUser })` is `User | undefined`, and is only ever a `User` that passed `isUser`.
- **An explicit type argument is allowed, and is unchecked.**
  - `safeParseJson<User>(text)` is typed `User | undefined` without any runtime check, the same as writing `as User`.
  - The docs say so where they show it, and recommend the guard.
  - TypeScript can't infer one type argument while the other is given, so an explicit type with a fallback names both: `safeParseJson<User, null>(text, { fallback: null })`.
- **No reviver.** Revival is the caller's job after parsing.
- **`JsonValue` is exported,** so callers can name the default result type.

## Why

- An unchecked generic would break the package's promise of precise types: `safeParseJson<User>('{"name": 1}')` is typed as a `User` whose `name` is really a number.
- The owner wanted a named type available anyway, for code that already trusts its source; making it an explicit choice keeps the default honest.
- The guard turns "parsed, but the wrong shape" into the same fallback as "didn't parse", which is what call sites reading `localStorage` or cookies want.
- The guard takes `unknown`, not `JsonValue`, so a guard for an `interface` or a type with optional properties compiles; TypeScript rejects `value is User` against `JsonValue` because an interface has no index signature.
- All three forms were checked on TypeScript 6.0 and 4.9.

## Consequences

- With `{ fallback: null }`, the result type collapses to `JsonValue`, since `null` is valid JSON, and a parsed `null` can't be told from a failure; the default `undefined` avoids that, because JSON can't produce `undefined`.
- A parsed object can carry an own `__proto__` key; `JSON.parse` stores it as data, and object spread copies it safely, but `Object.assign` or a merge that assigns `target[key] = …` sets the target's prototype instead; `deepMerge` skips that key.
