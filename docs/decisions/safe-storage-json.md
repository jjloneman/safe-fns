---
type: Decision
title: How the JSON storage helpers read and write
description: "`safeStorageGetJson(key, options?)` reads a key and parses it as `safeParseJson` does, with its `guard`, and `safeStorageSetJson(key, value, options?)` writes exactly what `safeJsonStringify` returns, with all its options but `fallback`, and returns whether it did; both take `area`, and four fixed-area aliases ship as the string wrappers' six do; a missing key, unreachable storage, text that isn't JSON, or a guard that rejects returns the `fallback` option, `undefined` by default; where `safeJsonStringify` would return its fallback, the write stores nothing, keeps the key's old value, and returns `false`."
tags: [storage, encoding, fallback]
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-10T01:57:53Z }
verified: { by: human:jjloneman, at: 2026-11-10T07:41:00Z }
---

# How the JSON storage helpers read and write

`safeStorageGetJson(key, { guard })` and `safeStorageSetJson(key, value)` replace the one-line compositions `safeParseJson(safeLocalStorageGetItem(key), { guard })` and `safeLocalStorageSetItem(key, safeJsonStringify(value))`, beside the string wrappers in [How the storage wrappers behave](safe-storage.md).

## Decision

- **Signatures:**

  ```ts
  safeStorageGetJson<T = JsonValue, F = undefined>(
    key: string,
    options?: {
      area?: "local" | "session";
      fallback?: F;
      guard?: (value: unknown) => value is T;
    },
  ): T | F

  safeStorageSetJson(
    key: string,
    value: unknown,
    options?: {
      area?: "local" | "session";
      bigint?: "fallback" | "string";
      circular?: "fallback" | "replace";
      circularPlaceholder?: string;
      replacer?: ((this: unknown, key: string, value: unknown) => unknown) | (number | string)[] | null;
      space?: number | string;
    },
  ): boolean
  ```

  - They're separate functions, not a `json` option on the string wrappers, so each return type stays simple, as 2a's review settled.
  - `key` and `value` are the native call's values, in its order; everything else is configuration, per [the parameter rule](function-parameters.md).
  - `area` defaults to `"local"`, as the string wrappers' does.
  - `JsonValue`, `guard`, and the explicit type argument mean exactly what they mean in [safeParseJson](safe-parse-json.md): without a guard the result is a `JsonValue`, and a type argument alone is the caller's own unchecked assertion.

- **Names:** `safeStorageGetJson` and `safeStorageSetJson`, the string wrappers' names with `Item` swapped for `Json`.
  - They wrap two native calls, not one, so [the naming rule](safe-prefix-naming.md) alone would give them plain names; keeping the `safeStorage` prefix puts them beside `safeStorageGetItem` in the editor's completions, where a caller looks for them.
- **Four fixed-area aliases,** each its own subpath, as the string wrappers' six are: `safeLocalStorageGetJson`, `safeLocalStorageSetJson`, `safeSessionStorageGetJson`, and `safeSessionStorageSetJson`.
  - There's no JSON remove: removing a key doesn't depend on what it holds, so `safeStorageRemoveItem` serves both.
- **A read returns the parsed value,** judged exactly as `safeParseJson` judges text:
  - `'{"a":1}'` is `{ a: 1 }`, `"42"` and `" 42 "` are `42`, `'"hi"'` is `"hi"`, and `"null"` is `null`;
  - text that isn't JSON returns the fallback: `"hi"`, `"{"`, `""`, `"undefined"`, and `"[object Object]"`, the last two being what native `setItem` stores for `undefined` and an object;
  - a guard that rejects the parsed value, or throws, returns the fallback.
- **A missing key returns the fallback,** unlike the string wrappers' native `null`.
  - A stored `"null"` parses to `null`, so `null` has to mean the stored value; a missing key with `{ fallback: null }` reads as `null` for a caller who wants them merged.
