---
type: Decision
title: How keyBy keys an array
description: "`keyBy(items, key, options?)` returns a null-prototype object holding each item under its key, read by property name or a key function; only string, finite-number, and symbol keys count, and `invalidKeys` skips the rest, converts them with `String()`, or returns the fallback; `duplicates` keeps the last, the first, or returns the fallback; `mapValue` sets what is stored; a non-array or a throw returns the `fallback` option, `undefined` by default; a `Map` version would be a separate function."
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-31T21:03:00Z }
verified: { by: human:jjloneman, at: 2026-10-31T23:44:08Z }
---

# How keyBy keys an array

`keyBy(items, key, options?)` turns a list into a lookup: `keyBy([{ id: "a" }, { id: "b" }], "id")` is `{ a: { id: "a" }, b: { id: "b" } }`, an object with no prototype.

## Decision

- **Signature:** two overloads, one per way of naming the key, sharing one options type.

  ```ts
  type KeyByOptions<Item, V, F> = {
    duplicates?: "last" | "first" | "fallback";
    fallback?: F;
    invalidKeys?: "skip" | "asString" | "fallback";
    mapValue?: (item: Item) => V;
  };

  keyBy<T, K extends keyof NonNullable<T>, V = NonNullable<T>, F = undefined>(
    items: readonly T[],
    key: K,
    options?: KeyByOptions<NonNullable<T>, V, F>,
  ): KeyedBy<NonNullable<T>, K, V> | F

  keyBy<T, R, V = T, F = undefined>(
    items: readonly T[],
    getKey: (item: T) => R,
    options?: KeyByOptions<T, V, F>,
  ): Partial<Record<Extract<R, PropertyKey>, V>> | F
  ```

  - `items` and the key are positional, as [How a function takes its parameters](function-parameters.md) already lists `keyBy(items, key)`, and as `Object.groupBy(items, callback)` takes them; a required key doesn't belong in an options object a caller can leave out, and a name-or-function is one `typeof` check where `{ property }` or `{ getKey }` would need a union to stop both being passed.
  - Each option but `fallback` and `mapValue` names a kind of item, then what to do with it, as [deepMerge](deep-merge.md)'s do; the first value listed is the default.
  - `items` is `readonly T[]`, so a mutable array passes with no assertion; a mixed array infers `T` as the union, and a property name must then be a key of every member, so `keyBy(pets, "meows")` on `Array<Cat | Dog>` is a compile error.
  - The key is checked against `NonNullable<T>`, so `Array<User | null>` keyed by `"id"` compiles and its values are typed `User`, matching the runtime, which skips `null` items.
  - `KeyedBy<Item, K, V>` is `Partial<Record<…, V>>` for a wide key type (`string`, `number`, `symbol`), so `dict[code]` is `V | undefined` even without `noUncheckedIndexedAccess`.
  - For an `as const` array, whose keys are literals, `KeyedBy` maps each key to its own item, with no `Partial`, since every key is known: `keyBy([{ id: "rex", kind: "dog" }, { id: "tom", kind: "cat" }] as const, "id").rex.kind` is typed `"dog"`.
  - Inferring literals without `as const` needs a `const` type parameter, which TypeScript 4.9 can't parse; #117 decides whether the floor moves.
  - With `invalidKeys: "asString"`, the key type widens to `string`, since a converted key can be any string.
  - `getKey` and `mapValue` get the item alone, not an index, so `keyBy(items, String)` can't pick up a second argument by accident.

- **The result is a null-prototype object**, as `Object.groupBy` returns, so `dict["toString"]` is `undefined` unless an item has that key, and an item keyed `"__proto__"` is an ordinary entry.
- **A key is read with a normal property read** (`item[key]`), so a getter or an inherited property counts, such as a class's `get id()`.
- **Valid keys are strings, finite numbers, and symbols.**
  - A number becomes a key as a property key does: `1` is `"1"`, `-0` is `"0"`, and `1.5` is `"1.5"`, so `1` and `"1"` are the same key.
  - Every other key is invalid: `undefined`, `null`, `NaN`, `±Infinity`, a boolean, a bigint, an object, or an array; with `getKey`, so is any other returned value.

