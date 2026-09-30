---
type: Decision
title: When a name starts with `safe`
description: "`safe` + the native API's path for a wrapper of one native API, `safeParse*` for coercers, `isSafe*` against a same-named unsafe helper, and plain names otherwise."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-30T20:24:01Z }
---

# When a name starts with `safe`

`safe` appears only where it tells the reader something: which familiar API this is the safe version of.

## Decision

- **A wrapper of one specific native API is `safe` + that API's path**, in camelCase:

  | Native API                  | Export                |
  | :-------------------------- | :-------------------- |
  | `JSON.parse`                | `safeJsonParse`       |
  | `JSON.stringify`            | `safeJsonStringify`   |
  | `Object.hasOwn`             | `safeObjectHasOwn`    |
  | `structuredClone`           | `safeStructuredClone` |
  | `Storage.prototype.getItem` | `safeStorageGetItem`  |
  - Its shape stays close to the native API: the native arguments in the native order, and the same result on success; anything extra goes in an options object.
  - `safeLocalStorageGetItem(key)` and `safeSessionStorageGetItem(key)` mirror `getItem(key)` exactly; the base `safeStorageGetItem({ area, key })` takes one object, per [the parameter rule](function-parameters.md).

- **A coercer from `unknown` to a primitive type is `safeParse` + the type:** `safeParseNumber`, `safeParseInteger`, `safeParseBoolean`, `safeParseString`.
  - These wrap no single native call; mirroring one would read worse (`safeNumberParseFloat`).
- **A predicate that shares a name with a well-known unsafe helper is `isSafe` + the name, and its positive twin keeps the same prefix:** `isSafeEmpty` (against lodash's and ramda's `isEmpty`) and its pair `isSafePopulated`.
  - The pair reads as mirror images, and the owner's existing call sites already use both names.
- **Everything else gets a plain name:** `deepMerge`, `keyBy`, `isDeepEqual`, `getErrorMessage`, `toError`, `upperFirst`, `pluralize`, `toMs`, `range`, `getSearchParamValues`.

## Why

- A reader can predict a `safe` export's behavior from its name: the native call they know, except it can't throw.
- On every name, `safe` would carry no information, since every export is total (see [What every export promises](package-promise.md)).
- `safeJsonParse` is also the most common hand-written name for the helper: 35.8k files on GitHub code search (2026-09-29).

## Consequences

- Names from [#1](https://github.com/jjloneman/safe-fns/issues/1)'s starting table change:
  - `safeParseJson` → `safeJsonParse`;
  - `safeStringify` → `safeJsonStringify`;
  - `safeHasOwn` → `safeObjectHasOwn`.
- The README's planned API table uses the new names.
- The owner adopted this rule on 2026-09-30 in [#10](https://github.com/jjloneman/safe-fns/issues/10).
