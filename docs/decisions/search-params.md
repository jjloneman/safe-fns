---
type: Decision
title: How getSearchParams and getSearchParamValues read a query
description: "`getSearchParams(url, options?)` returns every key of a query as a null-prototype object of string lists, and `getSearchParamValues(url, key, options?)` returns one key's list; both read a URL or its query, as a string, a `URL`, or a `URLSearchParams`, find the query themselves, and decode it with the native `URLSearchParams`, so a runtime without one, such as Hermes, returns the fallback; each decoded value is split on the optional `separator`, each piece trimmed with `trimBlank`, and empty pieces dropped, while a key with no values stays as `[]`; a missing key is absent or `[]`, and an unreadable URL, a non-string key, an invalid separator, or a throw returns the `fallback` option, an empty result by default."
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-10T01:57:53Z }
verified: { by: human:jjloneman, at: 2026-11-02T06:25:10Z }
---

# How getSearchParams and getSearchParamValues read a query

Both read lists out of a query. For `?filters=in-progress,to-do%2Cdone&filters=blocked&page=2&enableMockAutofill`:

```ts
const params = getSearchParams(location.href, { separator: "," });
// { filters: ["in-progress", "to-do", "done", "blocked"], page: ["2"], enableMockAutofill: [] }

"enableMockAutofill" in params; // true
params.page?.[0]; // "2"

getSearchParamValues(location.href, "filters", { separator: "," });
// ["in-progress", "to-do", "done", "blocked"]
```

`new URL(location.href).searchParams.get("filters")` is only `"in-progress,to-do,done"`.

## Decision

- **Two functions, one shared module:**

  ```ts
  type SearchParamsOptions<F> = {
    fallback?: F;
    separator?: string;
  };

  getSearchParams<K extends string = string, F = Partial<Record<K, string[]>>>(
    url: unknown,
    options?: SearchParamsOptions<F>,
  ): Partial<Record<K, string[]>> | F

  getSearchParamValues<F = string[]>(
    url: unknown,
    key: string,
    options?: SearchParamsOptions<F>,
  ): string[] | F
  ```

  - `getSearchParams` reads every key at once, for a page that reads several filters or checks a flag; `getSearchParamValues` reads one, and is `getSearchParams(url, options)[key] ?? []` without building the whole object.
  - `url` and `key` are the values each function works on, so they're positional, as [How a function takes its parameters](function-parameters.md) asks; `separator` is configuration.
  - The parameter is named `url` for what nearly every call passes; its TSDoc says it can also be just the query, as a string or a `URLSearchParams`.
  - Both share one non-public module under `src/internal/` that finds the query, decodes it, and trims and splits the values, so every rule below holds for both, and the second function adds little code.
  - `getSearchParamValues` also scopes `separator` to its one key: `getSearchParams(url, { separator: "," })` splits every key, so a search box's `q=red, blue shoes` would split too.

- **Every value is a `string[]`, even for a key that appears once:** `?page=2` is `{ page: ["2"] }`, and a single value is read with `params.page?.[0]`.
  - The type never depends on the URL, so code written against `?filters=done` still works on `?filters=done&filters=blocked`.
  - A string-or-array result, as qs and query-string give, would type every key `string | string[]`, and a string read as a list fails silently: `"done"[0]` is `"d"`, and `"done".includes("do")` is `true`.
  - It's native `getAll`'s answer; native `get`'s is `?.[0]` away.
- **Key names can be typed, never values:** `getSearchParams<"filters" | "page">(url)` returns `Partial<Record<"filters" | "page", string[]>>`, so a misspelled key is a compile error.
  - Every key stays optional and every value a `string[]`, so the type claims nothing the parser doesn't check; keys outside `K` are still in the object at runtime, just not in its type.
  - There is no option to make a key a single string or to convert values: turning `["true"]` into `true` is [safeParseBoolean](safe-parse-boolean.md)'s job, and a whole shape is a schema library's, such as zod's.
- **Not a native `URLSearchParams`:** `getSearchParams` returns a plain lookup of lists.
  - A `URLSearchParams` can't hold split values: its `getAll` would still return `"in-progress,to-do,done"` as one string.
  - A caller who wants the native object already has `new URL(href).searchParams`; what these functions add is the forgiving read.
