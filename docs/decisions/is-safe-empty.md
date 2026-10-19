---
type: Decision
title: What "empty" means for isSafeEmpty and isSafePopulated
description: Nullish values, blank strings (whitespace and invisible characters), and empty arrays, maps, sets, plain objects, typed arrays, buffers, and web data containers are empty; everything else, including anything that can't be inspected, is populated, and each predicate narrows the branch where the value is known to be non-nullish: isSafePopulated's true branch and isSafeEmpty's false branch.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-19T01:16:47Z }
---

# What "empty" means for isSafeEmpty and isSafePopulated

`isSafeEmpty(value)` answers "is there nothing here?" for a fixed list of value kinds, and `isSafePopulated(value)` is its exact negation.

## Decision

- **Empty values:**
  - `null` and `undefined`;
  - a blank string: one made only of whitespace and invisible characters, tested with a single regex and no `trim()`:

    ```ts
    const BLANK = /^[\p{White_Space}\p{Default_Ignorable_Code_Point}\u2800]*$/u;
    ```

    - `\p{White_Space}` is Unicode's whitespace list: everything `trim()` removes (spaces, tabs, line breaks, the no-break spaces Word and `&nbsp;` produce), plus NEL (U+0085, "next line"), which `trim()` misses;
    - `\p{Default_Ignorable_Code_Point}` covers characters that render as nothing: zero-width spaces and joiners, the word joiner, the byte-order mark, soft hyphens, and variation selectors;
    - `\u2800` is the braille blank, the braille cell with no dots, which braille text uses as its space;
    - so `""`, `"   "`, `"\n"`, `"\u00A0"`, and `"\u200B"` are all empty;

  - an array (`Array.isArray`) with `length` 0;
  - a `Map` or `Set` with `size` 0, identified by a brand check (a runtime check of the object's hidden internal slot, which only a real `Map` or `Set` has) rather than by a `size` key;
  - a plain object (see [What counts as a plain object](is-plain-object.md)) with no own keys at all, counting symbol and non-enumerable keys, so `{}` and `new Object()` are empty;
  - a typed array (`Uint8Array` and the others) or `DataView` with `byteLength` 0, identified by `ArrayBuffer.isView`;
  - an `ArrayBuffer` or `SharedArrayBuffer` with `byteLength` 0, identified by a brand check;
  - a web data container (an object whose job is holding data) with nothing in it, limited to those in the [WinterTC Minimum Common Web API](https://min-common-api.proposal.wintertc.org/), the browser APIs every server and edge runtime agrees to provide:
    - `URLSearchParams`, `Blob`, and `File` with `size` 0;
    - `FormData` and `Headers` with no entries, checked with `.keys().next().done`, which reads nothing destructively;
    - each is confirmed by calling the getter or method from its own prototype, which throws on a look-alike, after a cheap `Object.prototype.toString` tag check filters out everything else, so a `Date` or class instance never pays for a thrown exception;
    - each constructor is looked up on `globalThis` inside the `try`, with no environment probe; a runtime without one can't produce its instances either.
- **Everything else is populated:**
  - `0`, `NaN`, `false`, `0n`, symbols, and functions;
  - `Date`, `RegExp`, `URL`, `Error`, class instances, and boxed primitives (`new String("")`), even with no own keys;
  - browser-only collections (`NodeList`, `HTMLCollection`, `FileList`, `DOMTokenList`), DOM nodes, and `Storage`, which aren't in the WinterTC list;
  - iterators, generators, streams, `Request` and `Response` bodies, and `Promise`, which can't be checked without consuming them;
  - `Function` (whose `length` counts parameters) and the queuing strategies (whose `size` is a method), where a `length` or `size` doesn't measure contents;
  - the `arguments` object, an old pattern that rest parameters replaced;
  - `WeakMap` and `WeakSet`, which by design have no `size` and can't be listed, since the garbage collector can remove entries at any time;
  - an object with a `length` or `size` key that isn't an array, `Map`, or `Set`, so `{ length: 0, name: "x" }` is populated.
- **A value that can't be inspected is populated.**
  - A revoked proxy, or a trap or getter that throws, makes `isSafeEmpty` return `false` and `isSafePopulated` return `true`.
  - That follows the principle of failing safe toward preserving data.
- **`isSafePopulated` narrows only its true branch,** through a type-only brand (a fake tag property that exists only in the type system, making a type distinct from others of the same shape):

  ```ts
  declare const populated: unique symbol;
  export type Populated<T> = NonNullable<T> & { readonly [populated]: true };
  export function isSafePopulated<T>(value: T): value is Populated<T>;
  ```

  - In the true branch, `null` and `undefined` are gone: a `string | undefined` becomes `string & Populated<…>`, which is assignable to `string`.
  - In the else branch, the type is unchanged, since `""` lands there as well as `undefined`; a plain `value is NonNullable<T>` would wrongly narrow it to `undefined`.
  - It works as a callback: `values.filter(isSafePopulated)` and rxjs's `filter(isSafePopulated)` drop `null` and `undefined` from the element type.
  - The brand exists only in the types; nothing is added to the value at runtime.

- **`isSafePopulated` takes exactly one parameter,** because `Array.prototype.filter` passes `(value, index, array)`, and an options parameter would receive the index.
- **`isSafeEmpty` narrows only its false branch,** through the same kind of brand:

  ```ts
  declare const empty: unique symbol;
  export type Empty<T> =
    | Extract<T, null | undefined>
    | (NonNullable<T> & { readonly [empty]: true });
  export function isSafeEmpty<T>(value: T): value is Empty<T>;
  ```

  - In the else branch, `null` and `undefined` are gone, so `if (isSafeEmpty(x)) { return 0; } return x;` compiles for `x: number | null | undefined` without a separate `x === null || x === undefined` check.
  - In the true branch, the type is unchanged apart from the brand: a `string` that is empty isn't narrowed to `""`, since `"  "` is empty too.
  - A type that can be empty stays whole in the else branch: a `string[] | undefined` becomes `string[]`, and a generic `T | null` becomes `T`.

- **In a callback, the positive twin is the one that narrows.**
  - `values.filter(isSafePopulated)` narrows on TypeScript 4.9 and later.
  - `values.filter((value) => isSafePopulated(value))` narrows from TypeScript 5.5, which infers a predicate from the arrow's body.
  - `values.filter((value) => !isSafeEmpty(value))` never narrows, because TypeScript doesn't infer a predicate through `!`; the docs point to `isSafePopulated` for filtering.
- **`Populated<T>` and `Empty<T>` are exported,** so a consumer's declaration emit can name the type of a narrowed value.

## Comparison

The tiers 0–2 summary from [research/results/is-safe-empty.md](../../research/results/is-safe-empty.md), generated by `pnpm research`; the full table there adds databases, formats, and the remaining languages.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`isSafeEmpty` | @sindresorhus/is<br>`is.emptyObject(value)` | @sindresorhus/is<br>`is.emptyStringOrWhitespace(value)` | es-toolkit<br>`compat.isEmpty(value)` | lodash<br>`_.isEmpty(value)` | radash<br>`isEmpty(value)` | Ramda<br>`R.isEmpty(value)` | remeda<br>`isEmpty(value)` | remeda<br>`isEmptyish(value)` | Underscore<br>`_.isEmpty(value)` | .NET<br>`string.IsNullOrEmpty(value)` | .NET<br>`string.IsNullOrWhiteSpace(value)` | Commons Lang<br>`ObjectUtils.isEmpty(value)` | Commons Lang<br>`StringUtils.isBlank(value)` | Go<br>`len(value) == 0` | Go<br>`reflect.ValueOf(value).IsZero()` | Groovy<br>`!value` | Guava<br>`Strings.isNullOrEmpty(value)` | Java<br>`collection.isEmpty()` | Java<br>`map.isEmpty()` | Java<br>`string.isBlank()` | Java<br>`string.isEmpty()` | Kotlin<br>`collection.isNullOrEmpty()` | Kotlin<br>`map.isNullOrEmpty()` | Kotlin<br>`string.isNullOrBlank()` | Kotlin<br>`string.isNullOrEmpty()` | Python<br>`not value` | Rust<br>`value.is_empty()` | Spring<br>`!StringUtils.hasText(value)` | Spring<br>`ObjectUtils.isEmpty(value)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `null` | `true` | `false` | `false` | `true` | `true` | `true` | `false` | 💥 `TypeError` | `true` | `true` | `true` | `true` | `true` | `true` | — | 💥 `panic: *reflect.ValueError` | `true` | `true` | — | — | — | — | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` |
| `undefined` | `true` | `false` | `false` | `true` | `true` | `true` | `false` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `""` | `true` | `false` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | `true` | `true` | — | — | `true` | `true` | `true` | `true` | `true` | `true` |
| `" "` | `true` | `false` | `true` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `true` | `false` | `true` | `false` | `false` | `false` | `false` | — | — | `true` | `false` | — | — | `true` | `false` | `false` | `false` | `true` | `false` |
| `"\u{A0}"` | `true` | `false` | `true` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `true` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | `false` | `false` | — | — | `true` | `false` | `false` | `false` | `false` | `false` |
| `"\u{2800}"` | `true` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | `false` | `false` | — | — | `false` | `false` | `false` | `false` | `false` | `false` |
| `"a"` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | `false` | `false` | — | — | `false` | `false` | `false` | `false` | `false` | `false` |
| `0` | `false` | `false` | `false` | `true` | `true` | `true` | `false` | `true` | `false` | `true` | — | — | `false` | — | — | `true` | `true` | — | — | — | — | — | — | — | — | — | `true` | — | — | `false` |
| `false` | `false` | `false` | `false` | `true` | `true` | `true` | `false` | `true` | `false` | `true` | — | — | `false` | — | — | `true` | `true` | — | — | — | — | — | — | — | — | — | `true` | — | — | `false` |
| `NaN` | `false` | `false` | `false` | `true` | `true` | `true` | `false` | `true` | `false` | `true` | — | — | `false` | — | — | `false` | `true` | — | — | — | — | — | — | — | — | — | `false` | — | — | `false` |
| `[]` | `true` | `false` | `false` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | `true` | — | `true` | `false` | `true` | — | `true` | — | — | — | `true` | — | — | — | `true` | `true` | — | `true` |
| `[0]` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | `false` | — | `false` | `false` | `false` | — | `false` | — | — | — | `false` | — | — | — | `false` | `false` | — | `false` |
| `[null]` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | `false` | — | `false` | `false` | `false` | — | `false` | — | — | — | `false` | — | — | — | `false` | `false` | — | `false` |
| `{}` | `true` | `true` | `false` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | `true` | — | `true` | `false` | `true` | — | — | `true` | — | — | — | `true` | — | — | `true` | `true` | — | `true` |
| `{ "a": 1 }` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | `false` | — | `false` | `false` | `false` | — | — | `false` | — | — | — | `false` | — | — | `false` | `false` | — | `false` |
| `{ "length": 0 }` | `false` | `false` | `false` | `false` | `false` | `true` | `false` | `false` | `true` | `false` | — | — | `false` | — | `false` | `false` | `false` | — | — | `false` | — | — | — | `false` | — | — | `false` | `false` | — | `false` |
| `{ "size": 0 }` | `false` | `false` | `false` | `false` | `false` | `true` | `false` | `false` | `true` | `false` | — | — | `false` | — | `false` | `false` | `false` | — | — | `false` | — | — | — | `false` | — | — | `false` | `false` | — | `false` |
| `‹an empty Map›` | `true` | `false` | `false` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Map with an entry›` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `true` | `false` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an empty Set›` | `true` | `false` | `false` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a null-prototype object›` | `true` | `true` | `false` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an empty URLSearchParams›` | `true` | `true` | `false` | `true` | `true` | `true` | `false` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a URLSearchParams with an entry›` | `false` | `true` | `false` | `true` | `true` | `false` | `false` | `true` | `false` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Date›` | `false` | `true` | `false` | `true` | `true` | `false` | `false` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a function›` | `false` | `false` | `false` | `true` | `true` | `false` | `false` | `true` | `false` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a revoked proxy›` | `false` | 💥 `TypeError` | `false` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a proxy whose ownKeys trap throws›` | `false` | 💥 `Error` | `false` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a cross-realm Map›` | `true` | `false` | `false` | `true` | `true` | `true` | `false` | `true` | `true` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- The owner's copies disagreed: one detected DOM nodes with `typeof window`, another duck-typed `"length" in value`, and ramda's `isEmpty` doesn't trim, so `"   "` counted as populated.
- Treating `null` and `undefined` as empty matches lodash, remeda's `isEmptyish`, and how the owner's call sites use it.
- A non-plain object with no own keys can still hold data that key-counting can't see: `new URL("https://example.com")`, `new Date()`, and `new Error("boom")` have no own keys, and a class can keep everything in private `#fields`. Only plain objects, whose contents are exactly their keys, are judged by key count.
- A zero-length typed array or buffer holds no bytes, so it's empty, matching what `isSafeEmpty` says for `[]`.
- Blank strings use one regex `.test()` because it was the fastest option measured on Node 26: `trim()` first allocates a new string, and `replace()` then `=== ""` was up to 100 times slower on a 1 KB string. The braille blank and the invisible characters are included because a string of them looks empty, and is a common way to fake an empty name.
- Web data containers are included because lodash, es-toolkit/compat, and @sindresorhus/is call every `URLSearchParams`, `Blob`, `File`, and `Headers` empty, even `new URLSearchParams("a=1")`, since they count own keys and these objects keep their data internally; remeda gets `size`-based ones right only by trusting any `size` key, and ramda calls none of them empty. The WinterTC list gives a boundary that keeps results the same in every runtime.
- Numbers and booleans are populated because `0` and `false` are real values a form or API can hold, which lodash's `isEmpty(0) === true` loses.
- The brands (the type-only tags above) were chosen after checking both branches of both predicates on TypeScript 6.0 and 4.9, by the owner's request that neither need an extra nullish check (2026-10-18): narrowing inline, in `Array.prototype.filter`, and in an rxjs-style `filter` operator all keep the else branch's full type.

## Consequences

- The blank characters live in one shared module under `src/internal/`, with `isBlankString` and `trimBlank`, so the parsers judge and strip blank text exactly the same way; the regex itself isn't exported, since a `RegExp` object carries mutable state.
- The README's migration row `value.trim() !== ""` → `isSafePopulated(value)` holds, and is stricter: `"\u200B"` now counts as blank too, which the migration note says.
- The README's comparison table gains rows for `"\u200B"` and `new URLSearchParams("a=1")`.
- The README's comparison table marks `null` as ✅ empty.
- Hovering a narrowed value shows `string & Populated<…>` rather than `string`; the README's API docs explain the brand when the function ships.