- **`invalidKeys` decides what an item with an invalid key does:**
  - `"skip"`, the default, leaves the item out, rather than keying it as `"undefined"`, `"NaN"`, or `"[object Object]"`;
  - `"asString"` converts a primitive key with `String()`, so `null` is `"null"`, `undefined` is `"undefined"`, `NaN` is `"NaN"`, `true` is `"true"`, and `1n` is `"1"`; an object or array key is still skipped, since `String()` would turn it into `"[object Object]"` or its items, and a hostile `toString` could throw;
  - `"fallback"` returns the `fallback` option if any item's key is invalid, for data that must be clean.

- **An item that isn't an object is skipped** with a property name, whatever `invalidKeys` says: `keyBy(["ab", "cde"], "length")` is `{}`, not `{ 2: "ab", 3: "cde" }`. `getKey` gets every item, primitives and `null` included, since the caller's function decides.
- **`duplicates` decides what a repeated key does:**
  - `"last"`, the default, keeps the later item, as a hand-written `reduce`, `new Map(entries)`, and `Object.fromEntries` do;
  - `"first"` keeps the earlier one;
  - `"fallback"` returns the `fallback` option if any key repeats, the never-throws form of Java's `Collectors.toMap`.

- **`mapValue` sets what is stored under each key**, the item itself by default:
  - `{ mapValue: deepClone }` stores copies, `{ mapValue: (user) => deepClone(user, { unreadable: "omit" }) }` passes `deepClone` its options, and `{ mapValue: (user) => user.name }` stores names;
  - it runs only on items that are kept, after the key is read, and its result is stored as returned, `undefined` included, so a `deepClone` that can't copy an item stores `undefined` unless the caller passes it a `fallback`;
  - `keyBy` doesn't import `deepClone`, so a caller who never copies never loads it.

- **Without `mapValue`, items are shared, not copied:** `dict.a` is the very item from `items`, so `dict.a.name = "x"` changes `items[0]` too, as it does with a hand-written `reduce` or `Object.fromEntries(items.map((item) => [item.id, item]))`.
- **Keys keep the result's insertion order**, with integer-like keys first, as every JavaScript object orders them; the docs say so.
- **The input must be an array**, from any realm, by `Array.isArray`: an object, a `Set`, an array-like, `null`, or `undefined` returns the `fallback` option; a caller with an iterable spreads it first.
- **Anything that throws returns the `fallback` option,** `undefined` by default: a revoked proxy, a throwing getter, a proxy trap, or a `getKey` or `mapValue` that throws.
- **A `Map` version would be a separate function**, as `Object.groupBy` and `Map.groupBy` are, not an option:
  - its keys would follow different rules: `1` and `"1"` stay apart, and `NaN` and objects are valid keys;
  - it couldn't take the exact `as const` type, and an option would switch the whole return type on a flag;
  - it isn't planned yet, and its name is open; until then, `new Map(items.map((item) => [item.id, item]))` is native and typed.

- **No `filter` option:** a caller filters with `Array.prototype.filter` first, as #10 settled.

## Comparison

The tiers 0–2 summary from [research/results/key-by.md](../../research/results/key-by.md), generated by `pnpm research`.