- **`getSearchParams`' result has a null prototype,** as [keyBy](key-by.md)'s does, so a key named `__proto__` or `constructor` is an ordinary entry, and `params.toString` is `undefined` rather than a function.
  - It's a new object each call, keyed in the order each key first appears.
  - So `in` is a safe presence check: `"toString" in params` is `false`.
- **Accepted input:**
  - a string, or a boxed string, unwrapped by brand check as every parser does;
  - a `URL`, read through its `search` getter, called as a brand check, so a lookalike object is not a `URL`;
  - a `URLSearchParams`, read through its `toString`, called the same way.
  - Anything else, including `Location`, returns the fallback; `location.href` and `location.search` are strings, so they work.
- **A string is a URL when it holds a `?`:** the query is the text after the first `?`; with no `?`, the whole string is the query.
  - So `"https://example.com/?a=1"`, `"/tasks?a=1"`, `"?a=1"`, and `"a=1"` all read `a` as `"1"`.
  - A fragment is dropped first: `"https://example.com/?a=1#a=2"` reads only `"1"`.
  - The one string misread is a bare query with an unencoded `?` in a value, such as `"q=what?"`, which reads `q` as missing; `URLSearchParams.toString()` encodes a `?`, and `location.search` starts with one, so neither is affected.
- **Keys and values are always decoded, by the native `URLSearchParams`, as `application/x-www-form-urlencoded`:**
  - pairs split on `&` only, never `;`;
  - `+` is a space, and `%20` is a space; `%2B` is a `+`;
  - `%C3%A9` is `é`, and hex escapes are case-insensitive, so `%2c` and `%2C` are both a comma;
  - keys are decoded too, so `filter%73` matches `"filters"`.
- **Decoding never fails, but three inputs come back changed:**
  - bytes that aren't valid UTF-8 become `U+FFFD`, so `%E0%A4%A` is `"�%A"`;
  - a malformed escape is kept as written, so `%ZZ` stays `"%ZZ"`;
  - an unencoded `+` is a space, so `?phone=+15551234` reads `"15551234"` once trimmed; the sender must write `%2B`, as `URLSearchParams` and `encodeURIComponent` do.
  - The replacement character isn't configurable: `U+FFFD` is what the native decoder writes and what Unicode prescribes, `""` would hide the damage and join the text around it, and `"?"` can't be told from a real one; a caller who wants another can `replaceAll("\uFFFD", …)` afterward.
- **One code path, with native decoding:** a `URL` or `URLSearchParams` is turned back into query text and read the same way as a string, so every input gives the same answer.
  - The query is always found by the first-`?` rule above and handed to `new URLSearchParams(query)`; `URL` itself is never needed.
  - `URLSearchParams` is looked up inside the `try` on every call, never probed, as [safeParseUrl](safe-parse-url.md) looks up `URL`; where it's missing, the call throws, and the function returns the fallback.
  - Hermes, React Native's engine, has none, so the docs point React Native users to a polyfill, such as `react-native-url-polyfill`, as `safeParseUrl`'s do.
- **Keys match exactly,** case-sensitive, as `URLSearchParams.getAll` does, so `A` and `a` are two keys.
- **Brackets are part of the key:** `?from%5B0%5D=NYC&from%5B1%5D=LAX` is `{ "from[0]": ["NYC"], "from[1]": ["LAX"] }`, and `from` is missing.
  - `from[0]` nesting is a convention of qs, PHP, and Rails, not of the URL standard, and reading it means depth limits and the prototype-pollution checks qs has needed; a caller groups such keys with a template-literal key type, or uses qs for those URLs.
- **Every value under a key is kept,** in order, as `getAll` does; repeated keys merge, and duplicate values are kept.
- **`separator` is optional:**
  - without it, each value is one piece, so `getSearchParamValues(url, key)` is `getAll` with trimming and empty values dropped;
  - with it, each value is split after decoding, so `{ separator: "," }` splits `,`, `%2C`, and `%2c` alike;
  - it's passed decoded, as `","`; `{ separator: "%2C" }` would match only the literal text `%2C`, which a URL spells `%252C`;
  - no escape survives decoding, so a list item can't contain the separator; items that may hold commas need a separator they never hold, such as `"|"`;
  - it can be more than one character, and is matched literally, never as a regex;
  - an empty string, or anything but a string, returns the fallback.
