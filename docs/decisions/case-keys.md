---
type: Decision
title: How camelCaseKeys and snakeCaseKeys convert an object's keys
description: "`camelCaseKeys(value, options?)` and `snakeCaseKeys(value, options?)` return a copy whose string keys are converted with `camelCase` and `snakeCase`, at every depth unless `deep` is `false`, leaving any key named in `exclude` as it is; they walk only arrays and plain objects, keep everything else whole, copy symbol keys and an own `__proto__` key as data, keep cycles, let the later of two colliding keys win, and return the input unchanged when anything throws; `CamelCaseKeys<T, Leaf, Excluded>` and `SnakeCaseKeys<T, Leaf, Excluded>` type the default call and `exclude`, built on `CamelCase<S>` and `SnakeCase<S>`, which follow the splitter exactly on ASCII and widen to `string` beyond it."
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-05T04:17:36Z }
verified: { by: human:jjloneman, at: 2026-11-05T04:20:53Z }
---

# How camelCaseKeys and snakeCaseKeys convert an object's keys

`camelCaseKeys(response)` turns an API's `{ "user_id": 1, "home_address": { "zip_code": "02139" } }` into `{ userId: 1, homeAddress: { zipCode: "02139" } }`, and `snakeCaseKeys` turns it back, each key converted by [the case functions](case-conversion.md) and typed by `CamelCaseKeys<T>`.

## Decision

- **Two exports, each on its own subpath:** `camelCaseKeys` and `snakeCaseKeys`, the two directions a JSON API's keys travel.
  - No `pascalCaseKeys`, `kebabCaseKeys`, or `constantCaseKeys`: `kebabcase-keys` has about 14 thousand weekly downloads against `camelcase-keys`' 25 million, and a caller who needs one composes `Object.fromEntries` with the style function.
  - No umbrella `changeKeys(value, { style })`, as [the case functions](case-conversion.md) have no `changeCase`.
- **Each key is converted exactly as the string function converts it:** `camelCaseKeys` calls `camelCase` on every string key, with the same `splitNumbers` and `keepOuterUnderscores` options, so `"XMLHttpRequest"` becomes `"xmlHttpRequest"` and `"_id"` becomes `"id"` unless `keepOuterUnderscores` is `true`.
  - Values are never converted: `{ status: "NOT_FOUND" }` keeps its value.
- **`exclude` leaves named keys as they are:** `camelCaseKeys(doc, { exclude: ["_id", "__typename"] })` keeps exactly those two names, at any depth, and converts every other key.
  - A name matches the input's key exactly, before conversion; an excluded key's value is still walked, so `{ raw_data: { inner_key: 1 } }` with `exclude: ["raw_data"]` becomes `{ raw_data: { innerKey: 1 } }`.
  - Names are strings only, not `RegExp`s: a `RegExp` with the `g` flag keeps its `lastIndex` between tests, so one pattern could match a key and then miss the same key; a caller who needs a pattern builds the list first.
  - No `stopPaths` (camelcase-keys' dotted paths whose value isn't walked): paths are a small language of their own, with keys that hold dots and array indexes to settle.
- **Deep by default:** `deep: false` converts only the outermost keys, sharing every nested value with the input.
- **It walks arrays and plain objects only**, as [What counts as a plain object](is-plain-object.md) defines them, and returns a new copy of each.
  - A `Date`, `Map`, `Set`, class instance, function, boxed primitive, or an object with a prototype of its own is kept whole, the very same object.
  - A null-prototype object stays null-prototype.
  - A primitive, `null`, or `undefined` is returned as it is, at the top or nested.
- **Keys are copied as `deepSortObject` copies them** ([the decision](deep-sort-object.md)):
  - own enumerable string keys are converted and written as own data properties, so a key that becomes `"__proto__"` stays a key rather than setting the copy's prototype;
  - symbol keys are copied unchanged, after the string keys;
  - non-enumerable and inherited keys are left out, as a spread leaves them out;
  - a getter is read once and stored as a value.
- **When two keys convert to one name, the later one wins**, in the input's key order: `{ foo_bar: 1, fooBar: 2 }` and `{ fooBar: 1, foo_bar: 2 }` both become `{ fooBar: 2 }`.
- **Cycles are kept:** a reference back to an ancestor points to that ancestor's copy.
- **If anything throws** (a getter, a proxy trap, a revoked proxy), it returns the input unchanged, failing safe toward preserving data; there is no `fallback` option.
- **The types ship beside the functions:** `CamelCase<S>` and `CamelCaseKeys<T, Leaf, Excluded>` from `safe-fns/camel-case` and `safe-fns/camel-case-keys`, and `SnakeCase<S>` and `SnakeCaseKeys<T, Leaf, Excluded>` from `safe-fns/snake-case` and `safe-fns/snake-case-keys`.

  ```ts
  type CamelCase<S extends string> = …; // CamelCase<"user_id"> is "userId"
  type CamelCaseKeys<T, Leaf = never> = …;
  ```

  - `CamelCase<S>` follows the splitter exactly on printable ASCII, distributes over unions, and is `string` for `string` or for a literal holding any other character, since a template-literal type has no `\p{…}` classes to split it with.
  - `CamelCaseKeys<T, Leaf, Excluded>` maps `T` as the function maps the value: it distributes over unions, keeps `any`, `unknown`, primitives, functions, built-ins, and the caller's `Leaf` types whole, maps arrays and tuples item by item, and keeps `?` and `readonly`, as [PartialDeep](type-helpers.md) does.
  - A key named in `Excluded` keeps its name at any depth, and its value is still mapped.
  - Two keys that collide merge their value types (`1 | 2`), since the type can't see which one comes later; a key outside ASCII becomes an index signature.
  - The other styles' string types (`PascalCase`, `KebabCase`, …) don't ship; nothing in the package returns them.

- **The typed return covers the default call and `exclude`:** `camelCaseKeys(value)` and `camelCaseKeys(value, { deep: true })` return `CamelCaseKeys<T>`, and `camelCaseKeys(value, { exclude: ["_id"] })` returns `CamelCaseKeys<T, never, "_id">`, the names inferred as literals; a call that sets `deep: false`, `splitNumbers`, or `keepOuterUnderscores` returns `unknown`, for the caller to narrow.
- **The case functions' own return type stays `string`:** `camelCase(value)` takes `unknown`, and its fallback is the caller's, so it doesn't return `CamelCase<S>`.

## Comparison

The tiers 0–2 summaries from `research/results/`, generated by `pnpm research`, and the type checks from `research/audits/`, generated by `pnpm research:types`; Rails' `deep_transform_keys` is in the full tables, [camel-case-keys.md](../../research/results/camel-case-keys.md) and [snake-case-keys.md](../../research/results/snake-case-keys.md).

