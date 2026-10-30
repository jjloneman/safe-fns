---
type: Decision
title: What deepClone copies and what it shares
description: deepClone copies data (plain objects, arrays, `Map`, `Set` and their keys and members, and the value-like built-ins) and shares everything it can't copy faithfully (class instances, functions, host objects) by reference; `mapSetKeys`, `uncopyable`, and `unreadable` opt into sharing keys, handing the rest to `structuredClone`, and omitting what throws; cycles and shared references are kept, it runs where `structuredClone` doesn't, and a throw returns the `fallback` option, `undefined` by default.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-30T00:01:46Z }
---

# What deepClone copies and what it shares

`deepClone(value, options?)` copies the data in a value and shares the rest: `deepClone({ at: new Date(0), user })` is a new object holding a new `Date` and the same `user` instance.

## Decision

- **It ships, beside `safeStructuredClone`, with a different promise:**
  - `safeStructuredClone` follows the structured clone rules: a class instance comes back as a plain object, and a function makes it fail;
  - `deepClone` copies only what it can copy faithfully, and shares everything else, so no value comes back changed in kind;
  - `deepClone` is plain JavaScript, so it works where `structuredClone` is missing, such as Hermes, React Native's engine.
- **Signature:**

  ```ts
  deepClone<T, F = undefined>(
    value: T,
    options?: {
      fallback?: F;
      mapSetKeys?: "clone" | "share";
      uncopyable?: "share" | "structuredClone";
      unreadable?: "fallback" | "omit";
    },
  ): T | F
  ```

  - Each option but `fallback` names a kind of value, then what to do with it, as `safeStructuredClone`'s `uncloneable` does; the first value listed is the default.

- **Copied:**
  - [plain objects](is-plain-object.md), by their own enumerable string and symbol keys, with a getter read once and stored as a value;
  - a `null`-prototype object stays `null`-prototype, and a plain object from another realm becomes one of this realm;
  - arrays, from any realm, with their holes kept;
  - `Map` and `Set`, from any realm, with their entries in order, and their keys and members copied like any other value;
  - `Date`, `RegExp` (`source` and `flags`), typed arrays, `ArrayBuffer`, `DataView`, and boxed primitives;
  - the built-in errors (`Error`, `TypeError`, and the rest), with their `name`, `message`, `stack`, `cause`, and own enumerable keys.
- **Shared by reference:**
  - class instances, including subclasses of `Error`, `Map`, and the other built-ins;
  - functions, symbols, `WeakMap`, `WeakSet`, `Promise`, and host objects such as `URL`, `File`, and DOM nodes.
- **`mapSetKeys: "share"` keeps `Map` keys and `Set` members by reference,** so `clone.get(originalKey)` and `clone.has(originalMember)` still find them; by default they're copies, so neither does.
- **`uncopyable: "structuredClone"` hands every value it would share to `structuredClone`, one at a time:**
  - a class instance comes back flattened to a plain object, an `Error` subclass as its nearest built-in error, and a platform object (`Blob`, `File`, `ImageData`, `CryptoKey`, `DOMMatrix`, `VideoFrame`) as the runtime's copy;
  - where `structuredClone` throws or is missing, the value is shared as by default: functions, symbols, `WeakMap`, `Promise`, an instance holding a method as an own property, and every value on Hermes;
  - each handed-off value is cloned apart from the rest, so a reference from it back to its parent, or to an object another value also holds, becomes a separate copy;
  - a flattened instance loses its methods, `#private` fields, and `instanceof`, which the docs state.
- **`unreadable: "omit"` leaves out only what throws,** rather than returning the fallback:
  - a property whose getter throws, or that holds a revoked proxy or an object whose traps throw, is left out;
  - an array item becomes `undefined`, so later indexes don't shift, as `safeStructuredClone`'s `"omit"` does, and a `Map` or `Set` entry is dropped;
  - the value itself still returns the fallback when it can't be read at all;
  - the return type `T` still lists what was left out.
- **Copies keep the original's shape:** a cycle stays a cycle, and two references to one object stay two references to one copy.
- **The clone equals its source** under [isDeepEqual](is-deep-equal.md), for every value it clones with `uncopyable` and `unreadable` at their defaults:
  - `isDeepEqual(deepClone(value), value, { ignoreMapSetKeyIdentity: true })` is `true` by default, since keys and members are copies;
  - with `mapSetKeys: "share"`, `isDeepEqual`'s default options are enough.
