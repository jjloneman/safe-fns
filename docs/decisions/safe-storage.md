---
type: Decision
title: How the storage wrappers behave
description: safeStorageGetItem / SetItem / RemoveItem take an area option defaulting to local, plus six fixed-area aliases; reads return the fallback for a missing key or blocked storage, and writes report success as a boolean.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T03:42:10Z }
---

# How the storage wrappers behave

The storage wrappers make `localStorage` and `sessionStorage` safe to touch in any environment, with the same code everywhere.

## Decision

- **Three base functions:**

  ```ts
  safeStorageGetItem(key: string, options?: { area?: "local" | "session"; fallback?: F }): string | null | F
  safeStorageSetItem(key: string, value: string, options?: { area?: "local" | "session" }): boolean
  safeStorageRemoveItem(key: string, options?: { area?: "local" | "session" }): boolean
  ```

  - `area` defaults to `"local"`.

- **Six aliases fix the area,** each its own subpath:
  - `safeLocalStorageGetItem(key, options?)`, `safeLocalStorageSetItem(key, value)`, `safeLocalStorageRemoveItem(key)`;
  - `safeSessionStorageGetItem(key, options?)`, `safeSessionStorageSetItem(key, value)`, `safeSessionStorageRemoveItem(key)`.
- **A missing key returns `null`, exactly as native `getItem` does.**
- **Storage that can't be reached returns the fallback, `undefined` by default:**
  - no `localStorage` global during server rendering, so the call throws a `TypeError`;
  - Node's own Web Storage global (Node 25+) when it isn't configured;
  - a `SecurityError` in a sandboxed iframe or with cookies blocked.
- **`setItem` and `removeItem` return whether they succeeded.**
  - `setItem` returns `false` on `QuotaExceededError` or blocked storage.
- **No environment probe.** Each call reads `globalThis.localStorage` or `globalThis.sessionStorage` inside a `try`, every time, so a permission change between calls is seen.
- **No coercion.** A non-string `key` or `value` at runtime returns the fallback or `false`, where native storage would store `"[object Object]"`.
- **Stored JSON** is read with `safeParseJson(safeLocalStorageGetItem(key))`; these wrappers only handle strings.

## Why

- The owner asked for the wrappers and the fixed-area aliases (see [When a name starts with `safe`](safe-prefix-naming.md)).
- Merely reading `localStorage` can throw, so every access has to be guarded, not just `setItem`.
- A missing key keeps native `null`, as [When a name starts with `safe`](safe-prefix-naming.md) requires (same result on success), so a migrated `=== null` check keeps working; only a failure returns the fallback.

## Consequences

- The [environment principle](../../AGENTS.md#-design-principles) applies as written for side-effecting exports: the same code runs everywhere, and the result depends on what the environment provides; the docs say so.
- `size-limit` gives each alias its own budget; an alias imports its base function, so it adds only a few bytes.