- A cell marks a value the result holds from the input, the very same object, as `Symbol(shared)`, and a reference back to an ancestor as `Symbol(cycle)`, as [deepClone's comparison](deep-clone.md) does.
- A shallow call (`camelcaseKeys(value)`, `camelKeys(value)`, `camelCase(value)` from `change-case/keys`) answers only the cases that set `deep` to `false`.
- Results sort every object's keys, so `{ "fooBar": 2, "foo_bar": 1 }` is the case file's `{ "foo_bar": 1, "fooBar": 2 }`; `‹an object with fooBar then foo_bar›` is the same keys in the other order.
- .NET's column is the JSON text `JsonSerializer` writes with a `DictionaryKeyPolicy`, which renames dictionary keys at every depth; it can't be read back into a dictionary when two keys collide, since it writes both.
- Jackson has no column: its `PropertyNamingStrategies` rename a bean's properties, never a `Map`'s keys, so a probe left every input unchanged; the JVM has no key conversion for untyped data.
- Rails' `deep_transform_keys` is defined on `Hash` only, so an array at the top is `n/a` in its column.
- An `exclude` case is answered by each library's own way to leave keys alone: camelcase-keys' and snakecase-keys' `exclude`, and a humps callback that returns an excluded key as it is.
- string-ts's `DeepCamelKeys` and type-fest's `CamelCasedPropertiesDeep` take no list of excluded keys, so their `Excluded` checks fail to compile.

### camelCaseKeys

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`camelCaseKeys` | camelcase-keys<br>`camelcaseKeys(value, { deep: true })` | camelcase-keys<br>`camelcaseKeys(value, { deep: true, exclude })` | camelcase-keys<br>`camelcaseKeys(value)` | change-case<br>`camelCase(value, Infinity)` | change-case<br>`camelCase(value)` | es-toolkit<br>`toCamelCaseKeys(value)` | humps<br>`camelizeKeys(value, (key, convert) => exclude.includes(key) ? key : convert(key))` | humps<br>`camelizeKeys(value)` | string-ts<br>`camelKeys(value)` | string-ts<br>`deepCamelKeys(value)` | .NET<br>`JsonSerializer.Serialize(value, new JsonSerializerOptions { DictionaryKeyPolicy = JsonNamingPolicy.CamelCase })` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `{ "first_name": "Ada", "user_id": 1 }` | `{ "firstName": "Ada", "userId": 1 }` | `{ "firstName": "Ada", "userId": 1 }` | — | — | `{ "firstName": "Ada", "userId": 1 }` | — | `{ "firstName": "Ada", "userId": 1 }` | — | `{ "firstName": "Ada", "userId": 1 }` | — | `{ "firstName": "Ada", "userId": 1 }` | `"{\"first_name\":\"Ada\",\"user_id\":1}"` |
| `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | — | — | `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | — | `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | — | `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | — | `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | `"{\"home_address\":{\"street_name\":\"Main\",\"zip_code\":\"02139\"}}"` |
| `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | — | — | `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | — | `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | — | `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | — | `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | `"{\"line_items\":[{\"unit_price\":2},{\"unit_price\":3}]}"` |
| `[{ "user_id": 1 }, { "user_id": 2 }]` | `[{ "userId": 1 }, { "userId": 2 }]` | `[{ "userId": 1 }, { "userId": 2 }]` | — | — | `[{ "userId": 1 }, { "userId": 2 }]` | — | `[{ "userId": 1 }, { "userId": 2 }]` | — | `[{ "userId": 1 }, { "userId": 2 }]` | — | `[{ "userId": 1 }, { "userId": 2 }]` | `"[{\"user_id\":1},{\"user_id\":2}]"` |
| `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | `{ "matrixRows": [[{ "cellValue": 1 }]] }` | `{ "matrixRows": [[{ "cellValue": 1 }]] }` | — | — | `{ "matrixRows": [[{ "cellValue": 1 }]] }` | — | `{ "matrixRows": [[{ "cellValue": 1 }]] }` | — | `{ "matrixRows": [[{ "cellValue": 1 }]] }` | — | `{ "matrixRows": [[{ "cellValue": 1 }]] }` | `"{\"matrix_rows\":[[{\"cell_value\":1}]]}"` |
| `{ "status_code": "NOT_FOUND", "tag_list": ["snake_case"] }` | `{ "statusCode": "NOT_FOUND", "tagList": ["snake_case"] }` | `{ "statusCode": "NOT_FOUND", "tagList": ["snake_case"] }` | — | — | `{ "statusCode": "NOT_FOUND", "tagList": ["snake_case"] }` | — | `{ "statusCode": "NOT_FOUND", "tagList": ["snake_case"] }` | — | `{ "statusCode": "NOT_FOUND", "tagList": ["snake_case"] }` | — | `{ "statusCode": "NOT_FOUND", "tagList": ["snake_case"] }` | `"{\"status_code\":\"NOT_FOUND\",\"tag_list\":[\"snake_case\"]}"` |
| `{ "userId": 1 }` | `{ "userId": 1 }` | `{ "userId": 1 }` | — | — | `{ "userId": 1 }` | — | `{ "userId": 1 }` | — | `{ "userId": 1 }` | — | `{ "userId": 1 }` | `"{\"userId\":1}"` |
| `{ "UserEmail": 2, "XMLHttpRequest": 3, "user-name": 1, "user_IDs": 4 }` | `{ "userEmail": 2, "userIDs": 4, "userName": 1, "xmlHttpRequest": 3 }` | `{ "userEmail": 2, "userIDs": 4, "userName": 1, "xmlHttpRequest": 3 }` | — | — | `{ "userEmail": 2, "userIDs": 4, "userName": 1, "xmlHttpRequest": 3 }` | — | `{ "userEmail": 2, "userIDs": 4, "userName": 1, "xmlHttpRequest": 3 }` | — | `{ "userEmail": 2, "userIDs": 4, "userName": 1, "xMLHttpRequest": 3 }` | — | `{ "userEmail": 2, "userIDs": 4, "userName": 1, "xmlHttpRequest": 3 }` | `"{\"user-name\":1,\"user_IDs\":4,\"userEmail\":2,\"xmlHttpRequest\":3}"` |
| `{ "fooBar": 2, "foo_bar": 1 }` | `{ "fooBar": 2 }` | `{ "fooBar": 2 }` | — | — | `{ "fooBar": 2 }` | — | `{ "fooBar": 2 }` | — | `{ "fooBar": 2 }` | — | `{ "fooBar": 2 }` | `"{\"foo_bar\":1,\"fooBar\":2}"` |
| `‹an object with fooBar then foo_bar›` | `{ "fooBar": 2 }` | `{ "fooBar": 2 }` | — | — | `{ "fooBar": 2 }` | — | `{ "fooBar": 2 }` | — | `{ "fooBar": 2 }` | — | `{ "fooBar": 2 }` | — |
| `{ "1": "a", "item_2": "b" }` | `{ "1": "a", "item2": "b" }` | `{ "1": "a", "item2": "b" }` | — | — | `{ "1": "a", "item_2": "b" }` | — | `{ "1": "a", "item2": "b" }` | — | `{ "1": "a", "item2": "b" }` | — | `{ "1": "a", "item2": "b" }` | `"{\"1\":\"a\",\"item_2\":\"b\"}"` |
| `{ "": 1 }` | `{ "": 1 }` | `{ "": 1 }` | — | — | `{ "": 1 }` | — | `{ "": 1 }` | — | `{ "": 1 }` | — | `{ "": 1 }` | `"{\"\":1}"` |
| `{}` | `{}` | `{}` | — | — | `{}` | — | `{}` | — | `{}` | — | `{}` | `"{}"` |
| `[]` | `[]` | `[]` | — | — | `[]` | — | `[]` | — | `[]` | — | `[]` | `"[]"` |
| `{ "__typename": "User", "_id": 1 }` | `{ "id": 1, "typename": "User" }` | `{ "__typename": "User", "_id": 1 }` | — | — | `{ "id": 1, "typename": "User" }` | — | `{ "id": 1, "typename": "User" }` | — | `{ "id": 1, "typename": "User" }` | — | `{ "id": 1, "typename": "User" }` | `"{\"__typename\":\"User\",\"_id\":1}"` |
| `{ "__typename": "User", "_id": 1 }, { "keepOuterUnderscores": true }` | `{ "__typename": "User", "_id": 1 }` | — | — | — | — | — | — | — | — | — | — | — |
| `{ "__typename": "User", "_id": 1, "user_id": 2 }, { "exclude": ["_id", "__typename"] }` | `{ "__typename": "User", "_id": 1, "userId": 2 }` | — | `{ "__typename": "User", "_id": 1, "userId": 2 }` | — | — | — | — | `{ "__typename": "User", "_id": 1, "userId": 2 }` | — | — | — | — |
| `{ "meta_data": { "_id": 1, "inner_key": 2 } }, { "exclude": ["_id"] }` | `{ "metaData": { "_id": 1, "innerKey": 2 } }` | — | `{ "metaData": { "_id": 1, "innerKey": 2 } }` | — | — | — | — | `{ "metaData": { "_id": 1, "innerKey": 2 } }` | — | — | — | — |
| `{ "raw_data": { "inner_key": 1 } }, { "exclude": ["raw_data"] }` | `{ "raw_data": { "innerKey": 1 } }` | — | `{ "raw_data": { "innerKey": 1 } }` | — | — | — | — | `{ "raw_data": { "innerKey": 1 } }` | — | — | — | — |
| `{ "_id": 1, "id": 2 }, { "exclude": ["_id"] }` | `{ "_id": 1, "id": 2 }` | — | `{ "_id": 1, "id": 2 }` | — | — | — | — | `{ "_id": 1, "id": 2 }` | — | — | — | — |
| `{ "_id": 1, "id": 2 }` | `{ "id": 2 }` | `{ "_id": 1, "id": 2 }` | — | — | `{ "id": 2 }` | — | `{ "id": 2 }` | — | `{ "id": 2 }` | — | `{ "id": 2 }` | `"{\"_id\":1,\"id\":2}"` |
| `{ "user_id": 1 }, { "exclude": [] }` | `{ "userId": 1 }` | — | `{ "userId": 1 }` | — | — | — | — | `{ "userId": 1 }` | — | — | — | — |
| `{ "home_address": { "zip_code": "02139" } }, { "deep": false }` | `{ "homeAddress": ‹Symbol(shared)› }` | — | — | `{ "homeAddress": ‹Symbol(shared)› }` | — | `{ "homeAddress": ‹Symbol(shared)› }` | — | — | — | `{ "homeAddress": ‹Symbol(shared)› }` | — | — |
| `{ "home_address": { "zip_code": "02139" } }, { "deep": true }` | `{ "homeAddress": { "zipCode": "02139" } }` | `{ "homeAddress": { "zipCode": "02139" } }` | — | — | `{ "homeAddress": { "zipCode": "02139" } }` | — | `{ "homeAddress": { "zipCode": "02139" } }` | — | `{ "homeAddress": { "zipCode": "02139" } }` | — | `{ "homeAddress": { "zipCode": "02139" } }` | `"{\"home_address\":{\"zip_code\":\"02139\"}}"` |
| `{ "created_at": ‹a Date› }` | `{ "createdAt": ‹Symbol(shared)› }` | `{ "createdAt": ‹Symbol(shared)› }` | — | — | `{ "createdAt": ‹[object Object]› }` | — | `{ "createdAt": ‹Symbol(shared)› }` | — | `{ "createdAt": ‹Symbol(shared)› }` | — | `{ "createdAt": ‹Symbol(shared)› }` | — |
| `{ "by_id": ‹a Map with an entry› }` | `{ "byId": ‹Symbol(shared)› }` | `{ "byId": ‹Symbol(shared)› }` | — | — | `{ "byId": ‹[object Map]› }` | — | `{ "byId": ‹Symbol(shared)› }` | — | `{ "byId": {} }` | — | `{ "byId": ‹Symbol(shared)› }` | — |
| `{ "on_change": ‹a function› }` | `{ "onChange": ‹Symbol(shared)› }` | `{ "onChange": ‹Symbol(shared)› }` | — | — | `{ "onChange": ‹Symbol(shared)› }` | — | `{ "onChange": ‹Symbol(shared)› }` | — | `{ "onChange": ‹Symbol(shared)› }` | — | `{ "onChange": ‹Symbol(shared)› }` | — |
| `‹a class instance with mixed-case fields›` | `‹Symbol(shared)›` | `{ "userId": 1, "userName": 2 }` | — | — | `‹[object Object]›` | — | `‹Symbol(shared)›` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — |
| `{ "the_account": ‹a class instance with mixed-case fields› }` | `{ "theAccount": ‹Symbol(shared)› }` | `{ "theAccount": { "userId": 1, "userName": 2 } }` | — | — | `{ "theAccount": ‹[object Object]› }` | — | `{ "theAccount": ‹Symbol(shared)› }` | — | `{ "theAccount": { "userId": 1, "userName": 2 } }` | — | `{ "theAccount": { "userId": 1, "userName": 2 } }` | — |
| `‹a null-prototype mixed-key object›` | `{ "null-prototype": { "userId": 1, "userName": 2 } }` | `{ "userId": 1, "userName": 2 }` | — | — | `{ "null-prototype": { "userId": 1, "userName": 2 } }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — |
| `‹a mixed-key object with a cycle›` | `{ "otherKey": 1, "selfRef": ‹Symbol(cycle)› }` | `{ "otherKey": 1, "selfRef": ‹Symbol(cycle)› }` | — | — | 💥 `RangeError` | — | 💥 `RangeError` | — | 💥 `RangeError` | — | 💥 `RangeError` | — |
| `‹a mixed-key object with a symbol key›` | `{ "[Symbol(key)]": 3, "userId": 1, "userName": 2 }` | `{ "[Symbol(key)]": 3, "userId": 1, "userName": 2 }` | — | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — |
| `‹a mixed-key object with a non-enumerable key›` | `{ "userId": 1, "userName": 2 }` | `{ "userId": 1, "userName": 2 }` | — | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — |
| `‹a mixed-key object with an inherited key›` | `‹Symbol(shared)›` | `{ "userId": 3, "userName": 4 }` | — | — | `‹[object Object]›` | — | `‹Symbol(shared)›` | — | `{ "userId": 3, "userName": 4 }` | — | `{ "inheritedKey": 1, "inheritedName": 2, "userId": 3, "userName": 4 }` | — |
| `‹a mixed-key object with getters›` | `{ "userId": 1, "userName": 2 }` | `{ "userId": 1, "userName": 2 }` | — | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — | `{ "userId": 1, "userName": 2 }` | — |
| `‹a mixed-key object with an own __proto__ key›` | `{ "proto": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | `{ "__proto": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | — | — | `{ "proto": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | — | `{ "proto": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | — | `{ "proto": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | — | `{ "proto": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | — |
| `‹a mixed-key object with an own __proto__ key›, { "keepOuterUnderscores": true }` | `{ "__proto__": { "innerKey": 1, "innerName": 2 }, "userId": 3 }` | — | — | — | — | — | — | — | — | — | — | — |
| `‹a proxy of a plain object›` | `{ "a": 1 }` | `{ "a": 1 }` | — | — | `{ "a": 1 }` | — | `{ "a": 1 }` | — | `{ "a": 1 }` | — | `{ "a": 1 }` | — |
| `‹an object with a throwing getter›` | `‹Symbol(shared)›` | 💥 `Error` | — | — | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — |
| `{ "outer_key": ‹an object with a throwing getter› }` | `‹Symbol(shared)›` | 💥 `Error` | — | — | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — |
| `‹a revoked proxy›` | `‹Symbol(shared)›` | 💥 `TypeError` | — | — | 💥 `TypeError` | — | 💥 `TypeError` | — | 💥 `TypeError` | — | 💥 `TypeError` | — |
| `‹a proxy whose ownKeys trap throws›` | `‹Symbol(shared)›` | 💥 `Error` | — | — | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — |
| `"user_id"` | `"user_id"` | `"user_id"` | — | — | `"user_id"` | — | `"user_id"` | — | `"user_id"` | — | `"user_id"` | — |
| `42` | `42` | `42` | — | — | `42` | — | `42` | — | `42` | — | `42` | — |
| `null` | `null` | `null` | — | — | `null` | — | `null` | — | `null` | — | `null` | — |
| `undefined` | `undefined` | `undefined` | — | — | `undefined` | — | `undefined` | — | `undefined` | — | `undefined` | — |
<!-- prettier-ignore-end -->

### snakeCaseKeys

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`snakeCaseKeys` | change-case<br>`snakeCase(value, Infinity)` | change-case<br>`snakeCase(value)` | es-toolkit<br>`toSnakeCaseKeys(value)` | humps<br>`decamelizeKeys(value, (key, convert) => exclude.includes(key) ? key : convert(key))` | humps<br>`decamelizeKeys(value)` | snakecase-keys<br>`snakecaseKeys(value, { deep: false })` | snakecase-keys<br>`snakecaseKeys(value, { exclude })` | snakecase-keys<br>`snakecaseKeys(value)` | string-ts<br>`deepSnakeKeys(value)` | string-ts<br>`snakeKeys(value)` | .NET<br>`JsonSerializer.Serialize(value, new JsonSerializerOptions { DictionaryKeyPolicy = JsonNamingPolicy.SnakeCaseLower })` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `{ "firstName": "Ada", "userId": 1 }` | `{ "first_name": "Ada", "user_id": 1 }` | `{ "first_name": "Ada", "user_id": 1 }` | — | `{ "first_name": "Ada", "user_id": 1 }` | — | `{ "first_name": "Ada", "user_id": 1 }` | — | — | `{ "first_name": "Ada", "user_id": 1 }` | `{ "first_name": "Ada", "user_id": 1 }` | — | `"{\"first_name\":\"Ada\",\"user_id\":1}"` |
| `{ "homeAddress": { "streetName": "Main", "zipCode": "02139" } }` | `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | — | `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | — | `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | — | — | `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | `{ "home_address": { "street_name": "Main", "zip_code": "02139" } }` | — | `"{\"home_address\":{\"street_name\":\"Main\",\"zip_code\":\"02139\"}}"` |
| `{ "lineItems": [{ "unitPrice": 2 }, { "unitPrice": 3 }] }` | `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | — | `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | — | `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | — | — | `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | `{ "line_items": [{ "unit_price": 2 }, { "unit_price": 3 }] }` | — | `"{\"line_items\":[{\"unit_price\":2},{\"unit_price\":3}]}"` |
| `[{ "userId": 1 }, { "userId": 2 }]` | `[{ "user_id": 1 }, { "user_id": 2 }]` | `[{ "user_id": 1 }, { "user_id": 2 }]` | — | `[{ "user_id": 1 }, { "user_id": 2 }]` | — | `[{ "user_id": 1 }, { "user_id": 2 }]` | — | — | `[{ "user_id": 1 }, { "user_id": 2 }]` | `[{ "user_id": 1 }, { "user_id": 2 }]` | — | `"[{\"user_id\":1},{\"user_id\":2}]"` |
| `{ "matrixRows": [[{ "cellValue": 1 }]] }` | `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | — | `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | — | `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | — | — | `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | `{ "matrix_rows": [[{ "cell_value": 1 }]] }` | — | `"{\"matrix_rows\":[[{\"cell_value\":1}]]}"` |
| `{ "statusCode": "notFound", "tagList": ["camelCase"] }` | `{ "status_code": "notFound", "tag_list": ["camelCase"] }` | `{ "status_code": "notFound", "tag_list": ["camelCase"] }` | — | `{ "status_code": "notFound", "tag_list": ["camelCase"] }` | — | `{ "status_code": "notFound", "tag_list": ["camelCase"] }` | — | — | `{ "status_code": "notFound", "tag_list": ["camelCase"] }` | `{ "status_code": "notFound", "tag_list": ["camelCase"] }` | — | `"{\"status_code\":\"notFound\",\"tag_list\":[\"camelCase\"]}"` |
| `{ "user_id": 1 }` | `{ "user_id": 1 }` | `{ "user_id": 1 }` | — | `{ "user_id": 1 }` | — | `{ "user_id": 1 }` | — | — | `{ "user_id": 1 }` | `{ "user_id": 1 }` | — | `"{\"user_id\":1}"` |
| `{ "UserEmail": 2, "XMLHttpRequest": 3, "user-name": 1, "userIDs": 4 }` | `{ "user_email": 2, "user_i_ds": 4, "user_name": 1, "xml_http_request": 3 }` | `{ "user_email": 2, "user_i_ds": 4, "user_name": 1, "xml_http_request": 3 }` | — | `{ "user_email": 2, "user_i_ds": 4, "user_name": 1, "xml_http_request": 3 }` | — | `{ "user-name": 1, "user_email": 2, "user_i_ds": 4, "x_m_l_http_request": 3 }` | — | — | `{ "user_email": 2, "user_i_ds": 4, "user_name": 1, "xml_http_request": 3 }` | `{ "user_email": 2, "user_i_ds": 4, "user_name": 1, "xml_http_request": 3 }` | — | `"{\"user-name\":1,\"user_email\":2,\"user_i_ds\":4,\"xml_http_request\":3}"` |
| `{ "fooBar": 2, "foo_bar": 1 }` | `{ "foo_bar": 2 }` | `{ "foo_bar": 2 }` | — | `{ "foo_bar": 2 }` | — | `{ "foo_bar": 2 }` | — | — | `{ "foo_bar": 2 }` | `{ "foo_bar": 2 }` | — | `"{\"foo_bar\":1,\"foo_bar\":2}"` |
| `‹an object with fooBar then foo_bar›` | `{ "foo_bar": 2 }` | `{ "foo_bar": 2 }` | — | `{ "foo_bar": 2 }` | — | `{ "foo_bar": 2 }` | — | — | `{ "foo_bar": 2 }` | `{ "foo_bar": 2 }` | — | — |
| `{ "1": "a", "item2": "b" }` | `{ "1": "a", "item2": "b" }` | `{ "1": "a", "item2": "b" }` | — | `{ "1": "a", "item_2": "b" }` | — | `{ "1": "a", "item2": "b" }` | — | — | `{ "1": "a", "item2": "b" }` | `{ "1": "a", "item_2": "b" }` | — | `"{\"1\":\"a\",\"item2\":\"b\"}"` |
| `{ "base64Value": 1 }` | `{ "base64_value": 1 }` | `{ "base64_value": 1 }` | — | `{ "base_64_value": 1 }` | — | `{ "base64_value": 1 }` | — | — | `{ "base64_value": 1 }` | `{ "base_64_value": 1 }` | — | `"{\"base64_value\":1}"` |
| `{ "base64Value": 1 }, { "splitNumbers": true }` | `{ "base_64_value": 1 }` | — | — | `{ "base_64_value": 1 }` | — | — | — | — | — | `{ "base_64_value": 1 }` | — | — |
| `{ "": 1 }` | `{ "": 1 }` | `{ "": 1 }` | — | `{ "": 1 }` | — | `{ "": 1 }` | — | — | `{ "": 1 }` | `{ "": 1 }` | — | `"{\"\":1}"` |
| `{}` | `{}` | `{}` | — | `{}` | — | `{}` | — | — | `{}` | `{}` | — | `"{}"` |
| `[]` | `[]` | `[]` | — | `[]` | — | `[]` | — | — | `[]` | `[]` | — | `"[]"` |
| `{ "__typename": "User", "_id": 1 }` | `{ "id": 1, "typename": "User" }` | `{ "id": 1, "typename": "User" }` | — | `{ "id": 1, "typename": "User" }` | — | `{ "__typename": "User", "_id": 1 }` | — | — | `{ "id": 1, "typename": "User" }` | `{ "id": 1, "typename": "User" }` | — | `"{\"__typename\":\"User\",\"_id\":1}"` |
| `{ "__typename": "User", "_id": 1 }, { "keepOuterUnderscores": true }` | `{ "__typename": "User", "_id": 1 }` | — | — | — | — | `{ "__typename": "User", "_id": 1 }` | — | — | — | — | — | — |
| `{ "__typename": "User", "_id": 1, "userId": 2 }, { "exclude": ["_id", "__typename"] }` | `{ "__typename": "User", "_id": 1, "user_id": 2 }` | — | — | — | `{ "__typename": "User", "_id": 1, "user_id": 2 }` | — | — | `{ "__typename": "User", "_id": 1, "user_id": 2 }` | — | — | — | — |
| `{ "metaData": { "_id": 1, "innerKey": 2 } }, { "exclude": ["_id"] }` | `{ "meta_data": { "_id": 1, "inner_key": 2 } }` | — | — | — | `{ "meta_data": { "_id": 1, "inner_key": 2 } }` | — | — | `{ "meta_data": { "_id": 1, "inner_key": 2 } }` | — | — | — | — |
| `{ "rawData": { "innerKey": 1 } }, { "exclude": ["rawData"] }` | `{ "rawData": { "inner_key": 1 } }` | — | — | — | `{ "rawData": { "inner_key": 1 } }` | — | — | `{ "rawData": { "inner_key": 1 } }` | — | — | — | — |
| `{ "_id": 1, "id": 2 }, { "exclude": ["_id"] }` | `{ "_id": 1, "id": 2 }` | — | — | — | `{ "_id": 1, "id": 2 }` | — | — | `{ "_id": 1, "id": 2 }` | — | — | — | — |
| `{ "_id": 1, "id": 2 }` | `{ "id": 2 }` | `{ "id": 2 }` | — | `{ "id": 2 }` | — | `{ "_id": 1, "id": 2 }` | — | — | `{ "id": 2 }` | `{ "id": 2 }` | — | `"{\"_id\":1,\"id\":2}"` |
| `{ "userId": 1 }, { "exclude": [] }` | `{ "user_id": 1 }` | — | — | — | `{ "user_id": 1 }` | — | — | `{ "user_id": 1 }` | — | — | — | — |
| `{ "homeAddress": { "zipCode": "02139" } }, { "deep": false }` | `{ "home_address": ‹Symbol(shared)› }` | — | `{ "home_address": ‹Symbol(shared)› }` | — | — | — | `{ "home_address": ‹Symbol(shared)› }` | — | — | — | `{ "home_address": ‹Symbol(shared)› }` | — |
| `{ "homeAddress": { "zipCode": "02139" } }, { "deep": true }` | `{ "home_address": { "zip_code": "02139" } }` | `{ "home_address": { "zip_code": "02139" } }` | — | `{ "home_address": { "zip_code": "02139" } }` | — | `{ "home_address": { "zip_code": "02139" } }` | — | — | `{ "home_address": { "zip_code": "02139" } }` | `{ "home_address": { "zip_code": "02139" } }` | — | `"{\"home_address\":{\"zip_code\":\"02139\"}}"` |
| `{ "createdAt": ‹a Date› }` | `{ "created_at": ‹Symbol(shared)› }` | `{ "created_at": ‹[object Object]› }` | — | `{ "created_at": ‹Symbol(shared)› }` | — | `{ "created_at": ‹Symbol(shared)› }` | — | — | `{ "created_at": ‹Symbol(shared)› }` | `{ "created_at": ‹Symbol(shared)› }` | — | — |
| `{ "byId": ‹a Map with an entry› }` | `{ "by_id": ‹Symbol(shared)› }` | `{ "by_id": ‹[object Map]› }` | — | `{ "by_id": ‹Symbol(shared)› }` | — | `{ "by_id": {} }` | — | — | `{ "by_id": {} }` | `{ "by_id": ‹Symbol(shared)› }` | — | — |
| `{ "onChange": ‹a function› }` | `{ "on_change": ‹Symbol(shared)› }` | `{ "on_change": ‹Symbol(shared)› }` | — | `{ "on_change": ‹Symbol(shared)› }` | — | `{ "on_change": ‹Symbol(shared)› }` | — | — | `{ "on_change": ‹Symbol(shared)› }` | `{ "on_change": ‹Symbol(shared)› }` | — | — |
| `‹a class instance with mixed-case fields›` | `‹Symbol(shared)›` | `‹[object Object]›` | — | `‹Symbol(shared)›` | — | `{ "user_id": 1, "user_name": 2 }` | — | — | 💥 `Error` | `{ "user_id": 1, "user_name": 2 }` | — | — |
| `{ "theAccount": ‹a class instance with mixed-case fields› }` | `{ "the_account": ‹Symbol(shared)› }` | `{ "the_account": ‹[object Object]› }` | — | `{ "the_account": ‹Symbol(shared)› }` | — | `{ "the_account": { "user_id": 1, "user_name": 2 } }` | — | — | `{ "the_account": { "user_id": 1, "user_name": 2 } }` | `{ "the_account": { "user_id": 1, "user_name": 2 } }` | — | — |
| `‹a null-prototype mixed-key object›` | `{ "null-prototype": { "user_id": 1, "user_name": 2 } }` | `{ "null-prototype": { "user_id": 1, "user_name": 2 } }` | — | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | — | 💥 `Error` | `{ "user_id": 1, "user_name": 2 }` | — | — |
| `‹a mixed-key object with a cycle›` | `{ "other_key": 1, "self_ref": ‹Symbol(cycle)› }` | 💥 `RangeError` | — | 💥 `RangeError` | — | 💥 `RangeError` | — | — | `{ "other_key": 1, "self_ref": ‹Symbol(cycle)› }` | 💥 `RangeError` | — | — |
| `‹a mixed-key object with a symbol key›` | `{ "[Symbol(key)]": 3, "user_id": 1, "user_name": 2 }` | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | — | `{ "user_id": 1, "user_name": 2 }` | `{ "user_id": 1, "user_name": 2 }` | — | — |
| `‹a mixed-key object with a non-enumerable key›` | `{ "user_id": 1, "user_name": 2 }` | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | — | `{ "user_id": 1, "user_name": 2 }` | `{ "user_id": 1, "user_name": 2 }` | — | — |
| `‹a mixed-key object with an inherited key›` | `‹Symbol(shared)›` | `‹[object Object]›` | — | `‹Symbol(shared)›` | — | `{ "user_id": 3, "user_name": 4 }` | — | — | `{ "user_id": 3, "user_name": 4 }` | `{ "inherited_key": 1, "inherited_name": 2, "user_id": 3, "user_name": 4 }` | — | — |
| `‹a mixed-key object with getters›` | `{ "user_id": 1, "user_name": 2 }` | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | `{ "user_id": 1, "user_name": 2 }` | — | — | `{ "user_id": 1, "user_name": 2 }` | `{ "user_id": 1, "user_name": 2 }` | — | — |
| `‹a mixed-key object with an own __proto__ key›` | `{ "proto": { "inner_key": 1, "inner_name": 2 }, "user_id": 3 }` | `{ "proto": { "inner_key": 1, "inner_name": 2 }, "user_id": 3 }` | — | `{ "proto": { "inner_key": 1, "inner_name": 2 }, "user_id": 3 }` | — | `‹[object Object]›` | — | — | `{ "proto": { "inner_key": 1, "inner_name": 2 }, "user_id": 3 }` | `{ "proto": { "inner_key": 1, "inner_name": 2 }, "user_id": 3 }` | — | — |
| `‹a mixed-key object with an own __proto__ key›, { "keepOuterUnderscores": true }` | `{ "__proto__": { "inner_key": 1, "inner_name": 2 }, "user_id": 3 }` | — | — | — | — | `‹[object Object]›` | — | — | — | — | — | — |
| `‹a proxy of a plain object›` | `{ "a": 1 }` | `{ "a": 1 }` | — | `{ "a": 1 }` | — | `{ "a": 1 }` | — | — | `{ "a": 1 }` | `{ "a": 1 }` | — | — |
| `‹an object with a throwing getter›` | `‹Symbol(shared)›` | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — | — | 💥 `Error` | 💥 `Error` | — | — |
| `{ "outerKey": ‹an object with a throwing getter› }` | `‹Symbol(shared)›` | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — | — | 💥 `Error` | 💥 `Error` | — | — |
| `‹a revoked proxy›` | `‹Symbol(shared)›` | 💥 `TypeError` | — | 💥 `TypeError` | — | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | — | — |
| `‹a proxy whose ownKeys trap throws›` | `‹Symbol(shared)›` | 💥 `Error` | — | 💥 `Error` | — | 💥 `Error` | — | — | 💥 `Error` | 💥 `Error` | — | — |
| `"userId"` | `"userId"` | `"userId"` | — | `"userId"` | — | `"userId"` | — | — | 💥 `Error` | `"userId"` | — | — |
| `42` | `42` | `42` | — | `42` | — | `42` | — | — | 💥 `Error` | `42` | — | — |
| `null` | `null` | `null` | — | `null` | — | `null` | — | — | 💥 `TypeError` | `null` | — | — |
| `undefined` | `undefined` | `undefined` | — | `undefined` | — | `undefined` | — | — | 💥 `TypeError` | `undefined` | — | — |
<!-- prettier-ignore-end -->

### CamelCase

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`CamelCase` | scule<br>`CamelCase` | string-ts<br>`CamelCase` | type-fest<br>`CamelCase` |
| :--- | :--- | :--- | :--- | :--- |
| `"fooBarBaz"` is `"fooBarBaz"`<br>`Equal<H<"fooBarBaz">, "fooBarBaz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"FooBarBaz"` is `"fooBarBaz"`<br>`Equal<H<"FooBarBaz">, "fooBarBaz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"foo_bar_baz"` is `"fooBarBaz"`<br>`Equal<H<"foo_bar_baz">, "fooBarBaz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"foo-bar-baz"` is `"fooBarBaz"`<br>`Equal<H<"foo-bar-baz">, "fooBarBaz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"foo bar baz"` is `"fooBarBaz"`<br>`Equal<H<"foo bar baz">, "fooBarBaz">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"FOO_BAR_BAZ"` is `"fooBarBaz"`<br>`Equal<H<"FOO_BAR_BAZ">, "fooBarBaz">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"Foo Bar Baz"` is `"fooBarBaz"`<br>`Equal<H<"Foo Bar Baz">, "fooBarBaz">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"foo.bar/baz"` is `"fooBarBaz"`<br>`Equal<H<"foo.bar/baz">, "fooBarBaz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"XMLHttpRequest"` is `"xmlHttpRequest"`<br>`Equal<H<"XMLHttpRequest">, "xmlHttpRequest">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"IOError"` is `"ioError"`<br>`Equal<H<"IOError">, "ioError">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"userID"` is `"userId"`<br>`Equal<H<"userID">, "userId">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"iPhone"` is `"iPhone"`<br>`Equal<H<"iPhone">, "iPhone">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"ABC"` is `"abc"`<br>`Equal<H<"ABC">, "abc">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"version2Beta"` is `"version2Beta"`<br>`Equal<H<"version2Beta">, "version2Beta">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"base64Encode"` is `"base64Encode"`<br>`Equal<H<"base64Encode">, "base64Encode">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"HTML5Parser"` is `"html5Parser"`<br>`Equal<H<"HTML5Parser">, "html5Parser">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"ABC123Def"` is `"abc123Def"`<br>`Equal<H<"ABC123Def">, "abc123Def">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"v1.2.3"` is `"v123"`<br>`Equal<H<"v1.2.3">, "v123">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"don't stop"` is `"dontStop"`<br>`Equal<H<"don't stop">, "dontStop">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"the lord of the rings"` is `"theLordOfTheRings"`<br>`Equal<H<"the lord of the rings">, "theLordOfTheRings">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"foo__bar"` is `"fooBar"`<br>`Equal<H<"foo__bar">, "fooBar">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"_private"` is `"private"`<br>`Equal<H<"_private">, "private">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"  padded  "` is `"padded"`<br>`Equal<H<"  padded  ">, "padded">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"c++ code"` is `"c++Code"`<br>`Equal<H<"c++ code">, "c++Code">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"a+b"` is `"a+B"`<br>`Equal<H<"a+b">, "a+B">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"price$"` is `"price$"`<br>`Equal<H<"price$">, "price$">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"20°C"`, outside ASCII, widens to `string`<br>`Equal<H<"20\u00b0C">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"userIDs"` is `"userIDs"`<br>`Equal<H<"userIDs">, "userIDs">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"iOSApp"` is `"iOsApp"`<br>`Equal<H<"iOSApp">, "iOsApp">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"version2beta"` is `"version2beta"`<br>`Equal<H<"version2beta">, "version2beta">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"2fast4you"` is `"2fast4you"`<br>`Equal<H<"2fast4you">, "2fast4you">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"ÉcoleNormale"`, outside ASCII, widens to `string`<br>`Equal<H<"\u00c9coleNormale">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"écoleNormale"`, outside ASCII, widens to `string`<br>`Equal<H<"e\u0301coleNormale">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"straße"`, outside ASCII, widens to `string`<br>`Equal<H<"stra\u00dfe">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"İstanbul"`, outside ASCII, widens to `string`<br>`Equal<H<"\u0130stanbul">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"ǅemal"`, outside ASCII, widens to `string`<br>`Equal<H<"\u01c5emal">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"日本語Text"`, outside ASCII, widens to `string`<br>`Equal<H<"\u65e5\u672c\u8a9eText">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"emoji😀Face"`, outside ASCII, widens to `string`<br>`Equal<H<"emoji\ud83d\ude00Face">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"👩‍💻dev"`, outside ASCII, widens to `string`<br>`Equal<H<"\ud83d\udc69\u200d\ud83d\udcbbdev">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"a"` is `"a"`<br>`Equal<H<"a">, "a">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `""` is `""`<br>`Equal<H<"">, "">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `string` stays `string`<br>`Equal<H<string>, string>` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| a union converts each member<br>`Equal<H<"user_id" \| "first_name">, "userId" \| "firstName">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| a 60-word key (239 characters)<br>`Equal<H<"key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">, "keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2589` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5); `TS2344`, `TS2589` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) |
| a 240-word key (959 characters)<br>`Equal<H<"key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">, "keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2589` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5); `TS2344`, `TS2589` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) |
<!-- prettier-ignore-end -->

### SnakeCase

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`SnakeCase` | scule<br>`SnakeCase` | string-ts<br>`SnakeCase` | type-fest<br>`SnakeCase` |
| :--- | :--- | :--- | :--- | :--- |
| `"fooBarBaz"` is `"foo_bar_baz"`<br>`Equal<H<"fooBarBaz">, "foo_bar_baz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"FooBarBaz"` is `"foo_bar_baz"`<br>`Equal<H<"FooBarBaz">, "foo_bar_baz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"foo_bar_baz"` is `"foo_bar_baz"`<br>`Equal<H<"foo_bar_baz">, "foo_bar_baz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `"foo-bar-baz"` is `"foo_bar_baz"`<br>`Equal<H<"foo-bar-baz">, "foo_bar_baz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"foo bar baz"` is `"foo_bar_baz"`<br>`Equal<H<"foo bar baz">, "foo_bar_baz">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"FOO_BAR_BAZ"` is `"foo_bar_baz"`<br>`Equal<H<"FOO_BAR_BAZ">, "foo_bar_baz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"Foo Bar Baz"` is `"foo_bar_baz"`<br>`Equal<H<"Foo Bar Baz">, "foo_bar_baz">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"foo.bar/baz"` is `"foo_bar_baz"`<br>`Equal<H<"foo.bar/baz">, "foo_bar_baz">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"XMLHttpRequest"` is `"xml_http_request"`<br>`Equal<H<"XMLHttpRequest">, "xml_http_request">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"IOError"` is `"io_error"`<br>`Equal<H<"IOError">, "io_error">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"userID"` is `"user_id"`<br>`Equal<H<"userID">, "user_id">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"iPhone"` is `"i_phone"`<br>`Equal<H<"iPhone">, "i_phone">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"ABC"` is `"abc"`<br>`Equal<H<"ABC">, "abc">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"version2Beta"` is `"version2_beta"`<br>`Equal<H<"version2Beta">, "version2_beta">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"base64Encode"` is `"base64_encode"`<br>`Equal<H<"base64Encode">, "base64_encode">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"HTML5Parser"` is `"html5_parser"`<br>`Equal<H<"HTML5Parser">, "html5_parser">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"ABC123Def"` is `"abc123_def"`<br>`Equal<H<"ABC123Def">, "abc123_def">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"v1.2.3"` is `"v1_2_3"`<br>`Equal<H<"v1.2.3">, "v1_2_3">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"don't stop"` is `"dont_stop"`<br>`Equal<H<"don't stop">, "dont_stop">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"the lord of the rings"` is `"the_lord_of_the_rings"`<br>`Equal<H<"the lord of the rings">, "the_lord_of_the_rings">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"foo__bar"` is `"foo_bar"`<br>`Equal<H<"foo__bar">, "foo_bar">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"_private"` is `"private"`<br>`Equal<H<"_private">, "private">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"  padded  "` is `"padded"`<br>`Equal<H<"  padded  ">, "padded">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"c++ code"` is `"c_++_code"`<br>`Equal<H<"c++ code">, "c_++_code">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"a+b"` is `"a_+_b"`<br>`Equal<H<"a+b">, "a_+_b">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"price$"` is `"price_$"`<br>`Equal<H<"price$">, "price_$">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` |
| `"20°C"`, outside ASCII, widens to `string`<br>`Equal<H<"20\u00b0C">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"userIDs"` is `"user_i_ds"`<br>`Equal<H<"userIDs">, "user_i_ds">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"iOSApp"` is `"i_os_app"`<br>`Equal<H<"iOSApp">, "i_os_app">` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| `"version2beta"` is `"version2beta"`<br>`Equal<H<"version2beta">, "version2beta">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| `"2fast4you"` is `"2fast4you"`<br>`Equal<H<"2fast4you">, "2fast4you">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| `"ÉcoleNormale"`, outside ASCII, widens to `string`<br>`Equal<H<"\u00c9coleNormale">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"écoleNormale"`, outside ASCII, widens to `string`<br>`Equal<H<"e\u0301coleNormale">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"straße"`, outside ASCII, widens to `string`<br>`Equal<H<"stra\u00dfe">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"İstanbul"`, outside ASCII, widens to `string`<br>`Equal<H<"\u0130stanbul">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"ǅemal"`, outside ASCII, widens to `string`<br>`Equal<H<"\u01c5emal">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"日本語Text"`, outside ASCII, widens to `string`<br>`Equal<H<"\u65e5\u672c\u8a9eText">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"emoji😀Face"`, outside ASCII, widens to `string`<br>`Equal<H<"emoji\ud83d\ude00Face">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"👩‍💻dev"`, outside ASCII, widens to `string`<br>`Equal<H<"\ud83d\udc69\u200d\ud83d\udcbbdev">, string>` | ✅ | ❌ `TS2344` | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| `"a"` is `"a"`<br>`Equal<H<"a">, "a">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `""` is `""`<br>`Equal<H<"">, "">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| `string` stays `string`<br>`Equal<H<string>, string>` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| a union converts each member<br>`Equal<H<"userId" \| "firstName">, "user_id" \| "first_name">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| a 60-word key (180 characters)<br>`Equal<H<"keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">, "key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2589` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4); `TS2344`, `TS2589` (5.4.5, 5.9.3, 6.0.3, 7.0.2) |
| a 240-word key (720 characters)<br>`Equal<H<"keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">, "key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">` | ✅ | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2589` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4); `TS2344`, `TS2589` (5.4.5, 5.9.3, 6.0.3, 7.0.2) |
<!-- prettier-ignore-end -->

### CamelCaseKeys

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`CamelCaseKeys` | string-ts<br>`DeepCamelKeys` | type-fest<br>`CamelCasedPropertiesDeep` |
| :--- | :--- | :--- | :--- |
| top-level keys convert<br>`Equal<H<{ first_name: string; user_id: number }>, { firstName: string; userId: number }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| nested keys convert<br>`Equal<H<{ home_address: { zip_code: string } }>, { homeAddress: { zipCode: string } }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| keys inside an array of objects convert<br>`Equal<H<{ line_items: { unit_price: number }[] }>, { lineItems: { unitPrice: number }[] }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| a tuple keeps its length and `readonly`<br>`Equal<H<readonly [{ user_id: number }]>, readonly [{ userId: number }]>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| `?` and `readonly` are kept<br>`Equal<H<{ readonly user_id?: number }>, { readonly userId?: number }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| a union with `null` distributes<br>`Equal<H<{ address: Address \| null }>, { address: { city: string; zip: string } \| null }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| a `Date` and a function stay whole<br>`Equal<H<{ created_at: Date; on_change: () => void }>, { createdAt: Date; onChange: () => void }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| a `Map` stays whole<br>`Equal<H<{ by_id: Map<string, { user_id: number }> }>, { byId: Map<string, { user_id: number }> }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5, 5.0.4) |
| an index signature keeps its values converted<br>`Equal<H<Record<string, { user_id: number }>>, Record<string, { userId: number }>>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| a numeric key stays<br>`Equal<H<{ 1: string; item_2: string }>, { 1: string; item2: string }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
| outer underscores are dropped<br>`Equal<H<{ _id: number; __typename: string }>, { id: number; typename: string }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5) |
| two keys that collide merge their values<br>`Equal<H<{ fooBar: 2; foo_bar: 1 }>["fooBar"], 1 \| 2>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5) | ❌ `TS2344` (4.9.5, 5.0.4) |
| a key outside ASCII becomes an index signature<br>`Equal<H<{ "\u00e9cole_name": 1 }>, { [key: string]: 1 }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` |
| an excluded key keeps its name<br>`Equal<H<{ __typename: string; _id: number; user_id: number }, never, "_id" \| "__typename">, { __typename: string; _id: number; userId: number }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2314` (5.0.4); `TS2314` (5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5); `TS2344`, `TS2707` (5.0.4); `TS2707` (5.4.5, 5.9.3, 6.0.3, 7.0.2) |
| a key is excluded at any depth<br>`Equal<H<{ meta_data: { _id: number; inner_key: number } }, never, "_id">, { metaData: { _id: number; innerKey: number } }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2314` (5.0.4); `TS2314` (5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5); `TS2344`, `TS2707` (5.0.4); `TS2707` (5.4.5, 5.9.3, 6.0.3, 7.0.2) |
| an excluded key's value is still converted<br>`Equal<H<{ raw_data: { inner_key: number } }, never, "raw_data">, { raw_data: { innerKey: number } }>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344`, `TS2314` (5.0.4); `TS2314` (5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5); `TS2344`, `TS2707` (5.0.4); `TS2707` (5.4.5, 5.9.3, 6.0.3, 7.0.2) |
| `any` stays `any`<br>`Equal<H<any>, any>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ✅ |
| `unknown` stays `unknown`<br>`Equal<H<unknown>, unknown>` | ✅ | ❌ `TS1139`, `TS1005`, `TS1134`, `TS1109` (4.9.5); `TS2344` (5.0.4, 5.4.5, 5.9.3, 6.0.3, 7.0.2) | ❌ `TS2344` (4.9.5) |
<!-- prettier-ignore-end -->

