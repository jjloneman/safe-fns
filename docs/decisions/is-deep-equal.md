---
type: Decision
title: When isDeepEqual calls two values equal
description: Primitives by SameValueZero; plain objects and arrays by their own enumerable string and symbol keys, with a missing key or hole never equal to `undefined`; other objects need the same prototype, and built-ins compare by their contents across realms; `Map` keys and `Set` members by SameValueZero unless `ignoreMapSetKeyIdentity` matches them by content; cycles compare by shape, anything that throws returns `false`, and `ignoreArrayOrder` compares arrays as multisets at every depth.
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-29T16:19:17Z }
verified: { by: human:jjloneman, at: 2026-10-30T02:54:00Z }
---

# When isDeepEqual calls two values equal

`isDeepEqual(a, b, options?)` reports whether two values hold the same data: `isDeepEqual({ a: [1] }, { a: [1] })` is `true`.

## Decision

- **Signature:**

  ```ts
  isDeepEqual(
    a: unknown,
    b: unknown,
    options?: {
      ignoreArrayOrder?: boolean;
      ignoreMapSetKeyIdentity?: boolean;
    },
  ): boolean
  ```

  - Exactly two values, per [How a function takes its parameters](function-parameters.md); several values compare against the first.
  - It returns a plain `boolean`, not a type predicate: `b is T` would be wrong for a class instance compared with an equal plain object's type, and for a tuple under `ignoreArrayOrder`.

- **Primitives compare by SameValueZero,** the rule `Map`, `Set`, and `Array.prototype.includes` use:
  - `NaN` equals `NaN`;
  - `0` equals `-0`;
  - nothing is coerced: `1` and `"1"` differ, and so do `null` and `undefined`.
- **Plain objects and arrays compare by their own enumerable keys,** strings and symbols alike; key order never matters.
  - A missing key is never equal to a key holding `undefined`: `{ a: undefined }` and `{}` differ.
  - An array's hole is a missing key too, so `[1, , 3]` and `[1, undefined, 3]` differ.
  - Non-enumerable keys are ignored, as every library compared but radash ignores them.
  - A shared reference compares like any other value: `{ a: x, b: x }` equals `{ a: { … }, b: { … } }` when the contents match.
- **Prototypes must match, except between plain objects, and between built-ins of the same kind from different realms.**
  - Any two [plain objects](is-plain-object.md) compare by their keys alone, whatever their realm, and whether their prototype is `Object.prototype` or `null`.
  - Arrays from any realm compare as arrays.
  - A class instance never equals a plain object with the same fields; two instances need the same prototype, then compare by their own enumerable keys.
- **Built-ins compare by their contents, identified by brand checks** rather than `instanceof`, so a `Date` from an iframe or `node:vm` equals one from this realm:
  - `Date` by its time value, so two invalid dates are equal, as two `NaN`s are;
  - `RegExp` by `source` and `flags`;
  - a typed array by its type and elements, an `ArrayBuffer` or `DataView` by its bytes;
  - a boxed primitive by its type and primitive value, never equal to the bare primitive: `new Number(1)` and `1` differ;
  - an `Error` by its `name`, `message`, and `cause`, then its own enumerable keys, as with any other object.
- **`Map` keys and `Set` members compare by SameValueZero, as the collections themselves do;** `Map` values compare deeply, and insertion order never matters.
  - Two `Map`s keyed by separately built `{ a: 1 }` objects differ, and so do two `Set`s each holding its own `{ a: 1 }`.
  - It's how the collections look a key up, and a `Map` keyed by objects is almost always keyed by identity.
- **`ignoreMapSetKeyIdentity: true` matches `Map` keys and `Set` members by content instead,** at every depth:
  - a key that matches by SameValueZero is found by lookup first, so only the object keys left over are searched, each against every unmatched key, by this same deep equality;
  - that search is O(n²) in the number of such keys, which the docs state;
  - it makes a `Map` keyed by objects equal to its own copy: `structuredClone`, `deepClone`, or a JSON round-trip builds new key objects, so `isDeepEqual(map, structuredClone(map))` is `false` without it.