- **A write stores exactly what [safeJsonStringify](safe-json-stringify.md) returns, and returns `true`:** `safeStorageSetJson(key, value, options)` is `safeStorageSetItem(key, safeJsonStringify(value, options))`, with the same options and defaults.
  - Its options are all of `safeJsonStringify`'s but `fallback`: `bigint`, `circular`, `circularPlaceholder`, `replacer`, and `space`, each meaning what it means there.
  - The defaults repair, as there: `12n` is stored as `"12"`, and a cycle as `"[Circular]"`; `{ bigint: "fallback", circular: "fallback" }` refuses those writes instead.
  - A repaired value reads back changed (`12n` comes back as the string `"12"`); a `guard` on the read turns that changed shape into the fallback.
  - JSON's own conversions are unchanged too: a `Date` is stored as its ISO string, `NaN` and `±Infinity` as `null`, `-0` as `0`, and an `undefined` or function property is left out.
- **Where `safeJsonStringify` would return its fallback, the write stores nothing, keeps whatever the key held, and returns `false`:**
  - a top-level `undefined`, function, or symbol, which native code stores as the text `"undefined"` that no read can parse;
  - a bigint or a cycle whose repair is turned off;
  - a `toJSON`, getter, replacer, or proxy trap that throws.
  - There's no option to write a default instead: a failed write leaves the last good value in place, and a caller who wants a default or a cleared key writes it after a `false`, as the Consequences show.
- **Storage that can't be reached returns the fallback or `false`,** exactly as the string wrappers do: no global during server rendering, Node's unconfigured `localStorage`, a `SecurityError`, or a full quota on write.
- **No coercion:** a non-string key returns the fallback or `false`, where native storage would use `"42"` for `42`.
- **Everything else returns the fallback or `false`:** an `area` other than `"local"` or `"session"`, an options object that can't be read, and anything that throws.

## Comparison

The tiers 0–2 summaries from [research/results/safe-storage-get-json.md](../../research/results/safe-storage-get-json.md) and [safe-storage-set-json.md](../../research/results/safe-storage-set-json.md), generated by `pnpm research`.

- Only JavaScript has Web Storage, so the columns are the native composition and store2, a JSON layer over it, both on Node's in-memory `sessionStorage`.
- A read case starts from a fixed set of keys, each named for the text it holds (`broken` holds `{`), and a write case from an empty area.
- Write cells show what `getItem` reads back afterward; the planned answers are what `safeStorageSetJson` returns.
- localforage is asynchronous and backed by IndexedDB, which Node doesn't have, and VueUse's serializers need Vue, so neither has a column.
- No tool takes `fallback`, `guard`, or `area`.

