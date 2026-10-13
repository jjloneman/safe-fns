---
type: Decision
title: How getErrorMessage and toError read a thrown value
description: A message comes from an Error, a thrown string, or an object's own string message, never from nested framework shapes; getErrorMessage always returns a string, and toError returns an existing Error untouched.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T03:42:10Z }
---

# How getErrorMessage and toError read a thrown value

JavaScript can throw anything, so both helpers read a `catch` binding defensively and share the rules for finding a message; only `toError` falls back to the value's JSON text.

## Decision

### Where a message comes from

- **In order, the first non-blank string wins:**
  1. a thrown string, as-is;
  2. an `Error` instance's `message`, read through its getter if it has one (`DOMException`);
  3. an object whose `Object.prototype.toString` tag is `[object Error]` or `[object DOMException]`, from any realm, read through its `message` getter; the tag can be spoofed, but only the message text is at stake;
  4. any other object's **own** `message` property, when it's a string, which covers thrown API payloads.
- **Nothing is unwrapped further.** A nested `error.error.message` (Angular's `HttpErrorResponse`) or a `cause` chain isn't followed; framework shapes stay in the app.
- **The message is returned as written,** not trimmed and not prefixed with the error's `name`.
- **A blank message counts as no message.**

### `getErrorMessage(error, options?: { fallback?: string }): string`

- **Returns the message, or the caller's fallback, which defaults to `"Unknown error"`.**
- It always returns a `string`, so the result drops straight into a toast or a log line.
- This is a deliberate exception to the `undefined` default in [What a parser returns when it can't parse](parser-fallbacks.md), chosen by the owner (2026-10-05) because every caller the scan found wanted text to display or log.

### `toError(value, options?: { fallback?: string }): Error`

- **An `Error` instance from this realm is returned unchanged,** keeping its stack, its subclass, and its identity.
- **Anything else is wrapped** in `new Error(message, { cause: value })`, so the original value stays reachable.
  - The message comes from the rules above; failing that, for a value that isn't error-tagged, from `safeJsonStringify(value)`, so `throw { code: 42 }` reads `{"code":42}`, not `[object Object]`;
  - failing both, from `fallback`, which defaults to `"Unknown error"`.
- **An `Error` from another realm is wrapped,** since `instanceof Error` can't see it and `Error.isError` isn't on Node 22; its message is still read through the error-tag rule above.

## Why

- The owner's copies had four fallback conventions: `String(error)`, a literal `"Unknown error"`, an `HttpErrorResponse` branch, and `error.message || error.name || "Error"`.
- Reading an own `message` on any object covers thrown payloads without the duck-typing of reaching into nested shapes.
- `new Error(error)` rewraps an existing error as `"TypeError: boom"` and loses its stack and type, and `new Error(Object.create(null))` throws.

## Consequences

- An app that unwraps `HttpErrorResponse` keeps a small adapter that calls `getErrorMessage(response.error)`.