- **A proxy is read through its traps,** so a proxy of a plain object is copied as a plain object, not a proxy.
- **Anything that throws returns the `fallback` option,** `undefined` by default, unless `unreadable` is `"omit"`: a throwing getter, a revoked proxy, or a trap that throws.

## Comparison

The tiers 0–2 summary from [research/results/deep-clone.md](../../research/results/deep-clone.md), generated by `pnpm research`.

- A cell shows the clone, marked to answer what it copied:
  - `Symbol(shared)` is an object the clone holds from its source, the very same object, not a copy;
  - `Symbol(cycle)` is a reference back to an ancestor, and `Symbol(repeat)` a second reference to an object already copied;
  - `Symbol(hole)` is an array's missing index, so it can't be mistaken for `null` or `undefined`;
  - a `Map` shows as `{ "Map": [[key, value], …] }`, a `Set` as `{ "Set": [member, …] }`, and an error as `{ "Error": { cause, message, name } }`, so a shared key, member, or `cause` shows too;
  - a `Date` shows its time (`{ "Date": 0 }`), a `RegExp` its text, a typed array its items, an `ArrayBuffer` its bytes, and a boxed primitive its value, with `buffer: Symbol(shared)` on a typed array whose bytes are the source's;
  - every own key shows: a symbol key as `[Symbol(key)]`, a non-enumerable one with a `(non-enumerable)` suffix, a second key with the same label with a `#2`, and a `null`-prototype object inside `{ "null-prototype": { … } }`;
  - a getter shows as `Symbol(getter)`, since the cell reads descriptors and never runs one; an error's `stack` is left out, since its text names file paths.
