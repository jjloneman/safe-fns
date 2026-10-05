---
type: Decision
title: What every export promises
description: Every export is total and precisely typed; taking an `unknown` value is the common case, not a requirement.
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-01T15:00:00Z }
verified: { by: human:jjloneman, at: 2026-10-05T15:38:06Z }
---

# What every export promises

Every export keeps the same four promises, whatever its input type.

## Decision

- **Total.** It never throws, whatever it's given.
  - That covers getters, proxies, revoked proxies, and `toString` / `valueOf` traps.
  - Input it can't handle returns the caller's fallback, or a documented neutral result such as `[]` from `range`.
- **Precisely typed.** The return type is as narrow as the input allows.
  - `upperFirst("hello")` returns `Capitalize<"hello">`, not `string`.
- **Zero-dependency and environment-independent.** The same code runs in Node, every browser, and any other runtime, with no environment checks.
  - A pure function gives the same result everywhere.
  - A side-effecting export's result can depend on what the environment provides — `safeLocalStorageGetItem` returns the fallback in Node, where there is no `localStorage` — and its docs say so.
- **Taking `unknown` is common, not required.**
  - Parsers and guards take `unknown`.
  - `range`, `upperFirst`, `pluralize`, and `toMs` take typed input and still belong, because they keep the other promises.
- **Side effects only where they are the whole job.**
  - `createLogger` writes to `console`; the storage wrappers read and write Web Storage.
  - They stay total: a missing `console` method becomes a no-op, and unavailable storage returns the fallback.

## Why

- The original promise, "an `unknown` value in, a safe typed value out", shut out helpers the owner copies between projects (`range`, `upperFirst`, `pluralize`, `toMs`).
- Those helpers share what makes the package worth depending on: they can't throw, and their types are exact.
- "Never throws" is the property callers rely on; the input type is incidental.
- The owner confirmed the wider promise on PR [#28](https://github.com/jjloneman/safe-fns/pull/28).

## Consequences

- The README's first line and AGENTS.md's "Purpose of this repo" describe this wider promise, not just `unknown` input.
- AGENTS.md's "Environment-independent" principle carries the same side-effect wording.
- The scope test moves from "is the input `unknown`?" to "is it total, typed, dependency-free, and not already native?" — see [What the package leaves to native APIs and other libraries](native-first-scope.md).