- A cell shows the result, with a null-prototype object wrapped as `{ "null-prototype": { … } }`; `‹[object Object]›` is an object whose prototype was replaced, so it can't be shown as data.
- Every tool shares the items it keys, so items show as their data, not as `Symbol(shared)`.
- A tool that takes only a function gets `getKey`, which is `(item) => item[key]` for a property name; lodash and Underscore take the name itself.
- A JVM or Python map with a non-string key is spelled `{ "Map": [[key, value]] }`, as a JavaScript `Map` is, since JSON keys are strings only; SQLite's malformed result for a `NULL` key shows as the text it returned.
- No tool compared has an option like `duplicates`, `invalidKeys`, or `mapValue`, so those rows show only safe-fns.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`keyBy` | es-toolkit<br>`keyBy(items, getKey)` | JS built-ins<br>`new Map(items.map((item) => [getKey(item), item]))` | JS built-ins<br>`Object.fromEntries(items.map((item) => [getKey(item), item]))` | JS built-ins<br>`Object.groupBy(items, getKey)` | lodash<br>`_.keyBy(items, key)` | radash<br>`objectify(items, getKey)` | remeda<br>`indexBy(items, getKey)` | Underscore<br>`_.indexBy(items, key)` | Groovy<br>`items.collectEntries { item -> [(item[key]): item] }` | Java<br>`items.stream().collect(toMap(item -> item.get(key), item -> item))` | Kotlin<br>`items.associateBy { it[key] }` | Python<br>`{item[key]: item for item in items}` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `[{ "id": "a", "n": 1 }, { "id": "b", "n": 2 }], "id"` | `{ "null-prototype": { "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "Map": [["a", { "id": "a", "n": 1 }], ["b", { "id": "b", "n": 2 }]] }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "null-prototype": { "a": [{ "id": "a", "n": 1 }], "b": [{ "id": "b", "n": 2 }] } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` |
| `[{ "id": "a", "n": 1 }, { "id": "a", "n": 2 }], "id"` | `{ "null-prototype": { "a": { "id": "a", "n": 2 } } }` | `{ "a": { "id": "a", "n": 2 } }` | `{ "Map": [["a", { "id": "a", "n": 2 }]] }` | `{ "a": { "id": "a", "n": 2 } }` | `{ "null-prototype": { "a": [{ "id": "a", "n": 1 }, { "id": "a", "n": 2 }] } }` | `{ "a": { "id": "a", "n": 2 } }` | `{ "a": { "id": "a", "n": 2 } }` | `{ "a": { "id": "a", "n": 2 } }` | `{ "a": { "id": "a", "n": 2 } }` | `{ "a": { "id": "a", "n": 2 } }` | 💥 `IllegalStateException` | `{ "a": { "id": "a", "n": 2 } }` | `{ "a": { "id": "a", "n": 2 } }` |
| `[{ "id": 1 }, { "id": 2 }], "id"` | `{ "null-prototype": { "1": { "id": 1 }, "2": { "id": 2 } } }` | `{ "1": { "id": 1 }, "2": { "id": 2 } }` | `{ "Map": [[1, { "id": 1 }], [2, { "id": 2 }]] }` | `{ "1": { "id": 1 }, "2": { "id": 2 } }` | `{ "null-prototype": { "1": [{ "id": 1 }], "2": [{ "id": 2 }] } }` | `{ "1": { "id": 1 }, "2": { "id": 2 } }` | `{ "1": { "id": 1 }, "2": { "id": 2 } }` | `{ "1": { "id": 1 }, "2": { "id": 2 } }` | `{ "1": { "id": 1 }, "2": { "id": 2 } }` | `{ "Map": [[1, { "id": 1 }], [2, { "id": 2 }]] }` | `{ "Map": [[1, { "id": 1 }], [2, { "id": 2 }]] }` | `{ "Map": [[1, { "id": 1 }], [2, { "id": 2 }]] }` | `{ "Map": [[1, { "id": 1 }], [2, { "id": 2 }]] }` |
| `[{ "id": 1, "n": 1 }, { "id": "1", "n": 2 }], "id"` | `{ "null-prototype": { "1": { "id": "1", "n": 2 } } }` | `{ "1": { "id": "1", "n": 2 } }` | `{ "Map": [[1, { "id": 1, "n": 1 }], ["1", { "id": "1", "n": 2 }]] }` | `{ "1": { "id": "1", "n": 2 } }` | `{ "null-prototype": { "1": [{ "id": 1, "n": 1 }, { "id": "1", "n": 2 }] } }` | `{ "1": { "id": "1", "n": 2 } }` | `{ "1": { "id": "1", "n": 2 } }` | `{ "1": { "id": "1", "n": 2 } }` | `{ "1": { "id": "1", "n": 2 } }` | `{ "Map": [[1, { "id": 1, "n": 1 }], ["1", { "id": "1", "n": 2 }]] }` | `{ "Map": [[1, { "id": 1, "n": 1 }], ["1", { "id": "1", "n": 2 }]] }` | `{ "Map": [[1, { "id": 1, "n": 1 }], ["1", { "id": "1", "n": 2 }]] }` | `{ "Map": [[1, { "id": 1, "n": 1 }], ["1", { "id": "1", "n": 2 }]] }` |
| `[{ "id": -0 }], "id"` | `{ "null-prototype": { "0": { "id": -0 } } }` | `{ "0": { "id": -0 } }` | `{ "Map": [[0, { "id": -0 }]] }` | `{ "0": { "id": -0 } }` | `{ "null-prototype": { "0": [{ "id": -0 }] } }` | `{ "0": { "id": -0 } }` | `{ "0": { "id": -0 } }` | `{ "0": { "id": -0 } }` | `{ "0": { "id": -0 } }` | `{ "Map": [[-0, { "id": -0 }]] }` | `{ "Map": [[-0, { "id": -0 }]] }` | `{ "Map": [[-0, { "id": -0 }]] }` | `{ "Map": [[-0, { "id": -0 }]] }` |
| `[{ "id": 1.5 }], "id"` | `{ "null-prototype": { "1.5": { "id": 1.5 } } }` | `{ "1.5": { "id": 1.5 } }` | `{ "Map": [[1.5, { "id": 1.5 }]] }` | `{ "1.5": { "id": 1.5 } }` | `{ "null-prototype": { "1.5": [{ "id": 1.5 }] } }` | `{ "1.5": { "id": 1.5 } }` | `{ "1.5": { "id": 1.5 } }` | `{ "1.5": { "id": 1.5 } }` | `{ "1.5": { "id": 1.5 } }` | `{ "Map": [[1.5, { "id": 1.5 }]] }` | `{ "Map": [[1.5, { "id": 1.5 }]] }` | `{ "Map": [[1.5, { "id": 1.5 }]] }` | `{ "Map": [[1.5, { "id": 1.5 }]] }` |
| `[{ "id": "a" }, { "n": 1 }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "a": { "id": "a" }, "undefined": { "n": 1 } }` | `{ "Map": [["a", { "id": "a" }], [undefined, { "n": 1 }]] }` | `{ "a": { "id": "a" }, "undefined": { "n": 1 } }` | `{ "null-prototype": { "a": [{ "id": "a" }], "undefined": [{ "n": 1 }] } }` | `{ "a": { "id": "a" }, "undefined": { "n": 1 } }` | `{ "a": { "id": "a" }, "undefined": { "n": 1 } }` | `{ "a": { "id": "a" }, "undefined": { "n": 1 } }` | `{ "a": { "id": "a" }, "undefined": { "n": 1 } }` | `{ "Map": [["a", { "id": "a" }], [null, { "n": 1 }]] }` | `{ "Map": [[null, { "n": 1 }], ["a", { "id": "a" }]] }` | `{ "Map": [["a", { "id": "a" }], [null, { "n": 1 }]] }` | 💥 `KeyError` |
| `[{ "id": "a" }, { "id": undefined }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "a": { "id": "a" }, "undefined": { "id": undefined } }` | `{ "Map": [["a", { "id": "a" }], [undefined, { "id": undefined }]] }` | `{ "a": { "id": "a" }, "undefined": { "id": undefined } }` | `{ "null-prototype": { "a": [{ "id": "a" }], "undefined": [{ "id": undefined }] } }` | `{ "a": { "id": "a" }, "undefined": { "id": undefined } }` | `{ "a": { "id": "a" }, "undefined": { "id": undefined } }` | `{ "a": { "id": "a" }, "undefined": { "id": undefined } }` | `{ "a": { "id": "a" }, "undefined": { "id": undefined } }` | — | — | — | — |
| `[{ "id": "a" }, { "id": null }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "a": { "id": "a" }, "null": { "id": null } }` | `{ "Map": [["a", { "id": "a" }], [null, { "id": null }]] }` | `{ "a": { "id": "a" }, "null": { "id": null } }` | `{ "null-prototype": { "a": [{ "id": "a" }], "null": [{ "id": null }] } }` | `{ "a": { "id": "a" }, "null": { "id": null } }` | `{ "a": { "id": "a" }, "null": { "id": null } }` | `{ "a": { "id": "a" }, "null": { "id": null } }` | `{ "a": { "id": "a" }, "null": { "id": null } }` | `{ "Map": [["a", { "id": "a" }], [null, { "id": null }]] }` | `{ "Map": [[null, { "id": null }], ["a", { "id": "a" }]] }` | `{ "Map": [["a", { "id": "a" }], [null, { "id": null }]] }` | `{ "Map": [["a", { "id": "a" }], [null, { "id": null }]] }` |
| `[{ "id": "a" }, { "id": true }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "a": { "id": "a" }, "true": { "id": true } }` | `{ "Map": [["a", { "id": "a" }], [true, { "id": true }]] }` | `{ "a": { "id": "a" }, "true": { "id": true } }` | `{ "null-prototype": { "a": [{ "id": "a" }], "true": [{ "id": true }] } }` | `{ "a": { "id": "a" }, "true": { "id": true } }` | `{ "a": { "id": "a" }, "true": { "id": true } }` | `{ "a": { "id": "a" }, "true": { "id": true } }` | `{ "a": { "id": "a" }, "true": { "id": true } }` | `{ "Map": [["a", { "id": "a" }], [true, { "id": true }]] }` | `{ "Map": [["a", { "id": "a" }], [true, { "id": true }]] }` | `{ "Map": [["a", { "id": "a" }], [true, { "id": true }]] }` | `{ "Map": [["a", { "id": "a" }], [true, { "id": true }]] }` |
| `[{ "id": "a" }, { "id": { "b": 1 } }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "[object Object]": { "id": { "b": 1 } }, "a": { "id": "a" } }` | `{ "Map": [["a", { "id": "a" }], [{ "b": 1 }, { "id": ‹Symbol(repeat)› }]] }` | `{ "[object Object]": { "id": { "b": 1 } }, "a": { "id": "a" } }` | `{ "null-prototype": { "[object Object]": [{ "id": { "b": 1 } }], "a": [{ "id": "a" }] } }` | `{ "[object Object]": { "id": { "b": 1 } }, "a": { "id": "a" } }` | `{ "[object Object]": { "id": { "b": 1 } }, "a": { "id": "a" } }` | `{ "[object Object]": { "id": { "b": 1 } }, "a": { "id": "a" } }` | `{ "[object Object]": { "id": { "b": 1 } }, "a": { "id": "a" } }` | `{ "Map": [["a", { "id": "a" }], [{ "b": 1 }, { "id": { "b": 1 } }]] }` | `{ "Map": [["a", { "id": "a" }], [{ "b": 1 }, { "id": { "b": 1 } }]] }` | `{ "Map": [["a", { "id": "a" }], [{ "b": 1 }, { "id": { "b": 1 } }]] }` | 💥 `TypeError` |
| `[{ "id": "a" }, { "id": ["b"] }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "a": { "id": "a" }, "b": { "id": ["b"] } }` | `{ "Map": [["a", { "id": "a" }], [["b"], { "id": ‹Symbol(repeat)› }]] }` | `{ "a": { "id": "a" }, "b": { "id": ["b"] } }` | `{ "null-prototype": { "a": [{ "id": "a" }], "b": [{ "id": ["b"] }] } }` | `{ "a": { "id": "a" }, "b": { "id": ["b"] } }` | `{ "a": { "id": "a" }, "b": { "id": ["b"] } }` | `{ "a": { "id": "a" }, "b": { "id": ["b"] } }` | `{ "a": { "id": "a" }, "b": { "id": ["b"] } }` | `{ "Map": [["a", { "id": "a" }], [["b"], { "id": ["b"] }]] }` | `{ "Map": [["a", { "id": "a" }], [["b"], { "id": ["b"] }]] }` | `{ "Map": [["a", { "id": "a" }], [["b"], { "id": ["b"] }]] }` | 💥 `TypeError` |
| `[{ "id": "a" }, { "id": NaN }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "NaN": { "id": NaN }, "a": { "id": "a" } }` | `{ "Map": [["a", { "id": "a" }], [NaN, { "id": NaN }]] }` | `{ "NaN": { "id": NaN }, "a": { "id": "a" } }` | `{ "null-prototype": { "NaN": [{ "id": NaN }], "a": [{ "id": "a" }] } }` | `{ "NaN": { "id": NaN }, "a": { "id": "a" } }` | `{ "NaN": { "id": NaN }, "a": { "id": "a" } }` | `{ "NaN": { "id": NaN }, "a": { "id": "a" } }` | `{ "NaN": { "id": NaN }, "a": { "id": "a" } }` | `{ "Map": [["a", { "id": "a" }], [NaN, { "id": NaN }]] }` | `{ "Map": [["a", { "id": "a" }], [NaN, { "id": NaN }]] }` | `{ "Map": [["a", { "id": "a" }], [NaN, { "id": NaN }]] }` | `{ "Map": [["a", { "id": "a" }], [NaN, { "id": NaN }]] }` |
| `[{ "id": "a" }, { "id": Infinity }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | `{ "Infinity": { "id": Infinity }, "a": { "id": "a" } }` | `{ "Map": [["a", { "id": "a" }], [Infinity, { "id": Infinity }]] }` | `{ "Infinity": { "id": Infinity }, "a": { "id": "a" } }` | `{ "null-prototype": { "Infinity": [{ "id": Infinity }], "a": [{ "id": "a" }] } }` | `{ "Infinity": { "id": Infinity }, "a": { "id": "a" } }` | `{ "Infinity": { "id": Infinity }, "a": { "id": "a" } }` | `{ "Infinity": { "id": Infinity }, "a": { "id": "a" } }` | `{ "Infinity": { "id": Infinity }, "a": { "id": "a" } }` | `{ "Map": [["a", { "id": "a" }], [Infinity, { "id": Infinity }]] }` | `{ "Map": [[Infinity, { "id": Infinity }], ["a", { "id": "a" }]] }` | `{ "Map": [["a", { "id": "a" }], [Infinity, { "id": Infinity }]] }` | `{ "Map": [["a", { "id": "a" }], [Infinity, { "id": Infinity }]] }` |
| `[{ "id": "__proto__" }], "id"` | `{ "null-prototype": { "__proto__": { "id": "__proto__" } } }` | `‹[object Object]›` | `{ "Map": [["__proto__", { "id": "__proto__" }]] }` | `{ "__proto__": { "id": "__proto__" } }` | `{ "null-prototype": { "__proto__": [{ "id": "__proto__" }] } }` | `{ "__proto__": { "id": "__proto__" } }` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | `{ "__proto__": { "id": "__proto__" } }` | `{ "__proto__": { "id": "__proto__" } }` | `{ "__proto__": { "id": "__proto__" } }` | `{ "__proto__": { "id": "__proto__" } }` |
| `[{ "id": "toString" }], "id"` | `{ "null-prototype": { "toString": { "id": "toString" } } }` | `{ "toString": { "id": "toString" } }` | `{ "Map": [["toString", { "id": "toString" }]] }` | `{ "toString": { "id": "toString" } }` | `{ "null-prototype": { "toString": [{ "id": "toString" }] } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` | `{ "toString": { "id": "toString" } }` |
| `[null, { "id": "a" }], "id"` | `{ "null-prototype": { "a": { "id": "a" } } }` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | `{ "a": { "id": "a" }, "undefined": null }` | 💥 `TypeError` | 💥 `TypeError` | `{ "a": { "id": "a" }, "undefined": null }` | 💥 `NullPointerException` | 💥 `NullPointerException` | 💥 `NullPointerException` | 💥 `TypeError` |
| `["ab", "cde"], "length"` | `{ "null-prototype": {} }` | `{ "2": "ab", "3": "cde" }` | `{ "Map": [[2, "ab"], [3, "cde"]] }` | `{ "2": "ab", "3": "cde" }` | `{ "null-prototype": { "2": ["ab"], "3": ["cde"] } }` | `{ "2": "ab", "3": "cde" }` | `{ "2": "ab", "3": "cde" }` | `{ "2": "ab", "3": "cde" }` | `{ "2": "ab", "3": "cde" }` | 💥 `MissingPropertyException` | 💥 `ClassCastException` | 💥 `ClassCastException` | 💥 `TypeError` |
| `[], "id"` | `{ "null-prototype": {} }` | `{}` | `{ "Map": [] }` | `{}` | `{ "null-prototype": {} }` | `{}` | `{}` | `{}` | `{}` | `{}` | `{}` | `{}` | `{}` |
| `{ "a": { "id": "a" } }, "id"` | `undefined` | `{}` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | `{ "a": { "id": "a" } }` | 💥 `TypeError` | 💥 `TypeError` | `{ "a": { "id": "a" } }` | — | — | — | — |
| `null, "id"` | `undefined` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | `{}` | 💥 `TypeError` | 💥 `TypeError` | `{}` | — | — | — | — |
| `undefined, "id"` | `undefined` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | `{}` | 💥 `TypeError` | 💥 `TypeError` | `{}` | — | — | — | — |
| `‹a revoked proxy›, "id"` | `undefined` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | — | — | — |
| `[‹an object with a throwing getter›], "trap"` | `undefined` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — | — |
| `[‹a proxy whose get trap throws›], "id"` | `undefined` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "b", "n": 2 }], ‹a key function reading id›` | `{ "null-prototype": { "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "Map": [["a", { "id": "a", "n": 1 }], ["b", { "id": "b", "n": 2 }]] }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "null-prototype": { "a": [{ "id": "a", "n": 1 }], "b": [{ "id": "b", "n": 2 }] } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | `{ "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } }` | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "b", "n": 2 }], ‹a function that throws›` | `undefined` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — | — |
| `{ "a": { "id": "a" } }, "id", { "fallback": {} }` | `{}` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "a", "n": 2 }], "id", { "duplicates": "first" }` | `{ "null-prototype": { "a": { "id": "a", "n": 1 } } }` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "a", "n": 2 }], "id", { "duplicates": "fallback" }` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "b", "n": 2 }], "id", { "duplicates": "fallback" }` | `{ "null-prototype": { "a": { "id": "a", "n": 1 }, "b": { "id": "b", "n": 2 } } }` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a" }, { "n": 1 }, { "id": null }, { "id": true }, { "id": NaN }, { "id": { "b": 1 } }], "id", { "invalidKeys": "asString" }` | `{ "null-prototype": { "NaN": { "id": NaN }, "a": { "id": "a" }, "null": { "id": null }, "true": { "id": true }, "undefined": { "n": 1 } } }` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a" }, { "id": null }], "id", { "invalidKeys": "fallback" }` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "b", "n": 2 }], "id", { "mapValue": ‹a value function reading n› }` | `{ "null-prototype": { "a": 1, "b": 2 } }` | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "id": "a", "n": 1 }, { "id": "b", "n": 2 }], "id", { "mapValue": ‹a function that throws› }` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- **Both a property name and a function:** a property name keeps the key's type and covers most calls, and a function covers a computed key (`item.code.toLowerCase()`).
  - In the sample below, a string literal is about three in five calls, and an expression, a function or a variable, about one in five.
  - lodash and Underscore take either; es-toolkit, remeda, radash, `Object.groupBy`, Kotlin's `associateBy`, and Groovy's `collectEntries` take only a function.
