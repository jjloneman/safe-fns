---
type: Decision
title: How deepSortObject orders keys and arrays
description: Keys sort by UTF-16 code units by default, with an optional compareKeys; arrays keep their order unless sortArrays picks them, with a default item order or compareItems; cycles are preserved, and any failure returns the input unchanged.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T05:02:40Z }
---

# How deepSortObject orders keys and arrays

`deepSortObject(value, options?)` returns a copy whose plain objects list their keys in a stable order, the same on every engine, and sorts the arrays the caller picks.

## Decision

- **Signature:**

  ```ts
  deepSortObject<T>(
    value: T,
    options?: {
      compareItems?: (a: unknown, b: unknown) => number;
      compareKeys?: (a: string, b: string) => number;
      sortArrays?: boolean | ((path: readonly PropertyKey[]) => boolean);
    },
  ): T
  ```

### Keys

- **Default order is UTF-16 code units,** the order `Array.prototype.sort` uses with no comparator.
  - It's case-sensitive: `"B"` sorts before `"a"`.
  - For keys that aren't array indexes, it matches the key order of [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) JSON canonicalization and [`fast-json-stable-stringify`](https://www.npmjs.com/package/fast-json-stable-stringify).
- **`compareKeys` replaces the default,** e.g. a case-insensitive order or `new Intl.Collator("en").compare` when the caller accepts engine-dependent results.
- **Array-index keys (`"0"` to `"4294967294"`) always come first, in ascending numeric order,** whatever the comparator says: JavaScript enumerates them before every other string key, so no sort can move them. The docs say so.
  - Keys that only look numeric, such as `"-1"`, `"01"`, `"1.5"`, and `"4294967295"`, sort like any other key.
  - So `safeJsonStringify(deepSortObject(value))` isn't byte-for-byte canonical JSON when a key is an array index; RFC 8785 puts `"10"` before `"2"`.

### Arrays

- **Arrays keep their order by default,** since order can carry meaning (a `PATH` list).
- **`sortArrays` picks which arrays are sorted:**
  - `true` sorts every array at every depth;
  - a function receives each array's path from the root (`["product", "tags"]`, or `["items", 0, "tags"]`) and returns whether to sort it, so `tags` can be sorted while `path` beside it is left alone.
  - Paths use positions in the input, and every `sortArrays` decision is made before anything is sorted.
- **Default item order,** the same on every engine:
  1. by kind: `undefined`, `null`, booleans, numbers, bigints, strings, arrays, plain objects, then everything else;
  2. within a kind: `false` before `true`, numbers numerically (`2` before `10`, `NaN` last), bigints numerically, strings by UTF-16 code units;
  3. arrays element by element with this same order, a shorter prefix first;
  4. plain objects entry by entry, keys in `compareKeys`' order and then values with this same order, so `[{ id: 2 }, { id: 1 }]` becomes `[{ id: 1 }, { id: 2 }]`;
  5. anything else (symbols, functions, `Date`, class instances) compares equal and keeps its relative order.
- **`compareItems` replaces the default item order** for every array `sortArrays` picks.
- **Items are sorted after their own contents,** and the sort is stable, so equal items keep their relative order.
- **Nested items are compared structurally, never by serializing them,** so a comparison costs no more than walking the two items until they differ.
- **A sorted sparse array keeps its holes,** moved to the end, as `Array.prototype.sort` does.

### Copying

- **What gets copied:**
  - plain objects (see [What counts as a plain object](is-plain-object.md)) are copied with sorted keys, keeping a `null` prototype if they had one;
  - arrays are copied, sorted or not, with each element processed;
  - everything else (`Date`, `Map`, class instances, primitives) is kept by reference.
- **Keys are copied as own data properties,** so a `"__proto__"` key stays a key rather than setting the copy's prototype.
- **Symbol keys are kept,** after the string keys, in their original order.
- **The input is never mutated.**
- **Circular references are preserved:** a cycle in the input points to the corresponding copy in the output.
- **If anything throws** (a comparator, the `sortArrays` function, a getter, a proxy trap), it returns the input unchanged, failing safe toward preserving data.

## Why

- The owner's copies disagreed: some used plain `.sort()`, others `localeCompare`, which depends on the engine's ICU data, and none handled cycles.
- The owner wanted a key comparator for the cases where code-unit order reads badly, and array sorting as an option, because some arrays are sets (`tags`) and others are sequences (`path`), sometimes in the same value.
- Separate `compareKeys` and `compareItems` keep each comparator's argument types precise: keys are always strings, items can be anything.

## Consequences

- The README's migration note on case-sensitive key sorting stays accurate.
- `safeJsonStringify(deepSortObject(value))` gives stable JSON text for comparing or caching values; it isn't a substitute for an RFC 8785 canonicalizer when signing or hashing across systems.
- The `sortArrays: true` example in [How a function takes its parameters](function-parameters.md) is now a real option.

## Open

- **Tuple types.** The return type is `T`, but sorting an array typed as a tuple makes its positional type wrong: `{ pair: ["b", 1] as [string, number] }` sorts to `[1, "b"]`, still typed `[string, number]`.
  - Until a return type tracks which arrays were sorted, the docs say `sortArrays` should pick only list-typed arrays.
