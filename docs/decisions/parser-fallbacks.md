---
type: Decision
title: What a parser returns when it can't parse
description: Parsers return the caller's fallback, `undefined` by default, for any input they don't recognize — never a guess.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-03T21:14:18Z }
---

# What a parser returns when it can't parse

A parser either recognizes its input or returns the caller's fallback; it never guesses.

## Decision

- **Every parser has one shape:** `safeParseX(value: unknown, options?: { fallback?: F }): X | F`.
  - That includes `safeParseJson(value, { fallback })`: a value that isn't a string, or isn't valid JSON, returns the fallback.
- **Any other `safe` wrapper keeps its native arguments and adds the same option,** e.g. `safeStructuredClone(value, { fallback })`.
  - The rules below apply wherever a function returns a fallback.
- **The fallback defaults to `undefined`,** so a caller can tell "missing or invalid" from a real value.
- **Unrecognized input returns the fallback, never a coercion.**
  - `safeParseBoolean("maybe")` returns the fallback, not `Boolean("maybe")`, which is `true`.
  - `safeParseNumber("")` returns the fallback, not `Number("")`, which is `0`.
- **The fallback is a value, never a thunk,** so it can't throw.

## Why

- The owner's existing copies hide bad input:
  - `safeParseNumber` defaults to `0`, so `"0"` and `"garbage"` both come back as `0`;
  - `safeParseBoolean` falls back to JavaScript truthiness, so any non-empty unrecognized string is `true`.
- An `undefined` default makes the failure visible in the type (`number | undefined`), and TypeScript then asks the caller to handle it.

## Consequences

- Existing call sites need migrating; the README's "Migrating from copy-pasted helpers" section adds these notes when the parsers ship:
  - a caller that relied on `0` passes `{ fallback: 0 }`;
  - a caller that relied on truthiness gets the fallback for unrecognized strings.

## Open

- The owner hasn't confirmed the `undefined` default yet; the migration cost falls on the owner's own work code.