- **Null prototype:** es-toolkit, radash, remeda, and Underscore return an ordinary object, and an item keyed `"__proto__"` replaces that object's prototype rather than becoming an entry; lodash, `Object.fromEntries`, and `Object.groupBy` keep it as an entry, and only `Object.groupBy` drops the prototype.
- **Skipping bad keys:** every JavaScript library keys an item without the key as `"undefined"`, a `null` as `"null"`, `true` as `"true"`, an object as `"[object Object]"`, and `["b"]` as `"b"`, so one bad item silently shadows another; `NaN` and `Infinity` become `"NaN"` and `"Infinity"`, and a `NaN` key usually comes from a failed parse such as `Number("abc")`.
  - Skipping is the default because nobody looks up `dict["undefined"]` on purpose: a hand-written `reduce` or `Object.fromEntries` keys bad items the same way, and a caller who cares filters them first.
  - `"asString"` keeps that conversion for a caller who wants it, by name rather than by accident, and `"fallback"` turns `keyBy` into a check; a `getKey` such as `(item) => String(item.id)` also opts in, item by item.
  - PostgreSQL's `jsonb_object_agg` rejects a `null` key (SQLSTATE `22023`), and SQLite's `json_group_object` returns text that isn't valid JSON; both key an object by its JSON text.
  - Python raises `KeyError` for a missing key and `TypeError` for an unhashable one.