### Names in the wild

| Name            | TypeScript | JavaScript | Total |
| :-------------- | ---------: | ---------: | ----: |
| camelKeys       |        793 |        762 | 1,555 |
| camelCaseKeys   |      5,320 |      3,056 | 8,376 |
| toCamelCaseKeys |        454 |         68 |   522 |
| camelizeKeys    |      2,804 |      3,536 | 6,340 |
| deepCamelKeys   |         38 |          0 |    38 |
| snakeKeys       |        806 |        227 | 1,033 |
| snakeCaseKeys   |      2,364 |      1,544 | 3,908 |
| toSnakeCaseKeys |        408 |         67 |   475 |
| decamelizeKeys  |      1,204 |        972 | 2,176 |
| deepSnakeKeys   |         31 |          6 |    37 |

- **Method**: GitHub code search, one exact-phrase query (`"<name>"`) per name, reading its `total_count`.
- **Collected**: 2026-11-04
- **Caveats**:
  - Counts are approximate and change from day to day; cite one with its date, as an order of magnitude.
  - Matching ignores case.
  - Without a `language:` qualifier every language counts, so an unprefixed name can collide with another language's API (`parseBoolean` matches Java's `Boolean.parseBoolean`).

| Package         | Weekly downloads |
| :-------------- | ---------------: |
| camelcase-keys  |       25,232,962 |
| snakecase-keys  |        2,277,849 |
| decamelize-keys |       15,958,982 |
| kebabcase-keys  |           13,572 |
| humps           |        1,778,030 |
| change-case     |       45,419,126 |
| string-ts       |        3,108,006 |
| es-toolkit      |       79,314,286 |