- **Everything else compares by reference:** functions, `WeakMap`, `WeakSet`, `Promise`, and other objects whose contents can't be read.
- **Cycles compare by shape:** two separately built objects that each refer back to themselves the same way are equal.
- **Anything that throws returns `false`:** a throwing getter, a revoked proxy, or a trap that throws.
  - `false` is the answer that keeps data: a caller that skips a save when nothing changed still saves.
  - The same value passed twice is equal before anything is read, so `isDeepEqual(x, x)` is `true` even for a revoked proxy.
- **`ignoreArrayOrder: true` compares every array, at every depth, as a multiset:**
  - `[1, 2]` equals `[2, 1]`, but `[1, 1, 2]` doesn't equal `[1, 2, 2]`, since each item is matched once;
  - items are matched by this same deep equality, so `[[1, 2]]` equals `[[2, 1]]`;
  - matching is O(n²) in an array's length, which the docs state.

## Comparison

The tiers 0–2 summary from [research/results/is-deep-equal.md](../../research/results/is-deep-equal.md), generated by `pnpm research`.

- No tool compared offers an order-free array comparison, or a switch for key identity, so every column is `—` for the cases with options; the libraries that always match keys by content show it in the default rows.
- Python, Go, and the JVM languages only see the JSON-shaped cases; their decoded values are the language's own maps, lists, and numbers.
  - Go and the JVM decode `0` as an integer and `-0` as a float, so their `0, -0` row compares two types, not two zeros: Go's `reflect.DeepEqual(0.0, -0.0)` is `true`.
