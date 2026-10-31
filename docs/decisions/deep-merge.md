---
type: Decision
title: How deepMerge combines defaults and overrides
description: '`deepMerge(defaults, overrides)` returns a new value: it recurses where both sides are plain objects, and otherwise takes the override, copied as deepClone copies it; arrays are replaced unless `arrays` is `"concat"`, `undefined` keeps the default while `null` overrides it, an own `__proto__` key is dropped, symbol keys merge, cycles are kept, and a throw returns the `fallback` option, `undefined` by default, unless `unreadable` is `"omit"`.'
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-31T01:48:00Z }
verified: { by: human:jjloneman, at: 2026-10-31T23:44:08Z }
---

# How deepMerge combines defaults and overrides

`deepMerge(defaults, overrides, options?)` layers `overrides` over `defaults` without touching either: `deepMerge({ retry: { count: 3, delay: 100 } }, { retry: { count: 5 } })` is `{ retry: { count: 5, delay: 100 } }`, a new object.

## Decision

- **Signature:**

  ```ts
  deepMerge<D, O, F = undefined>(
    defaults: D,
    overrides: O,
    options?: {
      arrays?: "replace" | "concat";
      fallback?: F;
      unreadable?: "fallback" | "omit";
    },
  ): DeepMerged<D, O> | F
  ```

  - The two values are positional, as [How a function takes its parameters](function-parameters.md) asks, rather than #10's `deepMerge({ defaults, values })`; the record needs no exception.
  - The second parameter is `overrides`, not `values`, so an editor's parameter hint says which side wins.
  - Each option but `fallback` names a kind of value, then what to do with it, as [deepClone](deep-clone.md)'s do; the first value listed is the default.
  - `DeepMerged<D, O>` is a recursive mapped type: where both sides are object types it merges their keys, and anywhere else `O` wins.
  - A key whose type in `O` can be `undefined` takes `D`'s type for the `undefined` part: `deepMerge({ foo: "bar" }, { foo: undefined })` is typed `{ foo: string }`, with no `| undefined`.

- **It recurses only where both sides are [plain objects](is-plain-object.md)**, from any realm, `null`-prototype included; the result is a new plain object holding `defaults`' keys in their order, then `overrides`' new keys.
- **Anywhere else the override wins**, at the top level too: `deepMerge({ a: 1 }, 2)` is `2`, and `deepMerge(1, { a: 1 })` is `{ a: 1 }`.
- **Arrays are replaced by default:** `deepMerge({ a: [1, 2] }, { a: [3] })` is `{ a: [3] }`.
- **`arrays: "concat"` joins two arrays** into `defaults`' items, then `overrides`' items, each copied as `deepClone` copies it:
  - `deepMerge({ a: [1, 2] }, { a: [3] }, { arrays: "concat" })` is `{ a: [1, 2, 3] }`, and two top-level arrays concatenate too;
  - it applies only where both sides are arrays; an array against anything else follows the rules above, so `{ a: [1] }` with `{ a: 2 }` is `{ a: 2 }`;
  - items aren't merged with each other, so `[{ b: 1 }]` and `[{ c: 2 }]` give `[{ b: 1 }, { c: 2 }]`.
- **`undefined` keeps the default; `null` overrides it:**
  - a key whose override is `undefined`, or an `overrides` that is `undefined`, leaves the default in place: `deepMerge({ foo: "bar" }, { foo: undefined })` is `{ foo: "bar" }`;
  - `null` is a value a caller means, so `deepMerge({ foo: "bar" }, { foo: null })` is `{ foo: null }`; it's how a caller clears a default.
- **The result shares nothing with its inputs that [deepClone](deep-clone.md) wouldn't share:**
  - every value it takes from either side, merged or not, is copied as `deepClone` copies it, at its default options: plain objects, arrays, `Map`, `Set`, `Date`, `RegExp`, typed arrays, errors, and boxed primitives are copies;
  - class instances, functions, and host objects are shared by reference, as `deepClone` shares them;
  - so mutating the result never reaches `defaults` or `overrides`, and `isDeepEqual(deepMerge(defaults, {}), defaults, { ignoreMapSetKeyIdentity: true })` holds.
- **Keys:**
  - own enumerable string and symbol keys merge; a getter is read once and stored as a value;
  - an own `__proto__` key, which `JSON.parse` creates, is dropped, so it can't replace the result's prototype;
  - `constructor` and `prototype` are kept as ordinary keys.
