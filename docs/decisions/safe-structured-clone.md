---
type: Decision
title: What safeStructuredClone returns when cloning fails
description: The native structuredClone result when it succeeds, and the caller's fallback (undefined by default) when it throws or the runtime has no structuredClone.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T03:42:10Z }
---

# What safeStructuredClone returns when cloning fails

`safeStructuredClone(value, options?)` is `structuredClone` with a fallback in place of the exception.

## Decision

- **Signature:** `safeStructuredClone<T, F = undefined>(value: T, options?: { fallback?: F; transfer?: Transferable[] }): T | F`.
  - `transfer` is the native option, passed through; `fallback` is added beside it.
- **Returns the fallback** when `structuredClone` throws:
  - a function, symbol, or DOM node anywhere in the value;
  - a getter or proxy trap that throws while the value is read;
  - a `transfer` list it rejects.
- **Returns the fallback where the runtime has no `structuredClone`,** by calling it inside the same `try`, with no environment probe.
- **Successful clones follow the native rules,** which the docs list:
  - class instances come back as plain objects, losing their prototype;
  - property getters are read and stored as values;
  - `Error`, `Date`, `Map`, `Set`, `RegExp`, typed arrays, and cycles are kept.

## Why

- lodash's `cloneDeep` is excluded in favor of the native API (see [What the package leaves to native APIs and other libraries](native-first-scope.md)), but the native call throws on ordinary app data such as an object holding a callback.

## Consequences

- The `T` return type overstates a clone of a class instance, which loses its methods; that matches TypeScript's own `structuredClone` typing, and the docs call it out.