- The two `JSON.stringify` columns are the hand-written comparison this function replaces.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`isDeepEqual` | dequal<br>`dequal(a, b)` | es-toolkit<br>`isEqual(a, b)` | fast-deep-equal<br>`equal(a, b)` | fast-deep-equal<br>`equal(a, b) from "fast-deep-equal/es6"` | Hermes<br>`JSON.stringify(a) === JSON.stringify(b)` | JS built-ins<br>`JSON.stringify(a) === JSON.stringify(b)` | JS built-ins<br>`util.isDeepStrictEqual(a, b)` | lodash<br>`_.isEqual(a, b)` | radash<br>`isEqual(a, b)` | Ramda<br>`equals(a, b)` | remeda<br>`isDeepEqual(a, b)` | Underscore<br>`_.isEqual(a, b)` | Go<br>`reflect.DeepEqual(a, b)` | Groovy<br>`a == b` | Java<br>`Objects.deepEquals(a, b)` | Kotlin<br>`a == b` | Python<br>`a == b` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `1, 1` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` |
| `"a", "a"` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` |
| `1, "1"` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` |
| `NaN, NaN` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `false` | `true` | `true` | `true` | `false` |
| `0, -0` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `false` | `true` | `false` | `false` | `true` | `false` | `false` | `false` | `false` | `false` | `true` |
| `null, undefined` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `1n, 1n` | `true` | `true` | `true` | `true` | `true` | 💥 `TypeError` | 💥 `TypeError` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` |
| `{}, {}` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` |
| `[], {}` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` |
| `{ "a": [1, { "b": "x" }] }, { "a": [1, { "b": "x" }] }` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` | `true` |
| `{ "a": [1, { "b": "x" }] }, { "a": [1, { "b": "y" }] }` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` |
| `{ "a": 1, "b": 2 }, ‹an object with keys b then a›` | `true` | `true` | `true` | `true` | `true` | — | `false` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `{ "a": undefined }, {}` | `false` | `false` | `false` | `false` | `false` | `true` | `true` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `[1, 2], [2, 1]` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` | `false` |
| `‹a sparse array›, [1, undefined, 3]` | `false` | `true` | `true` | `true` | `true` | — | `true` | `false` | `true` | `false` | `false` | `true` | `true` | — | — | — | — | — |
| `‹an object with a shared reference›, { "a": { "x": 1 }, "b": { "x": 1 } }` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a null-prototype object with a›, { "a": 1 }` | `true` | `false` | `true` | `false` | `false` | — | `true` | `false` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a class instance›, { "x": 1 }` | `false` | `false` | `false` | `false` | `false` | — | `true` | `false` | `false` | `true` | `true` | `false` | `false` | — | — | — | — | — |
| `‹a boxed number›, 1` | `false` | `true` | `true` | `false` | `false` | — | `true` | `false` | `true` | `false` | `false` | `false` | `true` | — | — | — | — | — |
| `‹a boxed number›, ‹a boxed number›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹an object with a non-enumerable key›, {}` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `false` | `true` | `true` | `true` | — | — | — | — | — |
| `‹an object with a symbol key›, ‹an object with a symbol key›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹an object with a symbol key›, ‹an object with a different symbol-key value›` | `false` | `true` | `false` | `true` | `true` | — | `true` | `false` | `false` | `false` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a proxy of a plain object›, { "a": 1 }` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a function›, ‹a function›` | `false` | `false` | `false` | `false` | `false` | — | `true` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `‹a Date›, ‹a Date›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a Date›, ‹a Date at 1 ms›` | `false` | `false` | `false` | `false` | `false` | — | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `‹a Date›, 0` | `false` | `false` | `false` | `false` | `false` | — | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `‹an invalid Date›, ‹an invalid Date›` | `true` | `false` | `true` | `false` | `false` | — | `true` | `true` | `true` | `false` | `true` | `false` | `false` | — | — | — | — | — |
| `‹a RegExp›, ‹a RegExp›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a RegExp›, ‹a RegExp with other flags›` | `false` | `false` | `false` | `false` | `false` | — | `true` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `‹a Map with a then b›, ‹a Map with b then a›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a Map with an entry›, ‹a Map with a different value›` | `false` | `false` | `false` | `true` | `false` | — | `true` | `false` | `false` | `true` | `false` | `false` | `true` | — | — | — | — | — |
| `‹a Map with an entry›, { "a": 1 }` | `false` | `false` | `false` | `false` | `false` | — | `false` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `‹a Map with an object key›, ‹a Map with an object key›` | `false` | `true` | `false` | `true` | `false` | — | `true` | `true` | `true` | `true` | `true` | `false` | `true` | — | — | — | — | — |
| `‹a Set with an entry›, ‹a Set with an entry›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a Set with an object›, ‹a Set with an object›` | `false` | `true` | `true` | `true` | `false` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a Uint8Array›, ‹a Uint8Array›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹a Uint8Array›, ‹a Uint16Array›` | `false` | `false` | `false` | `false` | `false` | — | `true` | `false` | `false` | `true` | `false` | `false` | `false` | — | — | — | — | — |
| `‹an ArrayBuffer of two bytes›, ‹an ArrayBuffer of two bytes›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹an Error›, ‹an Error›` | `true` | `true` | `true` | `true` | `true` | — | `true` | `true` | `true` | `true` | `true` | `true` | `true` | — | — | — | — | — |
| `‹an Error›, ‹an Error with another message›` | `false` | `true` | `false` | `false` | `false` | — | `true` | `false` | `false` | `false` | `false` | `true` | `true` | — | — | — | — | — |
| `‹an Error›, ‹a TypeError saying boom›` | `false` | `false` | `false` | `false` | `false` | — | `true` | `false` | `false` | `false` | `false` | `false` | `false` | — | — | — | — | — |
| `‹a cross-realm object›, { "a": 1 }` | `true` | `false` | `true` | `false` | `false` | — | `true` | `false` | `true` | `true` | `true` | `false` | `true` | — | — | — | — | — |
| `‹a cross-realm array›, [1, 2]` | `true` | `false` | `true` | `false` | `false` | — | `true` | `false` | `true` | `true` | `true` | `false` | `true` | — | — | — | — | — |
| `‹a cross-realm Date›, ‹a Date›` | `true` | `false` | `true` | `false` | `false` | — | `true` | `false` | `true` | `true` | `true` | `false` | `true` | — | — | — | — | — |
| `‹an object with a cycle›, ‹an object with a cycle›` | `true` | 💥 `RangeError` | `true` | 💥 `RangeError` | 💥 `RangeError` | — | 💥 `TypeError` | `true` | `true` | 💥 `RangeError` | `true` | 💥 `RangeError` | `true` | — | — | — | — | — |
| `‹an array with a cycle›, ‹an array with a cycle›` | `true` | 💥 `RangeError` | `true` | 💥 `RangeError` | 💥 `RangeError` | — | 💥 `TypeError` | `true` | `true` | 💥 `RangeError` | `true` | 💥 `RangeError` | `true` | — | — | — | — | — |
| `‹an object with a throwing getter›, { "trap": 1 }` | `false` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — | — | — |
| `‹a revoked proxy›, {}` | `false` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | — | — | — | — |
| `‹a proxy whose ownKeys trap throws›, {}` | `false` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | — | — | — | — |
| `[1, 2], [2, 1], { "ignoreArrayOrder": true }` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `[1, 1, 2], [1, 2, 2], { "ignoreArrayOrder": true }` | `false` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `[[1, 2]], [[2, 1]], { "ignoreArrayOrder": true }` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `[{ "a": 1 }, { "b": 2 }], [{ "b": 2 }, { "a": 1 }], { "ignoreArrayOrder": true }` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Map with an object key›, ‹a Map with an object key›, { "ignoreMapSetKeyIdentity": true }` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Set with an object›, ‹a Set with an object›, { "ignoreMapSetKeyIdentity": true }` | `true` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Map with an entry›, ‹a Map with a different value›, { "ignoreMapSetKeyIdentity": true }` | `false` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- SameValueZero for primitives matches lodash, es-toolkit, dequal, fast-deep-equal, and remeda, and the collections' own rule; Node's `util.isDeepStrictEqual`, Ramda, radash, and Underscore tell `0` from `-0` instead, which a caller comparing data rarely means.
- A missing key differing from `undefined` is what every library compared does; only `JSON.stringify` drops the key and calls them equal.
- A hole differs from `undefined` for the same reason, as in Node, radash, and Ramda; lodash, es-toolkit, dequal, fast-deep-equal, remeda, and Underscore treat them alike, but a hole is a missing index, and treating it as `undefined` would contradict the rule above.
- Plain objects equal across prototypes and realms because [What counts as a plain object](is-plain-object.md) already calls both kinds plain; dequal, fast-deep-equal, and Node compare constructors or prototypes, so they reject both a `null`-prototype object and a cross-realm one, and remeda rejects the cross-realm one.
- Brand checks, not `instanceof`, keep built-ins from another realm comparable; dequal, fast-deep-equal, remeda, and Node's strict check call a cross-realm `Date` unequal to a local one with the same time.
- A boxed primitive is an object, so it differs from the bare value, as in Node, Ramda, radash, fast-deep-equal, and remeda; lodash, es-toolkit, dequal, and Underscore unwrap it.
- Symbol keys count, as in Node, lodash, es-toolkit, and radash; dequal, fast-deep-equal, Ramda, remeda, and Underscore ignore them, so two objects differing only in a symbol-keyed value look equal.
- SameValueZero for `Map` keys matches es-toolkit, remeda, and fast-deep-equal's ES6 build, and for `Set` members, fast-deep-equal's ES6 build alone; it keeps both linear, where Node, lodash, and the rest match object keys and members deeply, at a quadratic cost.
- `ignoreMapSetKeyIdentity` keeps that deeper match available for the case that needs it, comparing a value with its copy, and its name follows `ignoreArrayOrder`: each option names the difference to stop caring about (owner's call, 2026-10-29).
- Comparing an `Error`'s `message` and `name` matches Node, lodash, es-toolkit, and Ramda; dequal, remeda, and Underscore call two errors with different messages equal.
- Every library compared throws on a throwing getter, a revoked proxy, or a throwing trap; returning `false` keeps the function total, as the package promises.
- Cycles: dequal, fast-deep-equal, radash, and remeda overflow the stack (`RangeError`) on a cyclic value; Node, lodash, es-toolkit, Ramda, and Underscore track the pairs they are comparing.

## Consequences

- `ignoreArrayOrder` and `ignoreMapSetKeyIdentity` have no competitor to compare against; their rules are this record's alone, and their tests pin them.
- The `Error` rule (`name`, `message`, `cause`) reads three non-enumerable properties the key walk would skip; an `Error`'s `stack` is never compared, since it differs between two otherwise identical errors.