- **It can't pollute a prototype:** it reads only own keys, writes only to objects it built, never into either input, and recurses only into plain objects, so no key it reads reaches `Object.prototype` or any other prototype.
- **Cycles and shared references are kept**, as `deepClone` keeps them: a cycle in `overrides` is a cycle in the result.
- **Anything that throws returns the `fallback` option,** `undefined` by default: a throwing getter, a revoked proxy, or a trap that throws, on either side.
- **`unreadable: "omit"` leaves out only what throws,** as `deepClone`'s does, rather than returning the fallback:
  - an override that throws counts as missing, so the default stays: `{ trap: 1 }` merged with an object whose `trap` getter throws is `{ trap: 1 }`;
  - a default that throws is left out, unless `overrides` supplies that key;
  - an array item that throws becomes `undefined`, so later indexes don't shift;
  - either input itself still returns the fallback when it can't be read at all, such as a revoked proxy or a proxy whose `ownKeys` trap throws.
- **No customizer callback**, like lodash's `mergeWith`; it can be added later if a caller needs a strategy the options don't cover.

## Comparison

The tiers 0–2 summary from [research/results/deep-merge.md](../../research/results/deep-merge.md), generated by `pnpm research`.

- A cell shows the merged value, marked as `deepClone`'s comparison marks a clone: `Symbol(shared)` is an object the result holds from either input, the very same object, not a copy, and `Symbol(cycle)` a reference back to an ancestor.
- A result that _is_ one of the inputs shows as `Symbol(shared)` on its own, as radash's does when one side isn't an object.
- The `arrays: "concat"` rows run deepmerge, whose default concatenates, and lodash's `mergeWith` with the customizer its docs show; no library compared has an option like `unreadable`.
- Groovy, Kotlin, and Python merge maps one level deep, and every value built in Node is `—` there.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`deepMerge` | deepmerge<br>`deepmerge(defaults, overrides)` | defu<br>`defu(overrides, defaults)` | es-toolkit<br>`toMerged(defaults, overrides)` | JS built-ins<br>`{ ...defaults, ...overrides }` | lodash<br>`_.defaultsDeep({}, overrides, defaults)` | lodash<br>`_.merge({}, defaults, overrides)` | lodash<br>`_.mergeWith({}, defaults, overrides, concatArrays)` | radash<br>`assign(defaults, overrides)` | Ramda<br>`mergeDeepRight(defaults, overrides)` | remeda<br>`mergeDeep(defaults, overrides)` | Groovy<br>`defaults + overrides` | Kotlin<br>`defaults + overrides` | Python<br>`defaults \| overrides` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `{ "a": { "b": 1, "c": 2 } }, { "a": { "b": 3 } }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3, "c": 2 } }` | — | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3, "c": 2 } }` | `{ "a": { "b": 3 } }` | `{ "a": { "b": 3 } }` | `{ "a": { "b": 3 } }` |
| `{ "a": 1, "b": 2 }, { "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | — | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` | `{ "a": 1, "b": 2, "c": 3 }` |
| `{ "a": { "b": { "c": 1 } } }, { "a": { "b": { "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | — | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "c": 1, "d": 2 } } }` | `{ "a": { "b": { "d": 2 } } }` | `{ "a": { "b": { "d": 2 } } }` | `{ "a": { "b": { "d": 2 } } }` |
| `{ "a": [1, 2] }, { "a": [3] }` | `{ "a": [3] }` | `{ "a": [1, 2, 3] }` | `{ "a": [3, 1, 2] }` | `{ "a": [3, 2] }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": [3, 2] }` | `{ "a": [3, 2] }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": [3] }` | `{ "a": [3] }` | `{ "a": [3] }` |
| `{ "a": [{ "b": 1 }] }, { "a": [{ "c": 2 }] }` | `{ "a": [{ "c": 2 }] }` | `{ "a": [{ "b": 1 }, { "c": 2 }] }` | `{ "a": [‹Symbol(shared)›, ‹Symbol(shared)›] }` | `{ "a": [{ "b": 1, "c": 2 }] }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": [{ "b": 1, "c": 2 }] }` | `{ "a": [{ "b": 1, "c": 2 }] }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": [{ "c": 2 }] }` | `{ "a": [{ "c": 2 }] }` | `{ "a": [{ "c": 2 }] }` |
| `{ "a": 1 }, { "a": undefined }` | `{ "a": 1 }` | `{ "a": undefined }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": undefined }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": undefined }` | `{ "a": undefined }` | `{ "a": undefined }` | — | — | — |
| `{ "a": 1 }, { "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": 1 }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | — | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` |
| `{ "a": { "b": 1 } }, { "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` | `{ "a": null }` |
| `{ "a": { "b": 1 } }, { "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": { "b": 1 } }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` |
| `{ "a": 1 }, { "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` |
| `{ "a": { "b": 1 } }, {}` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | — | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` |
| `{}, { "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` |
| `{ "a": ‹a Date› }, {}` | `{ "a": { "Date": 0 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "Date": 0 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{ "a": 1 }, { "a": ‹a Date› }` | `{ "a": { "Date": 0 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{ "a": ‹a Date› }, { "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{ "a": { "b": 1 } }, { "a": ‹a Date› }` | `{ "a": { "Date": 0 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": { "b": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{ "a": ‹a Map with an entry› }, { "a": ‹a Map with a different value› }` | `{ "a": { "Map": [["a", 2]] } }` | `{ "a": {} }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{}, { "a": ‹a class instance› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "x": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{ "a": ‹a class instance› }, {}` | `{ "a": ‹Symbol(shared)› }` | `{ "a": { "x": 1 } }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹[object Object]› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{}, { "a": ‹a function› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | `{ "a": ‹Symbol(shared)› }` | — | — | — |
| `{}, ‹an object with a cycle›` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | 💥 `RangeError` | `{ "name": "a", "self": ‹Symbol(shared)› }` | 💥 `RangeError` | `{ "name": "a", "self": ‹Symbol(shared)› }` | `{ "name": "a", "self": { "name": "a", "self": ‹Symbol(cycle)› } }` | `{ "name": "a", "self": { "name": "a", "self": ‹Symbol(cycle)› } }` | — | `{ "name": "a", "self": ‹Symbol(shared)› }` | `{ "name": "a", "self": ‹Symbol(shared)› }` | `{ "name": "a", "self": ‹Symbol(shared)› }` | — | — | — |
| `{}, ‹an object with a symbol key›` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 1 }` | `{}` | `{}` | `{ "[Symbol(key)]": 1 }` | `{}` | `{}` | — | `{}` | `{}` | `{ "[Symbol(key)]": 1 }` | — | — | — |
| `‹an object with a symbol key›, ‹an object with a different symbol-key value›` | `{ "[Symbol(key)]": 2 }` | `{ "[Symbol(key)]": 2 }` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 2 }` | `{}` | `{}` | — | `{}` | `{}` | `{ "[Symbol(key)]": 2 }` | — | — | — |
| `{}, ‹an object with an own __proto__ key›` | `{}` | `{}` | `{}` | `{}` | `{ "__proto__": ‹Symbol(shared)› }` | `{}` | `{}` | — | `{ "__proto__": { "polluted": true } }` | `‹[object Object]›` | `{ "__proto__": ‹Symbol(shared)› }` | — | — | — |
| `{}, { "constructor": { "prototype": { "polluted": true } } }` | `{ "constructor": { "prototype": { "polluted": true } } }` | `{}` | `{}` | `{ "constructor": { "prototype": { "polluted": true } } }` | `{ "constructor": ‹Symbol(shared)› }` | `{ "constructor": { "prototype": { "polluted": true } } }` | `{ "constructor": { "prototype": { "polluted": true } } }` | — | `{ "constructor": ‹Symbol(shared)› }` | `{ "constructor": ‹Symbol(shared)› }` | `{ "constructor": ‹Symbol(shared)› }` | `{ "constructor": { "prototype": { "polluted": true } } }` | `{ "constructor": { "prototype": { "polluted": true } } }` | `{ "constructor": { "prototype": { "polluted": true } } }` |
| `{ "a": 1 }, { "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": ‹Symbol(shared)› }` | `{ "a": 1, "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": ‹Symbol(shared)› }` | `{ "a": 1, "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": { "polluted": true } }` | — | `{ "a": 1, "prototype": ‹Symbol(shared)› }` | `{ "a": 1, "prototype": ‹Symbol(shared)› }` | `{ "a": 1, "prototype": ‹Symbol(shared)› }` | `{ "a": 1, "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": { "polluted": true } }` | `{ "a": 1, "prototype": { "polluted": true } }` |
| `{}, ‹an object with a getter›` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | — |
| `‹a null-prototype object with a›, { "b": 2 }` | `{ "null-prototype": { "a": 1, "b": 2 } }` | `{ "a": 1, "b": 2 }` | `{ "a": 1, "b": 2 }` | `{ "null-prototype": { "a": 1, "b": 2 } }` | `{ "a": 1, "b": 2 }` | `{ "a": 1, "b": 2 }` | `{ "a": 1, "b": 2 }` | — | `{ "a": 1, "b": 2 }` | `{ "a": 1, "b": 2 }` | `{ "a": 1, "b": 2 }` | — | — | — |
| `{ "a": 1 }, ‹a cross-realm object›` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | — |
| `{ "b": 1 }, ‹a proxy of a plain object›` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | — | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | `{ "a": 1, "b": 1 }` | — | — | — |
| `{ "a": 1 }, undefined` | `{ "a": 1 }` | 💥 `TypeError` | `{ "a": 1 }` | 💥 `TypeError` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `‹Symbol(shared)›` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | — |
| `undefined, { "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | 💥 `TypeError` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `‹Symbol(shared)›` | `{ "a": 1 }` | 💥 `TypeError` | — | — | — |
| `{ "a": 1 }, 2` | `2` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | — |
| `1, { "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | 💥 `TypeError` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | — |
| `[1, 2], [3]` | `[3]` | `[1, 2, 3]` | `{}` | `[3, 2]` | `{ "0": 3, "1": 2 }` | `{ "0": 3, "1": 2 }` | `{ "0": 3, "1": 2 }` | — | `{ "0": 3, "1": 2 }` | `{ "0": 3, "1": 2 }` | `{ "0": 3, "1": 2 }` | — | — | — |
| `{ "a": 1 }, [1]` | `[1]` | `[1]` | `{ "a": 1 }` | `{ "0": 1, "a": 1 }` | `{ "0": 1, "a": 1 }` | `{ "0": 1, "a": 1 }` | `{ "0": 1, "a": 1 }` | — | `{ "0": 1, "a": 1 }` | `{ "0": 1, "a": 1 }` | `{ "0": 1, "a": 1 }` | — | — | — |
| `{ "a": 1 }, null` | `null` | 💥 `TypeError` | `{ "a": 1 }` | 💥 `TypeError` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `‹Symbol(shared)›` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | — |
| `{}, ‹a revoked proxy›` | `undefined` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | — | — |
| `{}, ‹an object with a throwing getter›` | `undefined` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — |
| `‹a proxy whose ownKeys trap throws›, { "a": 1 }` | `undefined` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — |
| `{ "a": [1, 2] }, { "a": [3] }, { "arrays": "concat" }` | `{ "a": [1, 2, 3] }` | `{ "a": [1, 2, 3] }` | — | — | — | — | — | `{ "a": [1, 2, 3] }` | — | — | — | — | — | — |
| `{ "a": [{ "b": 1 }] }, { "a": [{ "c": 2 }] }, { "arrays": "concat" }` | `{ "a": [{ "b": 1 }, { "c": 2 }] }` | `{ "a": [{ "b": 1 }, { "c": 2 }] }` | — | — | — | — | — | `{ "a": [{ "b": 1 }, ‹Symbol(shared)›] }` | — | — | — | — | — | — |
| `{ "a": [1] }, { "a": undefined }, { "arrays": "concat" }` | `{ "a": [1] }` | `{ "a": undefined }` | — | — | — | — | — | `{ "a": [1, undefined] }` | — | — | — | — | — | — |
| `{ "a": [1] }, { "a": 2 }, { "arrays": "concat" }` | `{ "a": 2 }` | `{ "a": 2 }` | — | — | — | — | — | `{ "a": [1, 2] }` | — | — | — | — | — | — |
| `{ "a": 1 }, { "a": [2] }, { "arrays": "concat" }` | `{ "a": [2] }` | `{ "a": [2] }` | — | — | — | — | — | `{ "a": [2] }` | — | — | — | — | — | — |
| `[1, 2], [3], { "arrays": "concat" }` | `[1, 2, 3]` | `[1, 2, 3]` | — | — | — | — | — | `{ "0": 3, "1": 2 }` | — | — | — | — | — | — |
| `{}, ‹an object with a throwing getter›, { "unreadable": "omit" }` | `{}` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `{ "trap": 1 }, ‹an object with a throwing getter›, { "unreadable": "omit" }` | `{ "trap": 1 }` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an object with a throwing getter›, { "b": 1 }, { "unreadable": "omit" }` | `{ "b": 1 }` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an object with a throwing getter›, { "trap": 2 }, { "unreadable": "omit" }` | `{ "trap": 2 }` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `{ "b": 2 }, { "a": 1, "b": ‹a revoked proxy› }, { "unreadable": "omit" }` | `{ "a": 1, "b": 2 }` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `{}, { "a": [1, ‹a revoked proxy›] }, { "unreadable": "omit" }` | `{ "a": [1, undefined] }` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `{}, ‹a revoked proxy›, { "unreadable": "omit" }` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a proxy whose ownKeys trap throws›, { "a": 1 }, { "unreadable": "omit" }` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- **Plain objects only:** a merge into a `Date`, a `Map`, or a class instance has no meaning every caller would agree on, so those are values like any other, and the override wins. It matches lodash, es-toolkit, defu, Ramda, and remeda, which recurse only into plain objects.
- **`(defaults, overrides)` order:** a spread, `Object.assign`, lodash's `merge`, deepmerge, es-toolkit, Ramda's `mergeDeepRight`, and remeda all put the winning value last; only defu puts it first.
  - A lodash-style name would mislead: `defaultsDeep` fills only keys that are `undefined`, so its first argument wins, the opposite of `deepMerge`.
- **Arrays replaced by default:** a merged array has no answer that fits every caller, and each library picks a different one:
  - deepmerge concatenates (`[1, 2, 3]`), and defu prepends the override's items (`[3, 1, 2]`);
  - lodash and es-toolkit merge by index (`[3, 2]`), which turns `[{ b: 1 }]` and `[{ c: 2 }]` into `[{ b: 1, c: 2 }]`;
  - Ramda, remeda, radash, the JVM languages, Python, PostgreSQL, and SQLite's RFC 7396 `json_patch` replace, as `deepMerge` does.
- **`arrays: "concat"` as the one alternative:** callers do change how arrays merge, and replacing is what they change deepmerge's concatenation to most often (the counts below).
  - deepmerge's `arrayMerge` option turns up in about a tenth as many files as `deepmerge` itself; these are separate counts, not files holding both names, so the ratio is an order of magnitude.
  - `overwriteMerge`, the name deepmerge's README gives a replacing `arrayMerge`, outnumbers `combineMerge`, its merge-by-index recipe, and `concatMerge`.
  - Concatenation is deepmerge's default and the example in lodash's `mergeWith` docs, so it's the strategy callers already reach for; merging by index is the least configured, and is left out.
  - lodash's `mergeWith` recipe lets an `undefined` override into the array (`[1, undefined]`), concatenates a non-array override onto it (`[1, 2]`), and turns two top-level arrays into an object; `"concat"` follows the rest of `deepMerge`'s rules instead.
  - A customizer callback would hand a caller the cases this record settles (cycles, `__proto__`, throws), so the option is a string, as `deepClone`'s are.
- **`undefined` keeps the default:** `{ ...defaults, ...options }` with an `options.timeout` left `undefined` is the bug a defaults merge exists to avoid.
  - lodash, es-toolkit, and defu keep the default; deepmerge, Ramda, remeda, radash, and a spread let `undefined` through.
  - `null` overrides everywhere but defu, which treats it as missing, and SQLite, whose `json_patch` follows RFC 7396 and deletes the key.
- **Copying as `deepClone` does:** no library compared both copies and shares the way `deepClone` does.
  - Every library copies a plain object it merges, and most share one it only passes through: defu, Ramda, remeda, radash, and a spread hand back the override's nested objects themselves.
  - Every library shares a `Date` from `overrides`, so mutating the result's date mutates the caller's; only es-toolkit copies one from `defaults`.
  - deepmerge flattens a class instance to a plain object, and empties a `Map` to `{}`; es-toolkit flattens a class instance from `defaults`.
  - One rule for both functions means a merged result is as independent of its inputs as a clone is.
- **`__proto__` dropped, `constructor` and `prototype` kept:**
  - an own `__proto__` key, set on the result, would replace its prototype, which is why `JSON.parse('{"__proto__": …}')` is the classic pollution payload; a spread, radash, and remeda copy it as a key, and Ramda's result comes back with a replaced prototype;
  - lodash's prototype-pollution CVEs came from following `constructor.prototype` or `__proto__` into an existing object; `deepMerge` never writes to an object it didn't build, so a `constructor` or `prototype` key is only data, and dropping it, as deepmerge and defu do, would lose real data, such as a config field named `constructor`.
- **Symbol keys:** deepmerge, remeda, and a spread merge them, as `deepMerge` does; defu and es-toolkit keep only `defaults`' symbol keys, and lodash, Ramda, and radash drop them.
- **A `null` prototype** is kept only by es-toolkit, as `deepClone` keeps it; every other library returns an ordinary object.
- **Cycles:** deepmerge and es-toolkit overflow the stack (`RangeError`); lodash unrolls one level before closing the cycle; defu, Ramda, remeda, radash, and a spread share the cyclic object.
- **The top level follows the nested rule,** so one rule explains every level. Every library compared ignores an `overrides` that isn't an object and returns `defaults`, and deepmerge, es-toolkit, and remeda throw on `undefined` or `null` there; the signature's `O` makes a non-object override a visible choice rather than a silent one.
- **Throws:** every library compared throws on a revoked proxy or a throwing getter, on either side.
- **`unreadable` defaults to `"fallback"`,** as `deepClone`'s does (owner, 2026-10-31):
  - one option name with two defaults would mislead a caller who knows one of the functions;
  - with `"omit"` by default, an override whose getter throws would silently leave the default in place, so a broken config would run on defaults unnoticed; the fallback tells the caller the merge failed.

The code-search counts behind "`arrays: "concat"` as the one alternative", from `pnpm research:usage counts arrayMerge overwriteMerge combineMerge concatMerge createDefu mergeWith defaultsDeep deepmerge --language JavaScript --language TypeScript`:

| Name           | JavaScript | TypeScript |   Total |
| :------------- | ---------: | ---------: | ------: |
| arrayMerge     |      8,544 |      4,360 |  12,904 |
| overwriteMerge |        215 |        315 |     530 |
| combineMerge   |        167 |        245 |     412 |
| concatMerge    |         60 |         88 |     148 |
| createDefu     |        823 |        456 |   1,279 |
| mergeWith      |     54,656 |     40,384 |  95,040 |
| defaultsDeep   |     16,640 |      4,976 |  21,616 |
| deepmerge      |     71,936 |     61,120 | 133,056 |

- **Method**: GitHub code search, one exact-phrase query (`"<name>"`) per name, reading its `total_count`.
- **Collected**: 2026-10-31
- **Caveats**:
  - Counts are approximate and change from day to day; cite one with its date, as an order of magnitude.
  - Matching ignores case.
  - Without a `language:` qualifier every language counts, so an unprefixed name can collide with another language's API (`parseBoolean` matches Java's `Boolean.parseBoolean`).

The npm downloads behind it, from `pnpm research:usage npm deepmerge defu lodash.merge deepmerge-ts lodash.mergewith`:

| Package          | Weekly downloads |
| :--------------- | ---------------: |
| deepmerge        |      137,872,527 |
| defu             |       64,975,080 |
| lodash.merge     |      149,668,198 |
| deepmerge-ts     |       30,175,688 |
| lodash.mergewith |       16,436,519 |

- **Method**: npm's downloads API, 2026-10-23 to 2026-10-29.
- **Collected**: 2026-10-31
- **Caveats**:
  - Downloads count every install, CI and mirrors included, so they measure reach, not users.

## Consequences

- `DeepMerged<D, O>` must parse in TypeScript 4.9, so it avoids `const` type parameters and `NoInfer`; the docs state that it describes plain-object types, and that a non-plain value's type is `O`'s. Raising that floor is #117.
- The implementation's type tests cover the `undefined` rule: `deepMerge({ foo: "bar" }, { foo: undefined })` is `{ foo: string }`.
- Its tests merge `JSON.parse('{"__proto__": {"polluted": true}}')`, and a `constructor.prototype` payload, and check that `Object.prototype` is unchanged; the comparison table shows only what a call returns, not whether it polluted a prototype.
- The docs lead with the two rules a caller is most likely to assume wrongly: arrays are replaced, and `undefined` doesn't override.
- No tool compared returns a fallback, so every column throws for the hostile cases.
