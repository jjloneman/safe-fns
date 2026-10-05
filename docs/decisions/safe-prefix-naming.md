---
type: Decision
title: When a name starts with `safe`
description: "`safeParse` + what it reads for every parser, `safe` + the native API's path for any other wrapper of one native API, `isSafe*` against a same-named unsafe helper, and plain names otherwise."
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-03T21:14:18Z }
verified: { by: human:jjloneman, at: 2026-10-05T15:38:06Z }
---

# When a name starts with `safe`

`safe` appears only where it tells the reader something: which familiar API this is the safe version of.

## Decision

- **Every parser is `safeParse` + what it reads:** `safeParseJson`, `safeParseNumber`, `safeParseInteger`, `safeParseBoolean`, `safeParseString`.
  - A parser takes any value and returns a typed result or the caller's fallback, so they share one shape (see [What a parser returns when it can't parse](parser-fallbacks.md)).
  - Typing `safeParse` lists every parser, and the verb comes first, as it reads: "parse as JSON".
  - Native parse methods aren't mirrored: `safeParseNumber` does more than `Number.parseFloat` (finite checks, `min` / `max`), and `Boolean` has no parse method at all.
- **Any other wrapper of one specific native API is `safe` + that API's path**, in camelCase:

  | Native API                  | Export                |
  | :-------------------------- | :-------------------- |
  | `JSON.stringify`            | `safeJsonStringify`   |
  | `Object.hasOwn`             | `safeObjectHasOwn`    |
  | `structuredClone`           | `safeStructuredClone` |
  | `Storage.prototype.getItem` | `safeStorageGetItem`  |
  - Its shape stays close to the native API: the native arguments in the native order, and the same result on success; anything extra goes in an options object.
  - `safeLocalStorageGetItem(key)` and `safeSessionStorageGetItem(key)` mirror `getItem(key)` exactly; the base `safeStorageGetItem(key, { area })` takes the area as configuration, per [the parameter rule](function-parameters.md).

- **A predicate that shares a name with a well-known unsafe helper is `isSafe` + the name, and its positive twin keeps the same prefix:** `isSafeEmpty` (against lodash's and ramda's `isEmpty`) and its pair `isSafePopulated`.
  - The pair reads as mirror images, and the owner's existing call sites already use both names.
- **Everything else gets a plain name:** `deepMerge`, `keyBy`, `isDeepEqual`, `getErrorMessage`, `toError`, `upperFirst`, `pluralize`, `toMs`, `range`, `getSearchParamValues`.

## Why

- A reader can predict a `safe` export's behavior from its name: a `safeParse*` export turns any value into the named type or the fallback, and any other `safe` export is the native call they know, except it can't throw.
- On every name, `safe` would carry no information, since every export is total (see [What every export promises](package-promise.md)).
- A parser's name says what it reads; another wrapper's name says which native call it makes safe, since its arguments mirror that call.
- `safeJsonParse` is the most common hand-written name (35.8k files on GitHub code search, 2026-09-29), but one consistent parser family won out over matching it (owner's call on PR [#28](https://github.com/jjloneman/safe-fns/pull/28)).

## Consequences

- Names from [#1](https://github.com/jjloneman/safe-fns/issues/1)'s starting table change:
  - `safeStringify` → `safeJsonStringify`;
  - `safeHasOwn` → `safeObjectHasOwn`.
- Wherever the README's planned API lists these functions, it uses the new names; part 2 of [#10](https://github.com/jjloneman/safe-fns/issues/10) brings the table up to date with the full catalog.
- The owner adopted this rule on 2026-09-30 in [#10](https://github.com/jjloneman/safe-fns/issues/10).