- **Each piece is trimmed with [`trimBlank`](trim-blank.md), and empty pieces are dropped:**
  - so `"a"`, `"a="`, and `"a= "` give `getSearchParamValues` `[]`, and `"a= , ,b"` with `{ separator: "," }` gives `["b"]`;
  - a key whose pieces are all dropped is still in `getSearchParams`' result, as `[]`: `?enableMockAutofill` is `{ enableMockAutofill: [] }`, so `in` tells a flag that's present from one that isn't, as native `has` does.
- **A missing key is a real answer,** not the fallback: `getSearchParams` leaves it out, so `params.flag` is `undefined` and `"flag" in params` is `false`, and `getSearchParamValues` gives `[]`, as `getAll` does.
- **Everything else returns the `fallback` option:** an unaccepted input, a non-string key, an invalid separator, an options object that can't be read, and anything that throws, such as a revoked proxy or a `URL` from a realm whose getter throws.
  - `getSearchParamValues`' default is `[]`, as [range](range.md)'s is.
  - `getSearchParams`' default is an empty null-prototype object, new each call, so a caller can add to it safely.
  - `{ fallback: undefined }` tells "couldn't read the URL" from "the key isn't there".

## Comparison

The tiers 0–2 summaries from [research/results/get-search-params.md](../../research/results/get-search-params.md) and [research/results/get-search-param-values.md](../../research/results/get-search-param-values.md), generated by `pnpm research`.

- Each probe gets the URL string (and the key), so its column shows how it tells a URL from a query string.
- A probe runs only the separator its call can express: qs's `comma` and query-string's `"comma"` only `","`, query-string's `"separator"` format only a single character, and every other call no separator at all; no tool takes `fallback`, a `URL` or `URLSearchParams` input here, or a non-string key.
- A result with a null prototype shows as `{ "null-prototype": { … } }`.
- A missing key is `undefined` in qs and query-string, `None` in Python, and `null` in .NET, Go, and Spring, where `getSearchParamValues` gives `[]`.