- **Skipping non-objects:** every JavaScript library reads a key from a string (`"ab".length` is `2`), and lodash and Underscore key a `null` item as `"undefined"`; the others throw `TypeError`.
- **Numbers as property keys:** every JavaScript tool but `new Map` turns `1` and `"1"` into one key, and `-0` into `"0"`; a `Map` keeps the number, and the JVM languages and Python keep `1` and `"1"` apart.
- **Last duplicate wins by default:** every tool compared keeps the last, except Java's `Collectors.toMap`, which throws `IllegalStateException`, and `Object.groupBy`, which keeps both in an array.
  - Keeping the last makes `keyBy` a drop-in for the code it replaces; `"first"` and `"fallback"` exist because a silent overwrite drops an item, and each costs one `Object.hasOwn` check.
- **`mapValue` rather than a clone flag:** one function covers copying, picking a field, and reshaping, as Kotlin's `associateBy(keySelector, valueTransform)` does, without `keyBy` importing `deepClone` or repeating its options.
- **A non-array returns the fallback:** lodash and Underscore iterate an object's values (`{ a: { id: "a" } }` is keyed like `[{ id: "a" }]`) and return `{}` for `null`; es-toolkit returns `{}` for an object; the rest throw `TypeError`.
  - A fallback, rather than `{}`, lets a caller tell "no items" from "not a list", the reason [What a parser returns when it can't parse](parser-fallbacks.md) gives for a fallback that defaults to `undefined`.
- **Throws:** every tool compared throws on a revoked proxy, a throwing getter, a throwing proxy trap, or a key function that throws.
- The types were checked on TypeScript 4.9.5 and 6.0.3, which gave the same results:
  - a mutable `Cat[]` passes as `readonly T[]`, and `Array<Cat | Dog>` keyed by `"id"` gives `Partial<Record<string | number, Cat | Dog>>`, while a key only `Cat` has is a compile error;
  - `Array<Cat | null | undefined>` keyed by `"id"` gives `Partial<Record<string, Cat>>`;
  - the `as const` pets example gives `{ rex: { readonly id: "rex"; readonly kind: "dog" }; tom: { … } }`, and `User[]` gives `Partial<Record<string, User>>`;
  - `unknown[]` takes only a `getKey`, and a name that isn't a key is a compile error.

The call sample behind "Both a property name and a function", from `pnpm research:usage calls keyBy --argument 2`:

| Argument      | Calls | Share (%) |
| :------------ | ----: | --------: |
| (expression)  |    32 |      20.8 |
| 'name'        |    21 |      13.6 |
| (none)        |    20 |        13 |
| 'id'          |    16 |      10.4 |
| 'round'       |    10 |       6.5 |
| (cut off)     |     8 |       5.2 |
| "tid"         |     3 |       1.9 |
| 'title'       |     3 |       1.9 |
| "message"     |     2 |       1.3 |
| "rate"        |     2 |       1.3 |
| "slug"        |     2 |       1.3 |
| 'address'     |     2 |       1.3 |
| 'fingerprint' |     2 |       1.3 |
| 'key'         |     2 |       1.3 |
| `extId`       |     2 |       1.3 |
| "code"        |     1 |       0.6 |
| "depNumber"   |     1 |       0.6 |
| "key"         |     1 |       0.6 |
| "label"       |     1 |       0.6 |
| "name"        |     1 |       0.6 |
| "path"        |     1 |       0.6 |
| "remarks"     |     1 |       0.6 |
| "url"         |     1 |       0.6 |
| "value"       |     1 |       0.6 |
| 'ID'          |     1 |       0.6 |
| '_id'         |     1 |       0.6 |
| '_name'       |     1 |       0.6 |
| 'addr'        |     1 |       0.6 |
| 'cell_id'     |     1 |       0.6 |
| 'encode'      |     1 |       0.6 |
| 'number'      |     1 |       0.6 |
| 'p'           |     1 |       0.6 |
| 'playerIndex' |     1 |       0.6 |
| 'prefix'      |     1 |       0.6 |
| 'signature'   |     1 |       0.6 |
| 'start'       |     1 |       0.6 |
| 'streamId'    |     1 |       0.6 |
| 'strikePrice' |     1 |       0.6 |
| 'twitchId'    |     1 |       0.6 |
| 'uid'         |     1 |       0.6 |
| 'video'       |     1 |       0.6 |
| 'voter_uid'   |     1 |       0.6 |

- **Method**: GitHub code search for `keyBy` in JavaScript and TypeScript, up to the top 300 files per language: 533 files sampled of 186,752 matching, holding 154 calls.
- **Collected**: 2026-10-31
- **Caveats**:
  - The sample is GitHub's top-ranked files for the query, not a random sample.
  - Only calls inside GitHub's text-match fragments are seen; a call that runs past a fragment's edge counts as `(cut off)`.
  - Definitions (`function parseInt(`, a method followed by `{`, a typed signature followed by `:`) and calls inside comments or strings are skipped, while calls inside a template's `${…}` count; a fragment that starts mid-string can't be told apart, so a few such calls may still count.
  - A literal argument is reported as written; anything else is `(expression)`.

## Consequences

- The docs show `new Map(items.map((item) => [item.id, item]))` as the answer for a caller who needs `1` and `"1"` apart or a key that isn't a property key.
- The docs state that items are shared unless `mapValue` copies them, show `{ mapValue: deepClone }`, and say that integer-like keys come first in the result's key order.
- The implementation's type tests cover both overloads, an `as const` input, a mixed array, a nullable item type, `mapValue`, and `invalidKeys: "asString"`, on TypeScript 4.9 and 6.0.
- Its tests cover each `duplicates` and `invalidKeys` value, including `"fallback"` with no duplicates or invalid keys, and a `mapValue` that throws.
- A `Map` version, if it's wanted, gets its own issue and record.
- Its tests key an item by `"__proto__"` and check that the result's prototype is still `null` and `Object.prototype` unchanged.
- No tool compared returns a fallback, so every column throws for the hostile cases.