- **Method**: npm's downloads API, 2026-10-27 to 2026-11-02.
- **Collected**: 2026-11-04
- **Caveats**:
  - Downloads count every install, CI and mirrors included, so they measure reach, not users.

## Why

- **The plan agrees most with es-toolkit:** 31 of the 38 `camelCaseKeys` cases it answers and 31 of 40 `snakeCaseKeys` cases, where camelcase-keys agrees on 27 camel cases, string-ts on 28, and change-case and humps on 26.
  - Their misses are what the plan keeps: every one but camelcase-keys throws a `RangeError` on a cycle, every one throws on a throwing getter or a revoked proxy, and only camelcase-keys keeps a symbol key.
- **Deep by default matches es-toolkit, humps, snakecase-keys, string-ts's `deepCamelKeys`, Rails' `deep_transform_keys`, and .NET's `DictionaryKeyPolicy`;** an API response nests, and a shallow default converts `homeAddress` but leaves `zip_code` inside it.
  - camelcase-keys and change-case are shallow unless asked (`{ deep: true }`, a depth of `Infinity`); `deep: false` keeps their behavior one option away.
- **Walking plain objects only keeps a value's identity**, as es-toolkit does: camelcase-keys, humps, and string-ts rebuild a class instance as a plain object, and humps and snakecase-keys turn a `Map` into `{}`; change-case walks into anything `typeof` calls an object, so a `Date`, a `Map`, or a class instance comes back as a plain copy of its own keys.
- **Copying `__proto__` as a key** follows [deepSortObject](deep-sort-object.md); humps assigns it, which sets the copy's prototype from the input's data.
- **The later key winning** is what every JavaScript library measured and Rails do, and what `JSON.parse` does with a repeated key; .NET writes both keys.
- **`keepOuterUnderscores` stays off by default,** as in the string functions, matching change-case, es-toolkit, string-ts, and humps' `camelizeKeys`; camelcase-keys, humps' `decamelizeKeys`, and Rails' `underscore` keep `"_id"` and `"__typename"`, and the option gives a caller that with one flag.
- **`exclude` matches camelcase-keys' and snakecase-keys' `exclude`, and every library that can leave a key alone agrees with the plan on every `exclude` case**, including that an excluded key's value is still converted.
  - It is the precise fix for `_id` and `__typename`: without it, `{ _id: 1, id: 2 }` collapses to `{ id: 2 }` in every library but camelcase-keys, while `keepOuterUnderscores` would also keep the underscores of every other key.
  - es-toolkit, change-case, string-ts, .NET, and Rails have no way to leave a key alone.