### getSearchParams

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`getSearchParams` | Hermes<br>`Object.fromEntries(new URLSearchParams(value))` | JS built-ins<br>`Object.fromEntries(new URLSearchParams(value))` | qs<br>`qs.parse(value, { comma: true })` | qs<br>`qs.parse(value)` | query-string<br>`queryString.parse(value, { arrayFormat: "comma" })` | query-string<br>`queryString.parse(value)` | Go<br>`url.ParseQuery(value)` | Python<br>`parse_qs(value)` | Spring<br>`UriComponentsBuilder.fromUriString(value).build().getQueryParams()` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"https://example.com/tasks?filters=in-progress,to-do%2Cdone&filters=blocked&page=2", { "separator": "," }` | `{ "null-prototype": { "filters": ["in-progress", "to-do", "done", "blocked"], "page": ["2"] } }` | — | — | `{ "filters": "blocked", "https://example.com/tasks?filters": ["in-progress", "to-do,done"], "page": "2" }` | — | `{ "null-prototype": { "filters": "blocked", "https://example.com/tasks?filters": ["in-progress", "to-do,done"], "page": "2" } }` | — | — | — | — |
| `"https://example.com/tasks?filters=in-progress,to-do%2Cdone&filters=blocked&page=2"` | `{ "null-prototype": { "filters": ["in-progress,to-do,done", "blocked"], "page": ["2"] } }` | 💥 `ReferenceError` | `{ "filters": "blocked", "https://example.com/tasks?filters": "in-progress,to-do,done", "page": "2" }` | — | `{ "filters": "blocked", "https://example.com/tasks?filters": "in-progress,to-do,done", "page": "2" }` | — | `{ "null-prototype": { "filters": "blocked", "https://example.com/tasks?filters": "in-progress,to-do,done", "page": "2" } }` | `{ "filters": ["blocked"], "https://example.com/tasks?filters": ["in-progress,to-do,done"], "page": ["2"] }` | `{ "filters": ["blocked"], "https://example.com/tasks?filters": ["in-progress,to-do,done"], "page": ["2"] }` | `{ "filters": ["in-progress,to-do%2Cdone", "blocked"], "page": ["2"] }` |
| `"?a=1&b=2&a=3"` | `{ "null-prototype": { "a": ["1", "3"], "b": ["2"] } }` | 💥 `ReferenceError` | `{ "a": "3", "b": "2" }` | — | `{ "?a": "1", "a": "3", "b": "2" }` | — | `{ "null-prototype": { "a": ["1", "3"], "b": "2" } }` | `{ "?a": ["1"], "a": ["3"], "b": ["2"] }` | `{ "?a": ["1"], "a": ["3"], "b": ["2"] }` | `{ "a": ["1", "3"], "b": ["2"] }` |
| `"a=1&b=2&a=3"` | `{ "null-prototype": { "a": ["1", "3"], "b": ["2"] } }` | 💥 `ReferenceError` | `{ "a": "3", "b": "2" }` | — | `{ "a": ["1", "3"], "b": "2" }` | — | `{ "null-prototype": { "a": ["1", "3"], "b": "2" } }` | `{ "a": ["1", "3"], "b": ["2"] }` | `{ "a": ["1", "3"], "b": ["2"] }` | `{}` |
| `"/tasks?a=1#b=2"` | `{ "null-prototype": { "a": ["1"] } }` | 💥 `ReferenceError` | `{ "/tasks?a": "1#b=2" }` | — | `{ "/tasks?a": "1#b=2" }` | — | `{ "null-prototype": { "/tasks?a": "1#b=2" } }` | `{ "/tasks?a": ["1#b=2"] }` | `{ "/tasks?a": ["1#b=2"] }` | `{ "a": ["1"] }` |
| `"a=x,%20,y&b=&c", { "separator": "," }` | `{ "null-prototype": { "a": ["x", "y"], "b": [], "c": [] } }` | — | — | `{ "a": ["x", " ", "y"], "b": "", "c": "" }` | — | `{ "null-prototype": { "a": ["x", " ", "y"], "b": "", "c": null } }` | — | — | — | — |
| `"filters=a,b%2Cc%2cd", { "separator": "," }` | `{ "null-prototype": { "filters": ["a", "b", "c", "d"] } }` | — | — | `{ "filters": ["a", "b,c,d"] }` | — | `{ "null-prototype": { "filters": ["a", "b,c,d"] } }` | — | — | — | — |
| `"?enableMockAutofill"` | `{ "null-prototype": { "enableMockAutofill": [] } }` | 💥 `ReferenceError` | `{ "enableMockAutofill": "" }` | — | `{ "?enableMockAutofill": "" }` | — | `{ "null-prototype": { "enableMockAutofill": null } }` | `{ "?enableMockAutofill": [""] }` | `{}` | `{ "enableMockAutofill": [null] }` |
| `"phone=+15551234"` | `{ "null-prototype": { "phone": ["15551234"] } }` | 💥 `ReferenceError` | `{ "phone": " 15551234" }` | — | `{ "phone": " 15551234" }` | — | `{ "null-prototype": { "phone": " 15551234" } }` | `{ "phone": [" 15551234"] }` | `{ "phone": [" 15551234"] }` | `{}` |
| `"?from%5B0%5D=NYC&to%5B0%5D=LAX&from%5B1%5D=LAX&to%5B1%5D=LAS&noOfRoute=2"` | `{ "null-prototype": { "from[0]": ["NYC"], "from[1]": ["LAX"], "noOfRoute": ["2"], "to[0]": ["LAX"], "to[1]": ["LAS"] } }` | 💥 `ReferenceError` | `{ "from[0]": "NYC", "from[1]": "LAX", "noOfRoute": "2", "to[0]": "LAX", "to[1]": "LAS" }` | — | `{ "?from": ["NYC"], "from": ["LAX"], "noOfRoute": "2", "to": ["LAX", "LAS"] }` | — | `{ "null-prototype": { "from[0]": "NYC", "from[1]": "LAX", "noOfRoute": "2", "to[0]": "LAX", "to[1]": "LAS" } }` | `{ "?from[0]": ["NYC"], "from[1]": ["LAX"], "noOfRoute": ["2"], "to[0]": ["LAX"], "to[1]": ["LAS"] }` | `{ "?from[0]": ["NYC"], "from[1]": ["LAX"], "noOfRoute": ["2"], "to[0]": ["LAX"], "to[1]": ["LAS"] }` | `{ "from%5B0%5D": ["NYC"], "from%5B1%5D": ["LAX"], "noOfRoute": ["2"], "to%5B0%5D": ["LAX"], "to%5B1%5D": ["LAS"] }` |
| `"A=1&a=2"` | `{ "null-prototype": { "A": ["1"], "a": ["2"] } }` | 💥 `ReferenceError` | `{ "A": "1", "a": "2" }` | — | `{ "A": "1", "a": "2" }` | — | `{ "null-prototype": { "A": "1", "a": "2" } }` | `{ "A": ["1"], "a": ["2"] }` | `{ "A": ["1"], "a": ["2"] }` | `{}` |
| `"a=1;b=2"` | `{ "null-prototype": { "a": ["1;b=2"] } }` | 💥 `ReferenceError` | `{ "a": "1;b=2" }` | — | `{ "a": "1;b=2" }` | — | `{ "null-prototype": { "a": "1;b=2" } }` | 💥 `*errors.errorString` | `{ "a": ["1;b=2"] }` | `{}` |
| `"__proto__=1&constructor=2"` | `{ "null-prototype": { "__proto__": ["1"], "constructor": ["2"] } }` | 💥 `ReferenceError` | `{ "__proto__": "1", "constructor": "2" }` | — | `{}` | — | `{ "null-prototype": { "__proto__": "1", "constructor": "2" } }` | `{ "__proto__": ["1"], "constructor": ["2"] }` | `{ "__proto__": ["1"], "constructor": ["2"] }` | `{}` |
| `""` | `{ "null-prototype": {} }` | 💥 `ReferenceError` | `{}` | — | `{}` | — | `{ "null-prototype": {} }` | `{}` | `{}` | `{}` |
| `"a=1", { "separator": "" }` | `{ "null-prototype": {} }` | — | — | — | — | — | — | — | — | — |
| `‹a URL with a filters list›, { "separator": "," }` | `{ "null-prototype": { "filters": ["in-progress", "to-do", "done", "blocked"] } }` | — | — | — | — | — | — | — | — | — |
| `‹a URLSearchParams with an entry›` | `{ "null-prototype": { "a": ["1"] } }` | — | — | — | — | — | — | — | — | — |
| `42` | `{ "null-prototype": {} }` | — | — | — | — | — | — | — | — | — |
| `‹a revoked proxy›` | `{ "null-prototype": {} }` | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

### getSearchParamValues

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`getSearchParamValues` | Hermes<br>`new URL(value).searchParams.getAll(key)` | Hermes<br>`new URLSearchParams(value).getAll(key)` | JS built-ins<br>`new URL(value).searchParams.getAll(key)` | JS built-ins<br>`new URLSearchParams(value).getAll(key)` | qs<br>`qs.parse(value, { comma: true })[key]` | qs<br>`qs.parse(value)[key]` | query-string<br>`queryString.parse(value, { arrayFormat: "comma" })[key]` | query-string<br>`queryString.parse(value, { arrayFormat: "separator", arrayFormatSeparator: separator })[key]` | query-string<br>`queryString.parse(value)[key]` | query-string<br>`queryString.parseUrl(value).query[key]` | .NET<br>`HttpUtility.ParseQueryString(value).GetValues(key)` | Go<br>`url.Parse(value) then .Query()[key]` | Go<br>`url.ParseQuery(value) then values[key]` | Python<br>`parse_qs(urlsplit(value).query).get(key)` | Python<br>`parse_qs(value).get(key)` | Rust<br>`form_urlencoded::parse(value.as_bytes()), values under key` | Rust<br>`Url::parse(value)?.query_pairs(), values under key` | Spring<br>`UriComponentsBuilder.fromUriString(value).build().getQueryParams().get(key)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"https://example.com/tasks?filters=in-progress,to-do%2Cdone&filters=blocked", "filters", { "separator": "," }` | `["in-progress", "to-do", "done", "blocked"]` | — | — | — | — | `"blocked"` | — | `"blocked"` | `"blocked"` | — | — | — | — | — | — | — | — | — | — |
| `"https://example.com/tasks?filters=in-progress,to-do%2Cdone&filters=blocked", "filters"` | `["in-progress,to-do,done", "blocked"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | `["in-progress,to-do,done", "blocked"]` | `["blocked"]` | — | `"blocked"` | — | — | `"blocked"` | `["in-progress,to-do,done", "blocked"]` | `["blocked"]` | `["in-progress,to-do,done", "blocked"]` | `["blocked"]` | `["in-progress,to-do,done", "blocked"]` | `["blocked"]` | `["blocked"]` | `["in-progress,to-do,done", "blocked"]` | `["in-progress,to-do%2Cdone", "blocked"]` |
| `"https://example.com/?a=1#a=2", "a"` | `["1"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | `["1"]` | `[]` | — | `undefined` | — | — | `undefined` | `"1"` | `null` | `["1"]` | `null` | `["1"]` | `null` | `[]` | `["1"]` | `["1"]` |
| `"/tasks?a=1&a=2", "a"` | `["1", "2"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["2"]` | — | `"2"` | — | — | `"2"` | `["1", "2"]` | `["2"]` | `["1", "2"]` | `["2"]` | `["1", "2"]` | `["2"]` | `["2"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `["1", "2"]` |
| `"?a=1&a=2", "a"` | `["1", "2"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["1", "2"]` | — | `"2"` | — | — | `["1", "2"]` | `["1", "2"]` | `["1", "2"]` | `["1", "2"]` | `["2"]` | `["1", "2"]` | `["2"]` | `["2"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `["1", "2"]` |
| `"a=1&a=2", "a"` | `["1", "2"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["1", "2"]` | — | `["1", "2"]` | — | — | `["1", "2"]` | `undefined` | `["1", "2"]` | `null` | `["1", "2"]` | `null` | `["1", "2"]` | `["1", "2"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=1;a=2", "a"` | `["1;a=2"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["1;a=2"]` | — | `"1;a=2"` | — | — | `"1;a=2"` | `undefined` | `["1;a=2"]` | `null` | 💥 `*errors.errorString` | `null` | `["1;a=2"]` | `["1;a=2"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"q=what?", "q"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["what?"]` | — | `"what?"` | — | — | `"what?"` | `undefined` | `["what?"]` | `null` | `["what?"]` | `null` | `["what?"]` | `["what?"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=hello+world", "a"` | `["hello world"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["hello world"]` | — | `"hello world"` | — | — | `"hello world"` | `undefined` | `["hello world"]` | `null` | `["hello world"]` | `null` | `["hello world"]` | `["hello world"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=hello%20world", "a"` | `["hello world"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["hello world"]` | — | `"hello world"` | — | — | `"hello world"` | `undefined` | `["hello world"]` | `null` | `["hello world"]` | `null` | `["hello world"]` | `["hello world"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=%2B", "a"` | `["+"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["+"]` | — | `"+"` | — | — | `"+"` | `undefined` | `["+"]` | `null` | `["+"]` | `null` | `["+"]` | `["+"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=%C3%A9", "a"` | `["é"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["é"]` | — | `"é"` | — | — | `"é"` | `undefined` | `["é"]` | `null` | `["é"]` | `null` | `["é"]` | `["é"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=%E0%A4%A", "a"` | `["�%A"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["�%A"]` | — | `"%E0%A4%A"` | — | — | `"�%A"` | `undefined` | `["�%A"]` | 💥 `*url.Error` | 💥 `url.EscapeError` | `null` | `["�%A"]` | `["�%A"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=%ZZ", "a"` | `["%ZZ"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["%ZZ"]` | — | `"%ZZ"` | — | — | `"%ZZ"` | `undefined` | `["%ZZ"]` | 💥 `*url.Error` | 💥 `url.EscapeError` | `null` | `["%ZZ"]` | `["%ZZ"]` | 💥 `ParseError::RelativeUrlWithoutBase` | 💥 `InvalidUrlException` |
| `"filter%73=x", "filters"` | `["x"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["x"]` | — | `"x"` | — | — | `"x"` | `undefined` | `["x"]` | `null` | `["x"]` | `null` | `["x"]` | `["x"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"A=1", "a"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[]` | — | `undefined` | — | — | `undefined` | `undefined` | `["1"]` | `null` | `null` | `null` | `null` | `[]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a", "a"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[""]` | — | `""` | — | — | `null` | `undefined` | `null` | `null` | `[""]` | `null` | `null` | `[""]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=", "a"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[""]` | — | `""` | — | — | `""` | `undefined` | `[""]` | `null` | `[""]` | `null` | `null` | `[""]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=1&&a=&a=2&", "a"` | `["1", "2"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["1", "", "2"]` | — | `["1", "", "2"]` | — | — | `["1", "", "2"]` | `undefined` | `["1", "", "2"]` | `null` | `["1", "", "2"]` | `null` | `["1", "2"]` | `["1", "", "2"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=%20x%20,%20,y\u{A0}", "a", { "separator": "," }` | `["x", "y"]` | — | — | — | — | `[" x ", " ", "y\u{A0}"]` | — | `[" x ", " ", "y"]` | `[" x ", " ", "y"]` | — | — | — | — | — | — | — | — | — | — |
| `"filters=to-do%2Cdone,blocked", "filters", { "separator": "," }` | `["to-do", "done", "blocked"]` | — | — | — | — | `["to-do,done", "blocked"]` | — | `["to-do,done", "blocked"]` | `["to-do,done", "blocked"]` | — | — | — | — | — | — | — | — | — | — |
| `"a=x,x", "a", { "separator": "," }` | `["x", "x"]` | — | — | — | — | `["x", "x"]` | — | `["x", "x"]` | `["x", "x"]` | — | — | — | — | — | — | — | — | — | — |
| `"a=x%2cy", "a", { "separator": "," }` | `["x", "y"]` | — | — | — | — | `"x,y"` | — | `"x,y"` | `"x,y"` | — | — | — | — | — | — | — | — | — | — |
| `"phone=+15551234", "phone"` | `["15551234"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[" 15551234"]` | — | `" 15551234"` | — | — | `" 15551234"` | `undefined` | `[" 15551234"]` | `null` | `[" 15551234"]` | `null` | `[" 15551234"]` | `[" 15551234"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"?from%5B0%5D=NYC&from%5B1%5D=LAX", "from[1]"` | `["LAX"]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `["LAX"]` | — | `undefined` | — | — | `"LAX"` | `"LAX"` | `["LAX"]` | `["LAX"]` | `["LAX"]` | `["LAX"]` | `["LAX"]` | `["LAX"]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"?from%5B0%5D=NYC&from%5B1%5D=LAX", "from"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[]` | — | `["LAX"]` | — | — | `undefined` | `undefined` | `null` | `null` | `null` | `null` | `null` | `[]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"?enableMockAutofill", "enableMockAutofill"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[""]` | — | `undefined` | — | — | `null` | `null` | `null` | `[""]` | `null` | `null` | `null` | `[]` | 💥 `ParseError::RelativeUrlWithoutBase` | `[null]` |
| `"a=x;y", "a", { "separator": ";" }` | `["x", "y"]` | — | — | — | — | — | — | — | `["x", "y"]` | — | — | — | — | — | — | — | — | — | — |
| `"a=x\|\|y", "a", { "separator": "\|\|" }` | `["x", "y"]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `"a=x,y", "a", { "separator": "" }` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `"", "a"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[]` | — | `undefined` | — | — | `undefined` | `undefined` | `null` | `null` | `null` | `null` | `null` | `[]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=1", "b"` | `[]` | 💥 `ReferenceError` | 💥 `ReferenceError` | 💥 `TypeError` | `[]` | — | `undefined` | — | — | `undefined` | `undefined` | `null` | `null` | `null` | `null` | `null` | `[]` | 💥 `ParseError::RelativeUrlWithoutBase` | `null` |
| `"a=1", 1` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a URL with a filters list›, "filters", { "separator": "," }` | `["in-progress", "to-do", "done", "blocked"]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a URLSearchParams with an entry›, "a"` | `["1"]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a boxed query string›, "a"` | `["1", "2"]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `42, "a"` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `null, "a"` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a revoked proxy›, "a"` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹an object with a throwing getter›, "a"` | `[]` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- **Every input, one answer:** each tool reads only one kind of string.
  - `URLSearchParams`, qs, `queryString.parse`, Python's `parse_qs`, Go's `url.ParseQuery`, .NET's `ParseQueryString`, and Rust's `form_urlencoded` read `"https://example.com/?a=1"` as a key named `https://example.com/?a`; `URLSearchParams`, query-string, and .NET strip a leading `?`, while qs, Python, Go, and Rust read `"?a=1"` as a key named `?a`.
  - `new URL`, `queryString.parseUrl`, Python's `urlsplit`, Go's `url.Parse`, Rust's `Url::parse`, and Spring read only URLs: `new URL` and `Url::parse` throw on `"/tasks?a=1"`, and Spring reads `"a=1&b=2&a=3"` as `{}`.
  - Splitting at the first `?` reads both, and matches how a URL defines its query.
- **The first `?`, rather than parsing a URL:** a URL parser rejects relative paths and needs a base; reading after the `?` needs neither.
- **Lists for every key, not just repeated ones:** qs and query-string give a string for a key that appears once and an array for one that repeats, so `filters` changes type with the URL; `Object.fromEntries(new URLSearchParams(…))` keeps only the last value; Python's `parse_qs`, Go's `url.Values`, and Spring always give lists, as this does.
- **A key with no values stays:** `?enableMockAutofill` is the common way to switch a feature on, and its presence is all it carries.
  - `URLSearchParams` keeps it as `""`, query-string as `null`, and Spring as `[null]`, and qs and Go keep `""` under a key named `?enableMockAutofill`; Python's `parse_qs` drops it, so the flag vanishes.
  - Keeping it as `[]` keeps the presence while every value stays a non-empty string.
- **A null prototype:** qs drops `__proto__` and `constructor` without a word, so `"__proto__=1&constructor=2"` gives `{}`; query-string also returns a null-prototype object, and `Object.fromEntries` keeps both as own keys on an ordinary object.
- **`+` as a space and lenient escapes:** every compared decoder turns `+` into a space, so every one reads `?phone=+15551234` as `" 15551234"`, and Spring's `getQueryParams` doesn't decode at all (`to-do%2Cdone`); `URLSearchParams` and Rust keep `%ZZ` and replace bad UTF-8, where Go's `ParseQuery` fails the whole query and qs leaves `%E0%A4%A` undecoded.
  - Following `URLSearchParams` gives the same answer a browser gives for the same URL.
- **`&` only:** `URLSearchParams`, qs, query-string, Python, .NET, and Rust split only on `&`; Go's `ParseQuery` rejects a `;`.
- **Case-sensitive keys:** every tool compared but .NET's `ParseQueryString` matches case-sensitively.
- **Trimmed, non-empty pieces:** `URLSearchParams`, qs, query-string, Go, and Rust keep `""` for `a=`, query-string reads a bare `c` as `null`, and none trims; Python's `parse_qs` drops blank values by default.
  - A list read from a URL is a list of things to filter by, where `""` is never one, and a value pasted with a trailing no-break space shouldn't miss a match.
- **A separator option, not only commas:** qs and query-string split only on commas, and query-string's `"separator"` format only on one character; `;` and `|` are common list separators too.
  - Splitting the decoded value is what makes `%2C` and `%2c` split: qs and query-string split before decoding, so `filters=a,b%2Cc%2cd` gives them `["a", "b,c,d"]`.
- **An empty default fallback:** a list read from a query is usually looped over at once, so an empty result needs no check at the call site, and `fallback` lets a caller tell "not in the query" from "couldn't read the URL", as [range](range.md)'s does.
- **Brackets as plain keys:** `URLSearchParams`, query-string, Go, Python, and Rust keep `from[0]` as one key; qs nests it into `from: ["NYC", "LAX"]`, but without `ignoreQueryPrefix` it reads `?from[0]` as a key named `?from`, so the first leg lands under the wrong key; Spring doesn't decode `%5B` at all.
- **Native decoding:** every `URLSearchParams` call throws `ReferenceError` on Hermes, so the function returns the fallback there, as `safeParseUrl` does without `URL`.
  - Decoding natively keeps the bundle small, gives exactly the browser's answer with no decoder of our own to test, and runs at native speed.
  - A React Native app with a polyfill installed gets the same answers as a browser.

## Consequences

- The shared module under `src/internal/` finds the query and trims and splits what `URLSearchParams` decodes; it never decodes on its own.
- Each function is its own subpath, `safe-fns/get-search-params` and `safe-fns/get-search-param-values`, sharing that module.
- The docs show:
  - `getSearchParamValues(location.href, key, { separator: "," })` for a list;
  - `"flag" in getSearchParams(location.href)` for a presence flag, and `params.page?.[0]` for a single value;
  - `safeParseBoolean` or a schema library for converting values;
  - a short recipe grouping bracket keys such as `from[0]`, with a template-literal key type.
- The docs warn that:
  - an unencoded `+` reads as a space;
  - a list item can't contain its separator, and `getSearchParams`' separator applies to every key;
  - a bare query with an unencoded `?` in a value is misread;
  - Hermes needs a `URLSearchParams` polyfill, without which every call returns the fallback.
- Their tests cover each fallback case above, including a revoked proxy as the URL and as the options, and their type tests check that `fallback` widens the return type and that a key outside `K` is a compile error.
- `getSearchParams` isn't in #120's scope as filed, so #120 is updated to include it.
- [safeParseUrl](safe-parse-url.md)'s Consequences describe `getSearchParamValues`' settled details; they still hold, and point here for `getSearchParams`.