- Any other object shows by its tag (`[object Object]`): a copy, since a shared one would show `Symbol(shared)`; a tag on a `Map` row means the result isn't a working `Map`.
- The Hermes and Python columns show plain JSON values only: every value built in Node is `n/a` there, so none of these markers can appear in them.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`deepClone` | es-toolkit<br>`cloneDeep(value)` | fast-copy<br>`copy(value)` | fast-copy<br>`copyStrict(value)` | Hermes<br>`JSON.parse(JSON.stringify(value))` | JS built-ins<br>`JSON.parse(JSON.stringify(value))` | JS built-ins<br>`structuredClone(value)` | klona<br>`klona(value)` | klona<br>`klona(value) from "klona/full"` | lodash<br>`_.cloneDeep(value)` | Ramda<br>`clone(value)` | remeda<br>`clone(value)` | rfdc<br>`rfdc()(value)` | rfdc<br>`rfdc({ circles: true })(value)` | Python<br>`copy.deepcopy(value)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` | `{ "a": [1, { "b": "x" }] }` |
| `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` | `"text"` |
| `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` | `42` |
| `-0` | `-0` | `-0` | `-0` | `-0` | `0` | `0` | `-0` | `-0` | `-0` | `-0` | `-0` | `-0` | `-0` | `-0` | `-0` |
| `NaN` | `NaN` | `NaN` | `NaN` | `NaN` | `null` | `null` | `NaN` | `NaN` | `NaN` | `NaN` | `NaN` | `NaN` | `NaN` | `NaN` | `NaN` |
| `12n` | `12n` | `12n` | `12n` | `12n` | 💥 `TypeError` | 💥 `TypeError` | `12n` | `12n` | `12n` | `12n` | `12n` | `12n` | `12n` | `12n` | `12n` |
| `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` | `null` |
| `undefined` | `undefined` | `undefined` | `undefined` | `undefined` | 💥 `SyntaxError` | 💥 `SyntaxError` | `undefined` | `undefined` | `undefined` | `undefined` | `undefined` | `undefined` | `undefined` | `undefined` | — |
| `‹a Date›` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | — | `"1970-01-01T00:00:00.000Z"` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | — |
| `‹an invalid Date›` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | — | `null` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | `{ "Date": NaN }` | — |
| `‹a Map with an entry›` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | — | `{}` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | `‹Symbol(shared)›` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | `{ "Map": [["a", 1]] }` | — |
| `‹a Map with an object key›` | `{ "Map": [[{ "a": 1 }, 1]] }` | `{ "Map": [[‹Symbol(shared)›, 1]] }` | `{ "Map": [[‹Symbol(shared)›, 1]] }` | `{ "Map": [[‹Symbol(shared)›, 1]] }` | — | `{}` | `{ "Map": [[{ "a": 1 }, 1]] }` | `{ "Map": [[{ "a": 1 }, 1]] }` | `{ "Map": [[{ "a": 1 }, 1]] }` | `{ "Map": [[‹Symbol(shared)›, 1]] }` | `‹Symbol(shared)›` | `{ "Map": [[{ "a": 1 }, 1]] }` | `{ "Map": [[{ "a": 1 }, 1]] }` | `{ "Map": [[{ "a": 1 }, 1]] }` | — |
| `‹a Set with an entry›` | `{ "Set": [1] }` | `{ "Set": [1] }` | `{ "Set": [1] }` | `{ "Set": [1] }` | — | `{}` | `{ "Set": [1] }` | `{ "Set": [1] }` | `{ "Set": [1] }` | `{ "Set": [1] }` | `‹Symbol(shared)›` | `{ "Set": [1] }` | `{ "Set": [1] }` | `{ "Set": [1] }` | — |
| `‹a RegExp›` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | — | `{}` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{ "RegExp": "/a/gu" }` | `{}` | `{}` | — |
| `‹a Uint8Array›` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | — | `{ "0": 1, "1": 2 }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "Uint8Array": [1, 2] }` | `{ "0": 1, "1": 2 }` | `{ "0": 1, "1": 2 }` | — |
| `‹an ArrayBuffer of two bytes›` | `{ "ArrayBuffer": [1, 2] }` | `{ "ArrayBuffer": [1, 2] }` | `{ "ArrayBuffer": [1, 2] }` | `{ "ArrayBuffer": [1, 2] }` | — | `{}` | `{ "ArrayBuffer": [1, 2] }` | `{ "ArrayBuffer": [1, 2] }` | `{ "ArrayBuffer": [1, 2] }` | `{ "ArrayBuffer": [1, 2] }` | `‹Symbol(shared)›` | `{ "ArrayBuffer": [1, 2] }` | `{}` | `{}` | — |
| `‹a boxed number›` | `{ "Number": 1 }` | `{ "Number": 1 }` | `{ "Number": 1 }` | `{ "Number": 1 }` | — | `1` | `{ "Number": 1 }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `{ "Number": 1 }` | `‹Symbol(shared)›` | `{ "Number": 1 }` | `{}` | `{}` | — |
| `‹an Error›` | `{ "Error": { "message": "boom", "name": "Error" } }` | `{ "Error": { "cause": undefined, "constructor": ‹function›, "message": "boom", "name": "Error" } }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | — | `{}` | `{ "Error": { "message": "boom", "name": "Error" } }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `{}` | `‹Symbol(shared)›` | `{ "Error": { "message": "boom", "name": "Error" } }` | `{}` | `{}` | — |
| `‹a TypeError›` | `{ "Error": { "message": "bad type", "name": "TypeError" } }` | `{ "Error": { "cause": undefined, "constructor": ‹function›, "message": "bad type", "name": "TypeError" } }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | — | `{}` | `{ "Error": { "message": "bad type", "name": "TypeError" } }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `{}` | `‹Symbol(shared)›` | `{ "Error": { "message": "bad type", "name": "TypeError" } }` | `{}` | `{}` | — |
| `‹an Error with a cause›` | `{ "Error": { "cause": { "Error": { "message": "inner", "name": "Error" } }, "message": "outer", "name": "Error" } }` | `{ "Error": { "cause": ‹Symbol(shared)›, "constructor": ‹function›, "message": "outer", "name": "Error" } }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | — | `{}` | `{ "Error": { "cause": { "Error": { "message": "inner", "name": "Error" } }, "message": "outer", "name": "Error" } }` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `{}` | `‹Symbol(shared)›` | `{ "Error": { "cause": { "Error": { "message": "inner", "name": "Error" } }, "message": "outer", "name": "Error" } }` | `{}` | `{}` | — |
| `‹a null-prototype object with a›` | `{ "null-prototype": { "a": 1 } }` | `{ "null-prototype": { "a": 1 } }` | `{ "null-prototype": { "a": 1 } }` | `{ "null-prototype": { "a": 1 } }` | — | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "null-prototype": { "a": 1 } }` | `{ "a": 1 }` | `{ "null-prototype": { "a": 1 } }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — |
| `‹a cross-realm object›` | `{ "a": 1 }` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | — | `{ "a": 1 }` | `{ "a": 1 }` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — |
| `‹a sparse array›` | `[1, ‹Symbol(hole)›, 3]` | `[1, undefined, 3]` | `[1, undefined, 3]` | `[1, ‹Symbol(hole)›, 3]` | — | `[1, null, 3]` | `[1, ‹Symbol(hole)›, 3]` | `[1, undefined, 3]` | `[1, ‹Symbol(hole)›, 3]` | `[1, undefined, 3]` | `[1, ‹Symbol(hole)›, 3]` | `[1, undefined, 3]` | `[1, ‹Symbol(hole)›, 3]` | `[1, ‹Symbol(hole)›, 3]` | — |
| `‹an object with a getter›` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": ‹Symbol(getter)› }` | — | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": ‹Symbol(getter)› }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — |
| `‹an object with a non-enumerable key›` | `{}` | `{}` | `{}` | `{ "a (non-enumerable)": 1 }` | — | `{}` | `{}` | `{}` | `{ "a (non-enumerable)": 1 }` | `{}` | `{}` | `{}` | `{}` | `{}` | — |
| `‹a proxy of a plain object›` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": 1 }` | 💥 `DataCloneError` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | `{ "a": 1 }` | — |
| `‹an object with a cycle›` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | — | 💥 `TypeError` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | 💥 `RangeError` | 💥 `RangeError` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | 💥 `RangeError` | `{ "name": "a", "self": ‹Symbol(cycle)› }` | — |
| `‹an object with a nested cycle›` | `{ "a": { "b": ‹Symbol(cycle)› } }` | `{ "a": { "b": ‹Symbol(cycle)› } }` | `{ "a": { "b": ‹Symbol(cycle)› } }` | `{ "a": { "b": ‹Symbol(cycle)› } }` | — | 💥 `TypeError` | `{ "a": { "b": ‹Symbol(cycle)› } }` | 💥 `RangeError` | 💥 `RangeError` | `{ "a": { "b": ‹Symbol(cycle)› } }` | `{ "a": { "b": ‹Symbol(cycle)› } }` | `{ "a": { "b": ‹Symbol(cycle)› } }` | 💥 `RangeError` | `{ "a": { "b": ‹Symbol(cycle)› } }` | — |
| `‹an array with a cycle›` | `[1, ‹Symbol(cycle)›]` | `[1, ‹Symbol(cycle)›]` | `[1, ‹Symbol(cycle)›]` | `[1, ‹Symbol(cycle)›]` | — | 💥 `TypeError` | `[1, ‹Symbol(cycle)›]` | 💥 `RangeError` | 💥 `RangeError` | `[1, ‹Symbol(cycle)›]` | `[1, ‹Symbol(cycle)›]` | `[1, ‹Symbol(cycle)›]` | 💥 `RangeError` | 💥 `RangeError` | — |
| `‹an object with a shared reference›` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | — | `{ "a": { "x": 1 }, "b": { "x": 1 } }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": { "x": 1 } }` | `{ "a": { "x": 1 }, "b": { "x": 1 } }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": ‹Symbol(repeat)› }` | `{ "a": { "x": 1 }, "b": { "x": 1 } }` | `{ "a": { "x": 1 }, "b": { "x": 1 } }` | — |
| `‹a class instance›` | `‹Symbol(shared)›` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | — | `{ "x": 1 }` | `{ "x": 1 }` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | `‹[object Object]›` | `{ "x": 1 }` | `{ "x": 1 }` | `{ "x": 1 }` | — |
| `‹a URL›` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `‹[object URL]›` | `‹[object URL]›` | — | `"https://example.com/"` | 💥 `DataCloneError` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `{}` | `‹Symbol(shared)›` | 💥 `DataCloneError` | `{}` | `{}` | — |
| `‹a function›` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | — | 💥 `SyntaxError` | 💥 `DataCloneError` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `{}` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | `‹Symbol(shared)›` | — |
| `‹an object holding a function›` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | — | `{ "a": 1 }` | 💥 `DataCloneError` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | — |
| `‹a symbol›` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | — | 💥 `SyntaxError` | 💥 `DataCloneError` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | 💥 `DataCloneError` | `‹Symbol(hostile)›` | `‹Symbol(hostile)›` | — |
| `‹an object with a throwing getter›` | `undefined` | 💥 `Error` | 💥 `Error` | `{ "trap": ‹Symbol(getter)› }` | — | 💥 `Error` | 💥 `Error` | 💥 `Error` | `{ "trap": ‹Symbol(getter)› }` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — |
| `‹a revoked proxy›` | `undefined` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — | 💥 `TypeError` | 💥 `DataCloneError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` | — |
| `‹a proxy whose ownKeys trap throws›` | `undefined` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — | 💥 `Error` | 💥 `DataCloneError` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | 💥 `Error` | — |
| `‹a class instance›, { "uncopyable": "structuredClone" }` | `{ "x": 1 }` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a URL›, { "uncopyable": "structuredClone" }` | `‹Symbol(shared)›` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an object holding a function›, { "uncopyable": "structuredClone" }` | `{ "a": 1, "callback": ‹Symbol(shared)› }` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an object with a throwing getter›, { "unreadable": "omit" }` | `{}` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `{ "a": 1, "b": ‹a revoked proxy› }, { "unreadable": "omit" }` | `{ "a": 1 }` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `[1, ‹a revoked proxy›], { "unreadable": "omit" }` | `[1, undefined]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a revoked proxy›, { "unreadable": "omit" }` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Map with an object key›, { "mapSetKeys": "share" }` | `{ "Map": [[‹Symbol(shared)›, 1]] }` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a Set with an object›` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | — | `{}` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | `‹Symbol(shared)›` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | `{ "Set": [{ "a": 1 }] }` | — |
| `‹a Set with an object›, { "mapSetKeys": "share" }` | `{ "Set": [‹Symbol(shared)›] }` | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an object with a symbol key›` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 1 }` | — | `{}` | `{}` | `{}` | `{ "[Symbol(key)]": 1 }` | `{ "[Symbol(key)]": 1 }` | `{}` | `{}` | `{}` | `{}` | — |
| `‹a cross-realm array›` | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | — | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | `[1, 2]` | — |
| `‹a cross-realm Date›` | `{ "Date": 0 }` | `‹[object Object]›` | `{ "Date": 0 }` | `{ "Date": 0 }` | — | `"1970-01-01T00:00:00.000Z"` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{ "Date": 0 }` | `{}` | `{}` | — |
| `‹a cross-realm Map›` | `{ "Map": [] }` | `‹[object Map]›` | `{ "Map": [] }` | `{ "Map": [] }` | — | `{}` | `{ "Map": [] }` | `{ "Map": [] }` | `{ "Map": [] }` | `{ "Map": [] }` | `‹Symbol(shared)›` | `{ "Map": [] }` | `{}` | `{}` | — |
| `‹a cross-realm Set›` | `{ "Set": [] }` | `‹[object Set]›` | `{ "Set": [] }` | `{ "Set": [] }` | — | `{}` | `{ "Set": [] }` | `{ "Set": [] }` | `{ "Set": [] }` | `{ "Set": [] }` | `‹Symbol(shared)›` | `{ "Set": [] }` | `{}` | `{}` | — |
<!-- prettier-ignore-end -->