### `safeStorageGetJson`

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`safeStorageGetJson` | JS built-ins<br>`JSON.parse(sessionStorage.getItem(key))` | store2<br>`store.session.get(key)` |
| :--- | :--- | :--- | :--- |
| `"object"` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` |
| `"array"` | `[1, 2]` | `[1, 2]` | `[1, 2]` |
| `"number"` | `42` | `42` | `42` |
| `"string"` | `"hi"` | `"hi"` | `"hi"` |
| `"null"` | `null` | `null` | `null` |
| `"spaced"` | `42` | `42` | `42` |
| `"bare"` | `undefined` | 💥 `SyntaxError` | `"hi"` |
| `"broken"` | `undefined` | 💥 `SyntaxError` | `"{"` |
| `"empty"` | `undefined` | 💥 `SyntaxError` | `""` |
| `"undefined"` | `undefined` | 💥 `SyntaxError` | `"undefined"` |
| `"objectString"` | `undefined` | 💥 `SyntaxError` | `"[object Object]"` |
| `"missing"` | `undefined` | `null` | `null` |
| `"missing", { "fallback": null }` | `null` | — | — |
| `"object", { "guard": ‹a guard accepting only plain objects› }` | `{ "a": 1 }` | — | — |
| `"number", { "guard": ‹a guard accepting only plain objects› }` | `undefined` | — | — |
| `"object", { "area": "session" }` | `{ "a": 1 }` | — | — |
| `42` | `undefined` | `null` | `null` |
| `‹a revoked proxy›` | `undefined` | 💥 `TypeError` | 💥 `TypeError` |
<!-- prettier-ignore-end -->

### `safeStorageSetJson`

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`safeStorageSetJson` | JS built-ins<br>`sessionStorage.setItem(key, JSON.stringify(value)); sessionStorage.getItem(key)` | store2<br>`store.session.set(key, value); sessionStorage.getItem(key)` |
| :--- | :--- | :--- | :--- |
| `"key", { "a": 1 }` | `true` | `"{\"a\":1}"` | `"{\"a\":1}"` |
| `"key", "hi"` | `true` | `"\"hi\""` | `"\"hi\""` |
| `"key", 42` | `true` | `"42"` | `"42"` |
| `"key", null` | `true` | `"null"` | `"null"` |
| `"key", [1, 2]` | `true` | `"[1,2]"` | `"[1,2]"` |
| `"key", ‹a Date›` | `true` | `"\"1970-01-01T00:00:00.000Z\""` | `"\"1970-01-01T00:00:00.000Z\""` |
| `"key", NaN` | `true` | `"null"` | `"null"` |
| `"key", undefined` | `false` | `"undefined"` | `"undefined"` |
| `"key", 12n` | `true` | 💥 `TypeError` | 💥 `TypeError` |
| `"key", ‹an object with a cycle›` | `true` | 💥 `TypeError` | 💥 `TypeError` |
| `"key", 12n, { "bigint": "fallback" }` | `false` | — | — |
| `"key", ‹an object with a cycle›, { "circular": "fallback" }` | `false` | — | — |
| `"key", { "a": 1 }, { "space": 2 }` | `true` | — | — |
| `"key", ‹an object with a throwing getter›` | `false` | 💥 `Error` | 💥 `Error` |
| `"key", { "a": 1 }, { "area": "session" }` | `true` | — | — |
| `42, { "a": 1 }` | `false` | `"{\"a\":1}"` | `"{\"a\":1}"` |
<!-- prettier-ignore-end -->

## Why

- **The fallback for a missing key:** the native composition and store2 both read a missing key as `null`, the same as a stored `null`, so "never saved" and "saved as empty" can't be told apart.
- **The fallback for text that isn't JSON:** native `JSON.parse` throws `SyntaxError`, and store2 returns the raw text instead, so `"{"` comes back as the string `"{"` where an object was expected, with nothing to say the stored value was corrupt.
- **No write for `undefined`:** both tools store the text `"undefined"`, which their own read then throws on or returns as a string; refusing the write keeps the previous value readable.
- **Parity with `safeJsonStringify`:** both tools throw on a bigint or a cycle; delegating to `safeJsonStringify` with its own options and defaults makes the write total and gives it one description, "it stores what `safeJsonStringify` returns", rather than a second set of rules under the same option names.
  - `fallback` is the one option left out: a write returns `true` or `false`, so there's no value to fall back to.
- **Nothing written on failure:** the [preserving-data principle](../../AGENTS.md#-design-principles) keeps the key's last good value; writing a default would overwrite it after one bad write, and the default could fail to write as well.
- **A guard, as `safeParseJson` has:** stored data outlives the code that wrote it, so a value from an older release is the usual case a guard catches, turning "parsed, but the wrong shape" into the same fallback as "didn't parse".
- **The aliases:** the owner reads and writes JSON far more than raw strings, so the JSON helpers are the ones called most, and the string wrappers already set the pattern of one alias per area.

## Consequences

- The docs show `safeLocalStorageGetJson(key, { guard: isSettings })` and `safeLocalStorageSetJson(key, settings)`, and list what JSON changes on the way in (`Date`, `NaN`, `-0`, `undefined` properties).
- The docs say that a missing key is the fallback here but `null` in `safeStorageGetItem`, that a repaired value reads back changed, and that a write which returns `false` left the old value in place, with the two follow-ups for a failed write:

  ```ts
  if (!safeLocalStorageSetJson("settings", settings)) {
    safeLocalStorageRemoveItem("settings"); // the read's fallback then applies
  }
  ```

  - or write a default the same way, though keeping the default in the read's `fallback` puts it in one place.

- [How the storage wrappers behave](safe-storage.md) points here for stored JSON.
- [The naming rule](safe-prefix-naming.md) lists these as the storage family's JSON variants.
- `size-limit` gives each alias its own budget, as it does the string wrappers'; an alias imports its base function.
- Their tests cover each fallback and `false` case above, including unreachable storage, a revoked proxy as the key and as the options, and a guard that throws, and their type tests check that `guard` narrows the result, that `fallback` widens it, and that the write's options are `safeJsonStringify`'s, derived from its options type, less `fallback`.