- **Returning the input when anything throws** follows deepSortObject: a key conversion that can't read its input has nothing better to return than the data it was given.
- **ASCII-exact types never lie about a key:** an approximate splitter would type `"emoji😀Face"` as one word where the runtime makes three, so a typed property could name a key that doesn't exist; `string` is honest.
  - On ASCII, the planned types pass every case on every consumer TypeScript version; type-fest's `CamelCase` misses acronyms (`"XMLHttpRequest"`, on 5.0) and separators (`"foo.bar/baz"`), scule's misses spaces and acronyms, and string-ts's can't be parsed by TypeScript 4.9.
  - Each type steps through a key one character at a time as a tail call, so a 240-word key (959 characters) still resolves, where string-ts and type-fest stop with `TS2589` at 60 words.
- **`camelCaseKeys` outnumbers every other name:** about 8 thousand files against `camelizeKeys`' 6 thousand and `camelKeys`' 2 thousand, and it names the result of `camelCase` on the keys, as the string functions' names do.
  - `snakeCaseKeys` likewise leads `decamelizeKeys` and `snakeKeys`.
- **Only the default call and `exclude` are typed** because the other options change the keys the type would have to compute (`splitNumbers` turns `base64Value` into `base_64_value`), and a type that tracked each option literal would cost every caller compile time for a rare call.

## Consequences

- An implementation reuses the case functions' internal splitter and joiners, so a key converts exactly as `camelCase` converts the same string.
- A type test keeps each type in step with its function: for every literal case in `test/cross-env.cases.ts`, a `*.test-d.ts` asserts that `CamelCaseKeys<typeof input>` is the type of the expected result.
- The README notes that a class instance is kept whole at runtime but has its keys converted by `CamelCaseKeys<T>`, since a type can't tell a class from a plain object; `Leaf` is how a caller keeps it whole in the type too.
- The README shows `exclude: ["_id", "__typename"]` for MongoDB's `_id` and GraphQL's `__typename`, and warns that `{ _id, id }` collides without it.
- `research/types/` holds the planned `CamelCase`, `SnakeCase`, `CamelCaseKeys`, and the shared `Words` splitter; `SnakeCaseKeys` is `CamelCaseKeys` with `SnakeCase` in place of `CamelCase`, so its audit is left out.