## Why

- Getters: fast-copy's strict mode and klona's full build copy a getter as a getter, so they return even for a getter that throws, and the clone runs the original getter on each read; every other library reads it once into a value, as `deepClone` does.
- Every copier that keeps a class instance's prototype breaks its `#private` fields, and every copier that doesn't loses the class: on Node 26, cloning `class Counter { #n = 1; get n() { return this.#n; } }` and reading `n`:
  - lodash `cloneDeep`, es-toolkit `cloneDeep`, Ramda `clone`, fast-copy `copy` / `copyStrict`, and klona's full build keep the prototype, and reading `n` throws `TypeError`;
  - `structuredClone`, remeda `clone`, rfdc, and a JSON round-trip return a plain object, whose `n` is `undefined`;
  - klona calls the constructor again, so `n` is the constructor's `1`, not the copied state.
  - Sharing an instance is the only answer that keeps it working, and it matches what a class instance usually is: an object with behavior, owned by whoever built it.
- No library compared shares a class instance: each copies it, keeping its prototype or flattening it.
- Errors: `structuredClone` and remeda copy an error and its `cause`, as `deepClone` does; es-toolkit copies the error but shares its `cause`; fast-copy, klona, and Ramda share the error; lodash, rfdc, and a JSON round-trip turn it into `{}`.
- Keys: es-toolkit, fast-copy, lodash, and klona's full build copy symbol keys, as `deepClone` does, while `structuredClone`, remeda, Ramda, rfdc, klona, and a JSON round-trip drop them; only fast-copy's strict mode and klona's full build copy non-enumerable keys, which `deepClone` leaves out, as `isDeepEqual` ignores them.
- A `null` prototype is kept by es-toolkit, fast-copy, klona's full build, and Ramda, as `deepClone` keeps it, and dropped by `structuredClone`, lodash, remeda, rfdc, klona, and a JSON round-trip.
- Another realm's `Map` comes back as a working `Map` from `structuredClone`, lodash, remeda, fast-copy, and klona; es-toolkit returns an object that isn't one, rfdc returns `{}`, and Ramda shares it.
- JavaScript can't copy a host object: lodash and rfdc turn a `URL` into `{}`, fast-copy builds a new object on `URL`'s prototype, and `structuredClone` and remeda throw; es-toolkit, klona, and Ramda share it, as `deepClone` does.
- Copying `Map` keys matches `structuredClone`, remeda, rfdc, and klona; lodash, es-toolkit, and fast-copy share them; every library compared copies `Set` members, except Ramda, which returns the same `Map` or `Set` without copying it.
  - A deep clone is expected to copy them (owner's call, 2026-10-29); `mapSetKeys: "share"` serves the caller who looks entries up by the original objects.
- The `isDeepEqual` invariant gives callers one rule for both functions; it holds because every value `deepClone` doesn't copy is shared, and `isDeepEqual` compares the same reference as equal.
- `uncopyable: "structuredClone"` is opt-in because only the native clone can copy platform objects, and it flattens class instances; a caller who wants either takes on those effects knowingly (owner's call, 2026-10-29).
  - It runs the same code everywhere; only the result depends on whether the runtime has `structuredClone`, which the docs state, as the package's principles allow.
  - A customizer callback, like lodash's `cloneDeepWith`, would let a caller copy a type of their own; it can be added later if a caller needs it.
- `unreadable: "omit"` mirrors `safeStructuredClone`'s `uncloneable: "omit"`; the clone runs once inside one `try`, and only when it throws with `"omit"` does it run again, guarding each read.
- Holes are kept, as `structuredClone`, klona's full build, Ramda, rfdc, and fast-copy's strict mode keep them, since [isDeepEqual](is-deep-equal.md) tells a hole from `undefined`; lodash, es-toolkit, remeda, klona, and fast-copy's `copy` fill them with `undefined`.
- Cycles: klona overflows the stack (`RangeError`), and so does rfdc, unless built with `circles: true`, which still overflows on an array that contains itself; a JSON round-trip throws `TypeError`.
- Shared references: klona, rfdc, and a JSON round-trip copy an object reached twice into two separate copies.
- A minimal JavaScript clone ran 1.8× to 3.6× faster than `structuredClone` on Node 26, measured for [safeStructuredClone](safe-structured-clone.md).

## Consequences

- [What the package leaves to native APIs and other libraries](native-first-scope.md) leaves lodash's `cloneDeep` to `structuredClone`, and [safeStructuredClone's record](safe-structured-clone.md) calls `deepClone` a candidate; both need updating once this record is verified, in the catalog wrap-up (#100).
- The docs lead with the difference from `safeStructuredClone`, since the two names alone don't say it.
- A shared value is the original, so mutating a class instance inside a clone mutates it in the source too; the docs say so.
- No tool compared has these options, so every column is `—` for the cases that set one.
