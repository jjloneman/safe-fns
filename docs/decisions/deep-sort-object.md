---
type: Decision
title: How deepSortObject orders keys and arrays
description: Keys sort by UTF-16 code units by default, with ignoreCase or a compareKeys of the caller's own; arrays keep their order unless sortArrays picks them by typed key path, each with the default item order or its own comparator; cycles are preserved, and any failure returns the input unchanged.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-15T18:00:36Z }
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
      ignoreCase?: boolean;
      sortArrays?: boolean | SortArrays<T>;
    },
  ): T
  ```

  - `SortArrays<T>` is an object whose keys are the key paths of the arrays in `T` and whose values are `true` or a comparator typed by that array's items (see [Arrays](#arrays)).

### Keys

- **Default order is UTF-16 code units,** the order `Array.prototype.sort` uses with no comparator.
  - It's case-sensitive: `"B"` sorts before `"a"`.
  - For keys that aren't array indexes, it matches the key order of [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) JSON canonicalization and [`fast-json-stable-stringify`](https://www.npmjs.com/package/fast-json-stable-stringify).
- **`ignoreCase: true` compares lowercased keys,** then breaks ties by code units, so `"a"` and `"A"` still have one fixed order.
  - `toLowerCase` is locale-independent, so the order is the same on every engine.
  - It also applies to strings in the default item order (see [Arrays](#arrays)).
- **`compareKeys` replaces the key order,** and `ignoreCase` then no longer affects keys.
  - A locale-aware order is one line: `compareKeys: new Intl.Collator("sv").compare`; the docs show it, and say that its result depends on the engine's ICU data.
  - A comparator that calls two different keys equal (`sensitivity: "base"` treats `"a"` and `"A"` alike) leaves them in insertion order, so two equal objects can sort differently; the docs say so.
- **Array-index keys (`"0"` to `"4294967294"`) always come first, in ascending numeric order,** whatever the comparator says: JavaScript enumerates them before every other string key, so no sort can move them. The docs say so.
  - Keys that only look numeric, such as `"-1"`, `"01"`, `"1.5"`, and `"4294967295"`, sort like any other key.
  - So `safeJsonStringify(deepSortObject(value))` isn't byte-for-byte canonical JSON when a key is an array index; RFC 8785 puts `"10"` before `"2"`.

### Arrays

- **Arrays keep their order by default,** since order can carry meaning (a `PATH` list).
- **`sortArrays: true` sorts every array at every depth,** with `compareItems` if given, or the default item order.
- **`sortArrays` as an object picks arrays by key path,** each with its own order:

  ```ts
  deepSortObject(order, {
    sortArrays: {
      items: (a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0),
      "items.tags": true,
      scores: (a, b) => b - a,
      tags: true,
    },
  });
  ```

  - A key path is the object keys leading to the array, joined with `.`, with array indexes left out: `"items.tags"` is the `tags` array inside every element of `items`.
  - `true` sorts that array with `compareItems` if given, or the default item order; a function is that array's own comparator.
  - The paths and each comparator's `a` and `b` are typed from `T`, so a typo, a key that isn't an array, or a comparator for the wrong item type is a compile error.
  - Where `T` is `unknown`, `any`, or has an index signature (`JsonValue`), any path string is accepted and comparators take `any`.
  - Past 8 levels of nesting, the type accepts any path string rather than slow the compiler.

- **What a key path can't name:**
  - a key that itself contains `.`, since the path would be ambiguous;
  - an array nested directly in another array, which has no key of its own; picking `"matrix"` sorts the rows of `matrix: [[3, 1], [2]]` but not the numbers in each row.
  - Both are reached with `sortArrays: true`.
- **Paths use the input's structure,** and every sorting decision is made before anything is sorted.
- **Default item order,** the same on every engine:
  1. by kind: `undefined`, `null`, booleans, numbers, bigints, strings, arrays, plain objects, then everything else;
  2. within a kind: `false` before `true`, numbers numerically (`2` before `10`, `NaN` last), bigints numerically, strings by UTF-16 code units, or as `ignoreCase` orders keys when it's set;
  3. arrays element by element with this same order, a shorter prefix first;
  4. plain objects entry by entry, keys in the key order and then values with this same order, so `[{ id: 2 }, { id: 1 }]` becomes `[{ id: 1 }, { id: 2 }]`, and objects are compared by their first key in that order, not by any particular field;
  5. anything else (symbols, functions, `Date`, class instances) compares equal and keeps its relative order.
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

## Comparison

The tiers 0–2 summary from [research/results/deep-sort-object.md](../../research/results/deep-sort-object.md), generated by `pnpm research`; the full table there adds MariaDB, MySQL, and PostgreSQL.

- Each input is JSON text that every tool parses and writes back out, so a cell shows the resulting key order.
- `sortArrays`, `ignoreCase`, and the comparators aren't compared, since no other tool has them.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`deepSortObject` | canonicalize<br>`canonicalize(JSON.parse(value))` | fast-json-stable-stringify<br>`stringify(JSON.parse(value))` | Hermes<br>`JSON.stringify(JSON.parse(value))` | JS built-ins<br>`JSON.stringify(JSON.parse(value))` | safe-stable-stringify<br>`stringify(JSON.parse(value))` | Go<br>`json.Unmarshal(value, &v); json.Marshal(v)` | Jackson<br>`sortingMapper.writeValueAsString(mapper.readValue(value, Object.class))` | Python<br>`json.dumps(json.loads(value), ensure_ascii=False, separators=(",", ":"), sort_keys=True)` | Rust<br>`serde_json::to_string(&serde_json::from_str::<Value>(value)?) (arbitrary_precision)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"{\"b\":1,\"a\":2}"` | `"{\"a\":2,\"b\":1}"` | `"{\"a\":2,\"b\":1}"` | `"{\"a\":2,\"b\":1}"` | `"{\"b\":1,\"a\":2}"` | `"{\"b\":1,\"a\":2}"` | `"{\"a\":2,\"b\":1}"` | `"{\"a\":2,\"b\":1}"` | `"{\"a\":2,\"b\":1}"` | `"{\"a\":2,\"b\":1}"` | `"{\"a\":2,\"b\":1}"` |
| `"{\"b\":1,\"B\":2,\"a\":3,\"A\":4}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"b\":1,\"B\":2,\"a\":3,\"A\":4}"` | `"{\"b\":1,\"B\":2,\"a\":3,\"A\":4}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` | `"{\"A\":4,\"B\":2,\"a\":3,\"b\":1}"` |
| `"{\"a10\":1,\"a2\":2,\"a1\":3}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a10\":1,\"a2\":2,\"a1\":3}"` | `"{\"a10\":1,\"a2\":2,\"a1\":3}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` | `"{\"a1\":3,\"a10\":1,\"a2\":2}"` |
| `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"2\":2,\"10\":1,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"2\":2,\"10\":1,\"a\":3}"` | `"{\"2\":2,\"10\":1,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` | `"{\"10\":1,\"2\":2,\"a\":3}"` |
| `"{\"b\":1,\"1\":2,\"-1\":3,\"01\":4,\"1.5\":5,\"4294967295\":6}"` | `"{\"1\":2,\"-1\":3,\"01\":4,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"1\":2,\"b\":1,\"-1\":3,\"01\":4,\"1.5\":5,\"4294967295\":6}"` | `"{\"1\":2,\"b\":1,\"-1\":3,\"01\":4,\"1.5\":5,\"4294967295\":6}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` | `"{\"-1\":3,\"01\":4,\"1\":2,\"1.5\":5,\"4294967295\":6,\"b\":1}"` |
| `"{\"é\":1,\"z\":2,\"e\":3}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"é\":1,\"z\":2,\"e\":3}"` | `"{\"é\":1,\"z\":2,\"e\":3}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` | `"{\"e\":3,\"z\":2,\"é\":1}"` |
| `"{\"｡\":1,\"😀\":2}"` | `"{\"😀\":2,\"｡\":1}"` | `"{\"😀\":2,\"｡\":1}"` | `"{\"😀\":2,\"｡\":1}"` | `"{\"｡\":1,\"😀\":2}"` | `"{\"｡\":1,\"😀\":2}"` | `"{\"😀\":2,\"｡\":1}"` | `"{\"｡\":1,\"😀\":2}"` | `"{\"😀\":2,\"｡\":1}"` | `"{\"｡\":1,\"😀\":2}"` | `"{\"｡\":1,\"😀\":2}"` |
| `"{\"b\":{\"d\":1,\"c\":2},\"a\":[{\"z\":1,\"y\":2}]}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"b\":{\"d\":1,\"c\":2},\"a\":[{\"z\":1,\"y\":2}]}"` | `"{\"b\":{\"d\":1,\"c\":2},\"a\":[{\"z\":1,\"y\":2}]}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` | `"{\"a\":[{\"y\":2,\"z\":1}],\"b\":{\"c\":2,\"d\":1}}"` |
| `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` | `"{\"a\":[3,1,2],\"b\":[\"b\",\"a\"]}"` |
| `"{\"b\":1,\"__proto__\":2,\"a\":3}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"b\":1,\"__proto__\":2,\"a\":3}"` | `"{\"b\":1,\"__proto__\":2,\"a\":3}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` | `"{\"__proto__\":2,\"a\":3,\"b\":1}"` |
| `"[{\"b\":1,\"a\":2},{\"d\":3,\"c\":4}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"b\":1,\"a\":2},{\"d\":3,\"c\":4}]"` | `"[{\"b\":1,\"a\":2},{\"d\":3,\"c\":4}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` | `"[{\"a\":2,\"b\":1},{\"c\":4,\"d\":3}]"` |
| `"{\"bb\":1,\"a\":2,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"bb\":1,\"a\":2,\"ccc\":3}"` | `"{\"bb\":1,\"a\":2,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` | `"{\"a\":2,\"bb\":1,\"ccc\":3}"` |
| `"42"` | `"42"` | `"42"` | `"42"` | `"42"` | `"42"` | `"42"` | `"42"` | `"42"` | `"42"` | `"42"` |
| `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` | `"\"text\""` |
| `"null"` | `"null"` | `"null"` | `"null"` | `"null"` | `"null"` | `"null"` | `"null"` | `"null"` | `"null"` | `"null"` |
<!-- prettier-ignore-end -->

## Why

- The owner's copies disagreed: some used plain `.sort()`, others `localeCompare`, which depends on the engine's ICU data, and none handled cycles.
- The owner wanted a key comparator for the cases where code-unit order reads badly, and array sorting as an option, because some arrays are sets (`tags`) and others are sequences (`path`), sometimes in the same value.
- Separate `compareKeys` and `compareItems` keep each comparator's argument types precise: keys are always strings, items can be anything.
- Code-unit key order is what every JavaScript key-sorting library compared and RFC 8785's canonicalize use; Go, Python, and Rust sort by code point, which differs only for characters outside the Basic Multilingual Plane (😀 before `｡` here, after it there).
- Every key-sorting library compared puts `"10"` before `"2"`; `deepSortObject` can't, since JavaScript lists array-index keys first.
- `ignoreCase` is the one built-in alternative order because it's engine-independent; a `locale` option would have to mirror `Intl.Collator`'s eight options and inherit its engine-dependent results, so a collator is passed as `compareKeys` instead.
- Picking arrays by key path, rather than by key name or a path function:
  - a bare key name (sort-keys-recursive's `ignoreArrayAtKeys`) can't tell `items[*].tags` from `audit[*].tags`;
  - a function over the path (sort-keys' `deep: ({ path }) => …`) is untyped and reads poorly (`path.at(-1) === "tags"`);
  - JSONPath needs a query engine, and a JSON Pointer names one index, never "every element";
  - a keyed object lets TypeScript type each comparator from its array's items, which a list of `{ path, compare }` entries can't: TypeScript doesn't narrow a union by a tuple-valued `path`, so the comparator's parameters fell back to `any`.
- The `SortArrays<T>` type was checked on TypeScript 6.0 and 4.9, including recursive types, `JsonValue`, and `unknown`.

## Consequences

- The README's migration note on case-sensitive key sorting stays accurate.
- `safeJsonStringify(deepSortObject(value))` gives stable JSON text for comparing or caching values; it isn't a substitute for an RFC 8785 canonicalizer when signing or hashing across systems.
- The `sortArrays: true` example in [How a function takes its parameters](function-parameters.md) is now a real option.
- Sorting an array typed as a tuple makes its positional type wrong: `{ range: ["Q4", 2026] as [string, number] }` sorts to `[2026, "Q4"]`, still typed `[string, number]`, so `range[0].toUpperCase()` compiles and throws.
  - The return type stays `T`; the docs say `sortArrays` should pick only list-typed arrays, never tuples.
