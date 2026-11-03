---
type: Decision
title: How the case functions split words and which styles ship
description: One splitter, `words`, breaks a string at separators, at a lower-to-upper change, and before the last capital of an acronym, keeping digits on the word before them unless `splitNumbers` is set and making a run of symbols a word of its own; `camelCase`, `pascalCase`, `snakeCase`, `constantCase`, `kebabCase`, `lowerCase`, `titleCase`, and `sentenceCase` join its words, each flattening a word's case locale-free, `keepOuterUnderscores` keeps a leading or trailing `_` run, and a non-string returns the `fallback` option, `""` by default.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-03T07:05:37Z }
---

# How the case functions split words and which styles ship

`words(value)` splits a string into words, and each case function joins those words in one style: `camelCase("XMLHttpRequest")` is `"xmlHttpRequest"`, and `snakeCase("version2Beta")` is `"version2_beta"`.

## Decision

- **Nine exports, one per subpath:** `words`, `camelCase`, `pascalCase`, `snakeCase`, `constantCase`, `kebabCase`, `lowerCase`, `titleCase`, and `sentenceCase`.

  | Function       | `"fooBarBaz"` →         |
  | :------------- | :---------------------- |
  | `words`        | `["foo", "Bar", "Baz"]` |
  | `camelCase`    | `"fooBarBaz"`           |
  | `pascalCase`   | `"FooBarBaz"`           |
  | `snakeCase`    | `"foo_bar_baz"`         |
  | `constantCase` | `"FOO_BAR_BAZ"`         |
  | `kebabCase`    | `"foo-bar-baz"`         |
  | `lowerCase`    | `"foo bar baz"`         |
  | `titleCase`    | `"Foo Bar Baz"`         |
  | `sentenceCase` | `"Foo bar baz"`         |

- **No umbrella `changeCase(value, { style })`.** Each style is its own function, as in every library measured; one subpath per function keeps an unused style out of the bundle, and a `style` string would be a lookup no call site needs.
- **Seven measured styles are left out,** each a one-line `words(value).map(…).join(…)` for the caller who needs it: Train (`Foo-Bar-Baz`), Pascal snake (`Foo_Bar_Baz`), screaming kebab (`FOO-BAR-BAZ`), dot, path, flat (`foobarbaz`), and upper words (`FOO BAR BAZ`). #100 is to park them in [native-first-scope.md](native-first-scope.md).
- **`words` splits at three kinds of boundary,** and every style is built from its output:
  - **a separator:** any run of whitespace, punctuation (`_`, `-`, `.`, `/`, `,`), or other character that is neither a letter, a combining mark, a digit, nor a symbol, so `"foo__bar"` and `"  padded  "` lose their extra separators, and `"_private"` becomes `["private"]` unless `keepOuterUnderscores` is set;
  - **a lower-to-upper change:** `"fooBar"` → `["foo", "Bar"]`, and `"iPhone"` → `["i", "Phone"]`; a caseless letter counts as lower, so `"日本語Text"` → `["日本語", "Text"]`;
  - **the last capital of an acronym,** where an uppercase run meets a lowercase letter: `"XMLHttpRequest"` → `["XML", "Http", "Request"]`, and `"userID"` → `["user", "ID"]`.
  - The rule reads the letters' shape, with no list of acronyms, so a plural or mixed-case acronym splits wrong, as in every library measured: `"userIDs"` → `["user", "I", "Ds"]` (`snakeCase` gives `"user_i_ds"`), and `"iOSApp"` → `["i", "OS", "App"]`.
- **A digit belongs to the word before it,** and an uppercase letter after a digit starts a new word: `"base64Encode"` → `["base64", "Encode"]`, `"HTML5Parser"` → `["HTML5", "Parser"]`, and `"v1.2.3"` → `["v1", "2", "3"]`.
  - So `snakeCase("version2Beta")` is `"version2_beta"`, not lodash's `"version_2_beta"`, and `camelCase` turns either back into `"version2Beta"`.
- **`{ splitNumbers: true }` splits a number off on both sides,** on `words` and every style (owner, 2026-11-03): `snakeCase("version2Beta", { splitNumbers: true })` is lodash's `"version_2_beta"`, and `words("2fast4you", { splitNumbers: true })` is `["2", "fast", "4", "you"]`.
  - It's change-case's `splitSeparateNumbers`, named for what it does: `split` is what `words` does, and a number is any `\p{N}` character, so `"x²"` gives `["x", "²"]`, where lodash and change-case drop the `²`.
  - In `camelCase` and `pascalCase` it shows only in the letter after a number, since the words join with nothing between them: `camelCase("version2beta")` is `"version2beta"`, and `"version2Beta"` with `splitNumbers`, lodash's answer; `camelCase("version2Beta", { splitNumbers: true })` stays `"version2Beta"`, where change-case marks the split with `_` (`"version_2Beta"`).
- **`{ keepOuterUnderscores: true }` keeps a leading or trailing `_` run as written,** on `words` and every style (owner, 2026-11-03), for the `_private` and `__init__` conventions: the rest converts as usual and the runs are put back around it.
  - `camelCase("__foo_bar__", { keepOuterUnderscores: true })` is `"__fooBar__"`, `pascalCase("_private_key", …)` is `"_PrivateKey"`, and `words("__init__", …)` is `["__init__"]`, the runs joined to the first and last words.
  - Only underscores, and only at the very start or end: `"foo__bar"` still gives `"fooBar"`, a leading `-` or `.` is still dropped, and a string of nothing but underscores comes back as it is.
- **An apostrophe between two letters stays in the word:** `words("don't stop")` is `["don't", "stop"]`.
  - The joined styles drop it (`camelCase` gives `"dontStop"`), since an identifier can't hold it; the spaced styles keep it (`titleCase` gives `"Don't Stop"`).
- **A run of symbols is a word of its own,** an emoji included: `"c++ code"` → `["c", "++", "code"]`, `"price$"` → `["price", "$"]`, `"20°C"` → `["20", "°", "C"]`, and `"emoji😀Face"` → `["emoji", "😀", "Face"]`, with a ZWJ sequence kept whole.
  - A symbol is any `\p{S}` character (math, currency, modifier, and other symbols, emoji among them); punctuation (`\p{P}`) stays a separator.
  - So the styles keep it: `snakeCase("c++ code")` is `"c_++_code"`, and `camelCase` gives `"c++Code"`.
- **A combining mark stays with its letter,** so a decomposed `"e\u0301"` splits like a precomposed `"é"`.
- **Each style flattens a word's case,** acronyms included:
  - `camelCase` lowercases the first word and gives every later word an uppercase first letter and a lowercase rest; `pascalCase` treats every word as a later word: `"xmlHttpRequest"`, `"XmlHttpRequest"`;
  - `titleCase` and `sentenceCase` flatten the same way, so `titleCase("userID")` is `"User Id"`, and `sentenceCase("XMLHttpRequest")` is `"Xml http request"`;
  - `snakeCase`, `kebabCase`, and `lowerCase` lowercase every word, and `constantCase` uppercases it.
- **Case mapping is locale-free `toUpperCase` / `toLowerCase` on code points,** as [upperFirst](upper-first.md) decides, with no `locale` option.
  - Full mapping can lengthen a word: `constantCase("straße")` is `"STRASSE"`.
  - A titlecase digraph is uppercase for splitting and maps like any letter: `camelCase("ǅemal")` is `"ǆemal"`, and `titleCase("ǅemal")` is `"Ǆemal"`.
  - `camelCase("İstanbul")` is `"i̇stanbul"`, the locale-free `i` plus a combining dot.
- **Nothing is transliterated:** `camelCase("ÉcoleNormale")` is `"écoleNormale"`; lodash's `"ecoleNormale"` is [toBasicAscii](to-basic-ascii.md)'s job.
- **`titleCase` capitalizes every word,** small words included: `"The Lord Of The Rings"`; a style guide's list of small words is English-only and differs between guides.
- **A non-string returns the `fallback` option,** `""` by default and `[]` for `words`, as [trimBlank](trim-blank.md) does; a boxed string is unwrapped first.
- **The type-level versions** (`CamelCase<"foo_bar">`) and object-key conversion are settled by #131, from this record's splitter and names.

## Comparison

The tiers 0–2 summaries for the splitter and four styles, from `research/results/`, generated by `pnpm research`; every style's full table is there, adding Rails.

- The other styles: [pascal-case.md](../../research/results/pascal-case.md), [snake-case.md](../../research/results/snake-case.md), [constant-case.md](../../research/results/constant-case.md), [kebab-case.md](../../research/results/kebab-case.md), and [lower-case.md](../../research/results/lower-case.md).
- Voca's `titleCase` capitalizes space-separated runs without splitting them, so its column disagrees wherever the input has no spaces (`"FooBarBaz"`).
- The styles left out: [train-case.md](../../research/results/train-case.md), [pascal-snake-case.md](../../research/results/pascal-snake-case.md), [screaming-kebab-case.md](../../research/results/screaming-kebab-case.md), [dot-case.md](../../research/results/dot-case.md), [path-case.md](../../research/results/path-case.md), [flat-case.md](../../research/results/flat-case.md), and [upper-case.md](../../research/results/upper-case.md).

### words

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`words` | change-case<br>`split(value)` | change-case<br>`splitSeparateNumbers(value)` | es-toolkit<br>`words(value)` | lodash<br>`words(value)` | scule<br>`splitByCase(value)` | string-ts<br>`words(value)` | Voca<br>`v.words(value)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"fooBarBaz"` | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` | — | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` |
| `"FooBarBaz"` | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` | — | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` |
| `"foo_bar_baz"` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | — | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` |
| `"foo-bar-baz"` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | — | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` |
| `"foo bar baz"` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | — | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo bar baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` |
| `"FOO_BAR_BAZ"` | `["FOO", "BAR", "BAZ"]` | `["FOO", "BAR", "BAZ"]` | — | `["FOO", "BAR", "BAZ"]` | `["FOO", "BAR", "BAZ"]` | `["FOO", "BAR", "BAZ"]` | `["FOO", "BAR", "BAZ"]` | `["FOO", "BAR", "BAZ"]` |
| `"Foo Bar Baz"` | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` | — | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` | `["Foo ", "Bar ", "Baz"]` | `["Foo", "Bar", "Baz"]` | `["Foo", "Bar", "Baz"]` |
| `"foo.bar/baz"` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | — | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` | `["foo", "bar", "baz"]` |
| `"XMLHttpRequest"` | `["XML", "Http", "Request"]` | `["XML", "Http", "Request"]` | — | `["XML", "Http", "Request"]` | `["XML", "Http", "Request"]` | `["XML", "Http", "Request"]` | `["XML", "Http", "Request"]` | `["XML", "Http", "Request"]` |
| `"IOError"` | `["IO", "Error"]` | `["IO", "Error"]` | — | `["IO", "Error"]` | `["IO", "Error"]` | `["IO", "Error"]` | `["IO", "Error"]` | `["IO", "Error"]` |
| `"userID"` | `["user", "ID"]` | `["user", "ID"]` | — | `["user", "ID"]` | `["user", "ID"]` | `["user", "ID"]` | `["user", "ID"]` | `["user", "ID"]` |
| `"iPhone"` | `["i", "Phone"]` | `["i", "Phone"]` | — | `["i", "Phone"]` | `["i", "Phone"]` | `["i", "Phone"]` | `["i", "Phone"]` | `["i", "Phone"]` |
| `"ABC"` | `["ABC"]` | `["ABC"]` | — | `["ABC"]` | `["ABC"]` | `["ABC"]` | `["ABC"]` | `["ABC"]` |
| `"version2Beta"` | `["version2", "Beta"]` | `["version2", "Beta"]` | — | `["version", "2", "Beta"]` | `["version", "2", "Beta"]` | `["version2", "Beta"]` | `["version", "2", "Beta"]` | `["version", "2", "Beta"]` |
| `"base64Encode"` | `["base64", "Encode"]` | `["base64", "Encode"]` | — | `["base", "64", "Encode"]` | `["base", "64", "Encode"]` | `["base64", "Encode"]` | `["base", "64", "Encode"]` | `["base", "64", "Encode"]` |
| `"HTML5Parser"` | `["HTML5", "Parser"]` | `["HTML5", "Parser"]` | — | `["HTML", "5", "Parser"]` | `["HTML", "5", "Parser"]` | `["HTML5", "Parser"]` | `["HTML", "5", "Parser"]` | `["HTML", "5", "Parser"]` |
| `"ABC123Def"` | `["ABC123", "Def"]` | `["ABC123", "Def"]` | — | `["ABC", "123", "Def"]` | `["ABC", "123", "Def"]` | `["ABC123", "Def"]` | `["ABC", "123", "Def"]` | `["ABC", "123", "Def"]` |
| `"v1.2.3"` | `["v1", "2", "3"]` | `["v1", "2", "3"]` | — | `["v", "1", "2", "3"]` | `["v", "1", "2", "3"]` | `["v1", "2", "3"]` | `["v", "1", "2", "3"]` | `["v", "1", "2", "3"]` |
| `"don't stop"` | `["don't", "stop"]` | `["don", "t", "stop"]` | — | `["don", "t", "stop"]` | `["don't", "stop"]` | `["don't stop"]` | `["don't", "stop"]` | `["don", "t", "stop"]` |
| `"the lord of the rings"` | `["the", "lord", "of", "the", "rings"]` | `["the", "lord", "of", "the", "rings"]` | — | `["the", "lord", "of", "the", "rings"]` | `["the", "lord", "of", "the", "rings"]` | `["the lord of the rings"]` | `["the", "lord", "of", "the", "rings"]` | `["the", "lord", "of", "the", "rings"]` |
| `"foo__bar"` | `["foo", "bar"]` | `["foo", "bar"]` | — | `["foo", "bar"]` | `["foo", "bar"]` | `["foo", "", "bar"]` | `["foo", "bar"]` | `["foo", "bar"]` |
| `"_private"` | `["private"]` | `["private"]` | — | `["private"]` | `["private"]` | `["", "private"]` | `["private"]` | `["private"]` |
| `"  padded  "` | `["padded"]` | `["padded"]` | — | `["padded"]` | `["padded"]` | `["  padded  "]` | `["padded"]` | `["padded"]` |
| `"c++ code"` | `["c", "++", "code"]` | `["c", "code"]` | — | `["c", "code"]` | `["c", "code"]` | `["c++ code"]` | `["c", "++", "code"]` | `["c", "code"]` |
| `"a+b"` | `["a", "+", "b"]` | `["a", "b"]` | — | `["a", "b"]` | `["a", "b"]` | `["a+b"]` | `["a", "+", "b"]` | `["a", "b"]` |
| `"price$"` | `["price", "$"]` | `["price"]` | — | `["price"]` | `["price"]` | `["price$"]` | `["price", "$"]` | `["price"]` |
| `"20°C"` | `["20", "°", "C"]` | `["20", "C"]` | — | `["20", "C"]` | `["20", "C"]` | `["20°", "C"]` | `["20", "°", "C"]` | `["20", "C"]` |
| `"userIDs"` | `["user", "I", "Ds"]` | `["user", "I", "Ds"]` | — | `["user", "I", "Ds"]` | `["user", "I", "Ds"]` | `["user", "I", "Ds"]` | `["user", "I", "Ds"]` | `["user", "I", "Ds"]` |
| `"iOSApp"` | `["i", "OS", "App"]` | `["i", "OS", "App"]` | — | `["i", "OS", "App"]` | `["i", "OS", "App"]` | `["i", "OS", "App"]` | `["i", "OS", "App"]` | `["i", "OS", "App"]` |
| `"version2beta"` | `["version2beta"]` | `["version2beta"]` | — | `["version", "2", "beta"]` | `["version", "2", "beta"]` | `["version2beta"]` | `["version", "2", "beta"]` | `["version", "2", "beta"]` |
| `"2fast4you"` | `["2fast4you"]` | `["2fast4you"]` | — | `["2", "fast", "4", "you"]` | `["2", "fast", "4", "you"]` | `["2fast4you"]` | `["2", "fast", "4", "you"]` | `["2", "fast", "4", "you"]` |
| `"ÉcoleNormale"` | `["École", "Normale"]` | `["École", "Normale"]` | — | `["École", "Normale"]` | `["École", "Normale"]` | `["École", "Normale"]` | `["É", "cole", "Normale"]` | `["École", "Normale"]` |
| `"écoleNormale"` | `["école", "Normale"]` | `["e", "cole", "Normale"]` | — | `["e", "cole", "Normale"]` | `["école", "Normale"]` | `["école", "Normale"]` | `["e", "́", "cole", "Normale"]` | `["école", "Normale"]` |
| `"straße"` | `["straße"]` | `["straße"]` | — | `["straße"]` | `["straße"]` | `["straße"]` | `["stra", "ß", "e"]` | `["straße"]` |
| `"İstanbul"` | `["İstanbul"]` | `["İstanbul"]` | — | `["İstanbul"]` | `["İstanbul"]` | `["İstanbul"]` | `["İ", "stanbul"]` | `["İstanbul"]` |
| `"ǅemal"` | `["ǅemal"]` | `["ǅemal"]` | — | `["ǅemal"]` | `["ǅemal"]` | `["ǅemal"]` | `["ǅ", "emal"]` | `["ǅemal"]` |
| `"日本語Text"` | `["日本語", "Text"]` | `["日本語Text"]` | — | `["日本語Text"]` | `["日本語", "Text"]` | `["日本語", "Text"]` | `["日本語", "Text"]` | `["日本語Text"]` |
| `"emoji😀Face"` | `["emoji", "😀", "Face"]` | `["emoji", "Face"]` | — | `["emoji", "😀", "Face"]` | `["emoji", "😀", "Face"]` | `["emoji😀", "Face"]` | `["emoji", "😀", "Face"]` | `["emoji", "😀Face"]` |
| `"👩\u{200D}💻dev"` | `["👩\u{200D}💻", "dev"]` | `["dev"]` | — | `["👩", "💻", "dev"]` | `["👩\u{200D}💻", "dev"]` | `["👩\u{200D}💻dev"]` | `["👩\u{200D}💻", "dev"]` | `["👩", "💻dev"]` |
| `"a"` | `["a"]` | `["a"]` | — | `["a"]` | `["a"]` | `["a"]` | `["a"]` | `["a"]` |
| `""` | `[]` | `[]` | — | `[]` | `[]` | `[]` | `[""]` | `[]` |
| `"version2Beta", { "splitNumbers": false }` | `["version2", "Beta"]` | `["version2", "Beta"]` | — | — | — | `["version2", "Beta"]` | — | — |
| `"version2Beta", { "splitNumbers": true }` | `["version", "2", "Beta"]` | — | `["version", "2", "Beta"]` | `["version", "2", "Beta"]` | `["version", "2", "Beta"]` | — | `["version", "2", "Beta"]` | `["version", "2", "Beta"]` |
| `"base64Encode", { "splitNumbers": true }` | `["base", "64", "Encode"]` | — | `["base", "64", "Encode"]` | `["base", "64", "Encode"]` | `["base", "64", "Encode"]` | — | `["base", "64", "Encode"]` | `["base", "64", "Encode"]` |
| `"HTML5Parser", { "splitNumbers": true }` | `["HTML", "5", "Parser"]` | — | `["HTML", "5", "Parser"]` | `["HTML", "5", "Parser"]` | `["HTML", "5", "Parser"]` | — | `["HTML", "5", "Parser"]` | `["HTML", "5", "Parser"]` |
| `"ABC123Def", { "splitNumbers": true }` | `["ABC", "123", "Def"]` | — | `["ABC", "123", "Def"]` | `["ABC", "123", "Def"]` | `["ABC", "123", "Def"]` | — | `["ABC", "123", "Def"]` | `["ABC", "123", "Def"]` |
| `"v1.2.3", { "splitNumbers": true }` | `["v", "1", "2", "3"]` | — | `["v", "1", "2", "3"]` | `["v", "1", "2", "3"]` | `["v", "1", "2", "3"]` | — | `["v", "1", "2", "3"]` | `["v", "1", "2", "3"]` |
| `"utf8", { "splitNumbers": true }` | `["utf", "8"]` | — | `["utf", "8"]` | `["utf", "8"]` | `["utf", "8"]` | — | `["utf", "8"]` | `["utf", "8"]` |
| `"version2beta", { "splitNumbers": true }` | `["version", "2", "beta"]` | — | `["version", "2", "beta"]` | `["version", "2", "beta"]` | `["version", "2", "beta"]` | — | `["version", "2", "beta"]` | `["version", "2", "beta"]` |
| `"2fast4you", { "splitNumbers": true }` | `["2", "fast", "4", "you"]` | — | `["2", "fast", "4", "you"]` | `["2", "fast", "4", "you"]` | `["2", "fast", "4", "you"]` | — | `["2", "fast", "4", "you"]` | `["2", "fast", "4", "you"]` |
| `"x²", { "splitNumbers": true }` | `["x", "²"]` | — | `["x"]` | `["x"]` | `["x"]` | — | `["x", "²"]` | `["x"]` |
| `"fooBarBaz", { "splitNumbers": true }` | `["foo", "Bar", "Baz"]` | — | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` | — | `["foo", "Bar", "Baz"]` | `["foo", "Bar", "Baz"]` |
| `"_private", { "keepOuterUnderscores": false }` | `["private"]` | `["private"]` | — | `["private"]` | `["private"]` | `["", "private"]` | `["private"]` | `["private"]` |
| `"_private", { "keepOuterUnderscores": true }` | `["_private"]` | — | — | — | — | — | — | — |
| `"_private_key", { "keepOuterUnderscores": true }` | `["_private", "key"]` | — | — | — | — | — | — | — |
| `"__foo_bar__", { "keepOuterUnderscores": true }` | `["__foo", "bar__"]` | — | — | — | — | — | — | — |
| `"__init__", { "keepOuterUnderscores": true }` | `["__init__"]` | — | — | — | — | — | — | — |
| `"___", { "keepOuterUnderscores": true }` | `["___"]` | — | — | — | — | — | — | — |
| `"foo__bar", { "keepOuterUnderscores": true }` | `["foo", "bar"]` | — | — | — | — | — | — | — |
| `"fooBar", { "keepOuterUnderscores": true }` | `["foo", "Bar"]` | — | — | — | — | — | — | — |
| `‹a boxed string›` | `["hi"]` | `["hi"]` | — | `["hi"]` | `["hi"]` | `[]` | `["hi"]` | `["hi"]` |
| `42` | `[]` | 💥 `TypeError` | — | 💥 `TypeError` | `["42"]` | `[]` | 💥 `TypeError` | `["42"]` |
| `null` | `[]` | 💥 `TypeError` | — | 💥 `TypeError` | `[]` | `[]` | 💥 `TypeError` | `[]` |
| `undefined` | `[]` | 💥 `TypeError` | — | 💥 `TypeError` | `[]` | `[]` | 💥 `TypeError` | `[]` |
| `‹a symbol›` | `[]` | 💥 `TypeError` | — | 💥 `TypeError` | `["Symbol", "hostile"]` | `[]` | 💥 `TypeError` | `["Symbol", "hostile"]` |
| `‹an object with a throwing toString›` | `[]` | 💥 `TypeError` | — | 💥 `TypeError` | 💥 `Error` | `[]` | 💥 `TypeError` | 💥 `Error` |
<!-- prettier-ignore-end -->

### camelCase

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`camelCase` | case-anything<br>`camelCase(value)` | change-case<br>`camelCase(value, { prefixCharacters: "_", suffixCharacters: "_" })` | change-case<br>`camelCase(value, { split: splitSeparateNumbers })` | change-case<br>`camelCase(value)` | es-toolkit<br>`camelCase(value)` | lodash<br>`camelCase(value)` | radash<br>`camel(value)` | remeda<br>`toCamelCase(value)` | scule<br>`camelCase(value)` | string-ts<br>`camelCase(value)` | Voca<br>`v.camelCase(value)` | .NET<br>`JsonNamingPolicy.CamelCase.ConvertName(value)` | Guava<br>`CaseFormat.UPPER_CAMEL.to(CaseFormat.LOWER_CAMEL, value)` | Jackson<br>`PropertyNamingStrategies.LOWER_CAMEL_CASE.nameForField(null, null, value)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` |
| `"FooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"FooBarBaz"` |
| `"foo_bar_baz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo_bar_baz"` | `"foo_bar_baz"` | `"foo_bar_baz"` |
| `"foo-bar-baz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo-bar-baz"` | `"foo-bar-baz"` | `"foo-bar-baz"` |
| `"foo bar baz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo bar baz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo bar baz"` | `"foo bar baz"` | `"foo bar baz"` |
| `"FOO_BAR_BAZ"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fOOBARBAZ"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foO_BAR_BAZ"` | `"fOO_BAR_BAZ"` | `"FOO_BAR_BAZ"` |
| `"Foo Bar Baz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo Bar Baz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo Bar Baz"` | `"foo Bar Baz"` | `"Foo Bar Baz"` |
| `"foo.bar/baz"` | `"fooBarBaz"` | `"fooBarBaz"` | — | — | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBar/baz"` | `"foo.bar/baz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"fooBarBaz"` | `"foo.bar/baz"` | `"foo.bar/baz"` | `"foo.bar/baz"` |
| `"XMLHttpRequest"` | `"xmlHttpRequest"` | `"xmlHttpRequest"` | — | — | `"xmlHttpRequest"` | `"xmlHttpRequest"` | `"xmlHttpRequest"` | `"xmlhttpRequest"` | `"xMLHttpRequest"` | `"xMLHttpRequest"` | `"xmlHttpRequest"` | `"xmlHttpRequest"` | `"xmlHttpRequest"` | `"xMLHttpRequest"` | `"XMLHttpRequest"` |
| `"IOError"` | `"ioError"` | `"ioError"` | — | — | `"ioError"` | `"ioError"` | `"ioError"` | `"ioerror"` | `"iOError"` | `"iOError"` | `"ioError"` | `"ioError"` | `"ioError"` | `"iOError"` | `"IOError"` |
| `"userID"` | `"userId"` | `"userId"` | — | — | `"userId"` | `"userId"` | `"userId"` | `"userId"` | `"userID"` | `"userID"` | `"userId"` | `"userId"` | `"userID"` | `"userID"` | `"userID"` |
| `"iPhone"` | `"iPhone"` | `"iPhone"` | — | — | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` | `"iPhone"` |
| `"ABC"` | `"abc"` | `"abc"` | — | — | `"abc"` | `"abc"` | `"abc"` | `"abc"` | `"abc"` | `"aBC"` | `"abc"` | `"abc"` | `"abc"` | `"aBC"` | `"ABC"` |
| `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | — | — | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` | `"version2Beta"` |
| `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | — | — | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` | `"base64Encode"` |
| `"HTML5Parser"` | `"html5Parser"` | `"html5Parser"` | — | — | `"html5Parser"` | `"html5Parser"` | `"html5Parser"` | `"html5Parser"` | `"hTML5Parser"` | `"hTML5Parser"` | `"html5Parser"` | `"html5Parser"` | `"htmL5Parser"` | `"hTML5Parser"` | `"HTML5Parser"` |
| `"ABC123Def"` | `"abc123Def"` | `"abc123Def"` | — | — | `"abc123Def"` | `"abc123Def"` | `"abc123Def"` | `"abc123Def"` | `"aBC123Def"` | `"aBC123Def"` | `"abc123Def"` | `"abc123Def"` | `"abC123Def"` | `"aBC123Def"` | `"ABC123Def"` |
| `"v1.2.3"` | `"v123"` | `"v123"` | — | — | `"v1_2_3"` | `"v123"` | `"v123"` | `"v123"` | `"v1.2.3"` | `"v123"` | `"v123"` | `"v123"` | `"v1.2.3"` | `"v1.2.3"` | `"v1.2.3"` |
| `"don't stop"` | `"dontStop"` | `"dontStop"` | — | — | `"donTStop"` | `"donTStop"` | `"dontStop"` | `"don'tStop"` | `"don'tStop"` | `"don't stop"` | `"dontStop"` | `"donTStop"` | `"don't stop"` | `"don't stop"` | `"don't stop"` |
| `"the lord of the rings"` | `"theLordOfTheRings"` | `"theLordOfTheRings"` | — | — | `"theLordOfTheRings"` | `"theLordOfTheRings"` | `"theLordOfTheRings"` | `"theLordOfTheRings"` | `"theLordOfTheRings"` | `"the lord of the rings"` | `"theLordOfTheRings"` | `"theLordOfTheRings"` | `"the lord of the rings"` | `"the lord of the rings"` | `"the lord of the rings"` |
| `"foo__bar"` | `"fooBar"` | `"fooBar"` | — | — | `"fooBar"` | `"fooBar"` | `"fooBar"` | `"fooBar"` | `"fooBar"` | `"fooBar"` | `"fooBar"` | `"fooBar"` | `"foo__bar"` | `"foo__bar"` | `"foo__bar"` |
| `"_private"` | `"private"` | `"private"` | — | — | `"private"` | `"private"` | `"private"` | `"Private"` | `"private"` | `"private"` | `"private"` | `"private"` | `"_private"` | `"_private"` | `"_private"` |
| `"  padded  "` | `"padded"` | `"padded"` | — | — | `"padded"` | `"padded"` | `"padded"` | `"Padded"` | `"padded"` | `"  padded  "` | `"padded"` | `"padded"` | `"  padded  "` | `"  padded  "` | `"  padded  "` |
| `"c++ code"` | `"c++Code"` | `"cCode"` | — | — | `"cCode"` | `"cCode"` | `"cCode"` | `"c++Code"` | `"c++Code"` | `"c++ code"` | `"c++Code"` | `"cCode"` | `"c++ code"` | `"c++ code"` | `"c++ code"` |
| `"a+b"` | `"a+B"` | `"aB"` | — | — | `"aB"` | `"aB"` | `"aB"` | `"a+b"` | `"a+b"` | `"a+b"` | `"a+B"` | `"aB"` | `"a+b"` | `"a+b"` | `"a+b"` |
| `"price$"` | `"price$"` | `"price"` | — | — | `"price"` | `"price"` | `"price"` | `"price$"` | `"price$"` | `"price$"` | `"price$"` | `"price"` | `"price$"` | `"price$"` | `"price$"` |
| `"20°C"` | `"20°C"` | `"20C"` | — | — | `"20C"` | `"20C"` | `"20C"` | `"20°C"` | `"20°c"` | `"20°C"` | `"20°C"` | `"20C"` | `"20°C"` | `"20°C"` | `"20°C"` |
| `"userIDs"` | `"userIDs"` | `"userIDs"` | — | — | `"userIDs"` | `"userIDs"` | `"userIDs"` | `"userIds"` | `"userIDs"` | `"userIDs"` | `"userIDs"` | `"userIDs"` | `"userIDs"` | `"userIDs"` | `"userIDs"` |
| `"iOSApp"` | `"iOsApp"` | `"iOsApp"` | — | — | `"iOsApp"` | `"iOsApp"` | `"iOsApp"` | `"iOsapp"` | `"iOSApp"` | `"iOSApp"` | `"iOsApp"` | `"iOsApp"` | `"iOSApp"` | `"iOSApp"` | `"iOSApp"` |
| `"version2beta"` | `"version2beta"` | `"version2Beta"` | — | — | `"version2beta"` | `"version2Beta"` | `"version2Beta"` | `"version2beta"` | `"version2Beta"` | `"version2beta"` | `"version2Beta"` | `"version2Beta"` | `"version2beta"` | `"version2beta"` | `"version2beta"` |
| `"2fast4you"` | `"2fast4you"` | `"2Fast4You"` | — | — | `"2fast4you"` | `"2Fast4You"` | `"2Fast4You"` | `"2fast4you"` | `"2Fast4You"` | `"2fast4you"` | `"2Fast4You"` | `"2Fast4You"` | `"2fast4you"` | `"2fast4you"` | `"2fast4you"` |
| `"ÉcoleNormale"` | `"écoleNormale"` | `"ecoleNormale"` | — | — | `"écoleNormale"` | `"écoleNormale"` | `"ecoleNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"éColeNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"ÉcoleNormale"` | `"ÉcoleNormale"` |
| `"écoleNormale"` | `"écoleNormale"` | `"ecoleNormale"` | — | — | `"eColeNormale"` | `"eColeNormale"` | `"ecoleNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"éColeNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"écoleNormale"` | `"écoleNormale"` |
| `"straße"` | `"straße"` | `"straSSe"` | — | — | `"straße"` | `"straße"` | `"strasse"` | `"straße"` | `"straße"` | `"straße"` | `"straSSE"` | `"straße"` | `"straße"` | `"straße"` | `"straße"` |
| `"İstanbul"` | `"i̇stanbul"` | `"stanbul"` | — | — | `"i̇stanbul"` | `"i̇stanbul"` | `"istanbul"` | `"i̇stanbul"` | `"i̇stanbul"` | `"i̇stanbul"` | `"i̇Stanbul"` | `"i̇stanbul"` | `"İstanbul"` | `"İstanbul"` | `"İstanbul"` |
| `"ǅemal"` | `"ǆemal"` | `"emal"` | — | — | `"ǆemal"` | `"ǆemal"` | `"ǆemal"` | `"ǆemal"` | `"ǆemal"` | `"ǆemal"` | `"ǆEmal"` | `"ǆemal"` | `"ǅemal"` | `"ǅemal"` | `"ǅemal"` |
| `"日本語Text"` | `"日本語Text"` | `"text"` | — | — | `"日本語text"` | `"日本語text"` | `"日本語Text"` | `"日本語Text"` | `"日本語Text"` | `"日本語Text"` | `"日本語Text"` | `"日本語text"` | `"日本語Text"` | `"日本語Text"` | `"日本語Text"` |
| `"emoji😀Face"` | `"emoji😀Face"` | `"emojiFace"` | — | — | `"emojiFace"` | `"emoji😀Face"` | `"emoji😀Face"` | `"emoji😀Face"` | `"emoji😀Face"` | `"emoji😀Face"` | `"emoji😀Face"` | `"emoji😀face"` | `"emoji😀Face"` | `"emoji😀Face"` | `"emoji😀Face"` |
| `"👩\u{200D}💻dev"` | `"👩\u{200D}💻Dev"` | `"dev"` | — | — | `"dev"` | `"👩💻Dev"` | `"👩\u{200D}💻Dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻Dev"` | `"👩💻dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻dev"` |
| `"a"` | `"a"` | `"a"` | — | — | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` |
| `""` | `""` | `""` | — | — | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` |
| `"version2Beta", { "splitNumbers": false }` | `"version2Beta"` | — | — | — | `"version2Beta"` | — | — | `"version2Beta"` | — | `"version2Beta"` | — | — | — | — | — |
| `"version2Beta", { "splitNumbers": true }` | `"version2Beta"` | `"version2Beta"` | — | `"version_2Beta"` | — | `"version2Beta"` | `"version2Beta"` | — | `"version2Beta"` | — | `"version2Beta"` | `"version2Beta"` | — | — | — |
| `"base64Encode", { "splitNumbers": true }` | `"base64Encode"` | `"base64Encode"` | — | `"base_64Encode"` | — | `"base64Encode"` | `"base64Encode"` | — | `"base64Encode"` | — | `"base64Encode"` | `"base64Encode"` | — | — | — |
| `"HTML5Parser", { "splitNumbers": true }` | `"html5Parser"` | `"html5Parser"` | — | `"html_5Parser"` | — | `"html5Parser"` | `"html5Parser"` | — | `"hTML5Parser"` | — | `"html5Parser"` | `"html5Parser"` | — | — | — |
| `"ABC123Def", { "splitNumbers": true }` | `"abc123Def"` | `"abc123Def"` | — | `"abc_123Def"` | — | `"abc123Def"` | `"abc123Def"` | — | `"aBC123Def"` | — | `"abc123Def"` | `"abc123Def"` | — | — | — |
| `"v1.2.3", { "splitNumbers": true }` | `"v123"` | `"v123"` | — | `"v_1_2_3"` | — | `"v123"` | `"v123"` | — | `"v1.2.3"` | — | `"v123"` | `"v123"` | — | — | — |
| `"utf8", { "splitNumbers": true }` | `"utf8"` | `"utf8"` | — | `"utf_8"` | — | `"utf8"` | `"utf8"` | — | `"utf8"` | — | `"utf8"` | `"utf8"` | — | — | — |
| `"version2beta", { "splitNumbers": true }` | `"version2Beta"` | `"version2Beta"` | — | `"version_2Beta"` | — | `"version2Beta"` | `"version2Beta"` | — | `"version2Beta"` | — | `"version2Beta"` | `"version2Beta"` | — | — | — |
| `"2fast4you", { "splitNumbers": true }` | `"2Fast4You"` | `"2Fast4You"` | — | `"2Fast_4You"` | — | `"2Fast4You"` | `"2Fast4You"` | — | `"2Fast4You"` | — | `"2Fast4You"` | `"2Fast4You"` | — | — | — |
| `"x²", { "splitNumbers": true }` | `"x²"` | `"x"` | — | `"x"` | — | `"x"` | `"x"` | — | `"x²"` | — | `"x²"` | `"x"` | — | — | — |
| `"fooBarBaz", { "splitNumbers": true }` | `"fooBarBaz"` | `"fooBarBaz"` | — | `"fooBarBaz"` | — | `"fooBarBaz"` | `"fooBarBaz"` | — | `"fooBarBaz"` | — | `"fooBarBaz"` | `"fooBarBaz"` | — | — | — |
| `"_private", { "keepOuterUnderscores": false }` | `"private"` | `"private"` | — | — | `"private"` | `"private"` | `"private"` | `"Private"` | `"private"` | `"private"` | `"private"` | `"private"` | — | — | — |
| `"_private", { "keepOuterUnderscores": true }` | `"_private"` | — | `"_private"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `"_private_key", { "keepOuterUnderscores": true }` | `"_privateKey"` | — | `"_privateKey"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `"__foo_bar__", { "keepOuterUnderscores": true }` | `"__fooBar__"` | — | `"__fooBar__"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `"__init__", { "keepOuterUnderscores": true }` | `"__init__"` | — | `"__init__"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `"___", { "keepOuterUnderscores": true }` | `"___"` | — | `"___"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `"foo__bar", { "keepOuterUnderscores": true }` | `"fooBar"` | — | `"fooBar"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `"fooBar", { "keepOuterUnderscores": true }` | `"fooBar"` | — | `"fooBar"` | — | — | — | — | — | — | — | — | — | — | — | — |
| `‹a boxed string›` | `"hi"` | `"hi"` | — | — | `"hi"` | `"hi"` | `"hi"` | `"hi"` | `‹function›` | `""` | `"hi"` | `"hi"` | — | — | — |
| `42` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `"42"` | 💥 `TypeError` | `‹function›` | `""` | 💥 `TypeError` | `"42"` | — | — | — |
| `null` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `""` | `""` | `‹function›` | `""` | 💥 `TypeError` | `""` | — | — | — |
| `undefined` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `""` | `""` | `‹function›` | `""` | 💥 `TypeError` | `""` | — | — | — |
| `‹a symbol›` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `"symbolHostile"` | 💥 `TypeError` | `‹function›` | `""` | 💥 `TypeError` | `"symbolHostile"` | — | — | — |
| `‹an object with a throwing toString›` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | 💥 `Error` | 💥 `TypeError` | `‹function›` | `""` | 💥 `TypeError` | 💥 `Error` | — | — | — |
<!-- prettier-ignore-end -->

### titleCase

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`titleCase` | case-anything<br>`capitalCase(value)` | change-case<br>`capitalCase(value, { prefixCharacters: "_", suffixCharacters: "_" })` | change-case<br>`capitalCase(value, { split: splitSeparateNumbers })` | change-case<br>`capitalCase(value)` | es-toolkit<br>`startCase(value)` | lodash<br>`startCase(value)` | radash<br>`title(value)` | remeda<br>`toTitleCase(value)` | scule<br>`titleCase(value)` | string-ts<br>`titleCase(value)` | Voca<br>`v.titleCase(value)` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"fooBarBaz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"FooBarBaz"` |
| `"FooBarBaz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"FooBarBaz"` |
| `"foo_bar_baz"` | `"Foo Bar Baz"` | `"Foo_Bar_Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo_Bar_Baz"` |
| `"foo-bar-baz"` | `"Foo Bar Baz"` | `"Foo-Bar-Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo-Bar-Baz"` |
| `"foo bar baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo bar baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` |
| `"FOO_BAR_BAZ"` | `"Foo Bar Baz"` | `"Foo_Bar_Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"FOO BAR BAZ"` | `"F O O B A R B A Z"` | `"Foo Bar Baz"` | `"FOO BAR BAZ"` | `"Foo Bar Baz"` | `"Foo_Bar_Baz"` |
| `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo  Bar  Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` |
| `"foo.bar/baz"` | `"Foo Bar Baz"` | `"Foo.Bar/Baz"` | — | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo Bar/baz"` | `"Foo.bar/baz"` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | `"Foo.Bar/Baz"` |
| `"XMLHttpRequest"` | `"Xml Http Request"` | `"Xml Http Request"` | — | — | `"Xml Http Request"` | `"Xml Http Request"` | `"XML Http Request"` | `"X M L Http Request"` | `"XML Http Request"` | `"XML Http Request"` | `"Xml Http Request"` | `"XmlHttpRequest"` |
| `"IOError"` | `"Io Error"` | `"Io Error"` | — | — | `"Io Error"` | `"Io Error"` | `"IO Error"` | `"I O Error"` | `"IO Error"` | `"IO Error"` | `"Io Error"` | `"IoError"` |
| `"userID"` | `"User Id"` | `"User Id"` | — | — | `"User Id"` | `"User Id"` | `"User ID"` | `"User I D"` | `"User ID"` | `"User ID"` | `"User Id"` | `"UserId"` |
| `"iPhone"` | `"I Phone"` | `"I Phone"` | — | — | `"I Phone"` | `"I Phone"` | `"I Phone"` | `"I Phone"` | `"I Phone"` | `"I Phone"` | `"I Phone"` | `"IPhone"` |
| `"ABC"` | `"Abc"` | `"Abc"` | — | — | `"Abc"` | `"Abc"` | `"ABC"` | `"A B C"` | `"Abc"` | `"ABC"` | `"Abc"` | `"Abc"` |
| `"version2Beta"` | `"Version2 Beta"` | `"Version 2 Beta"` | — | — | `"Version2 Beta"` | `"Version 2 Beta"` | `"Version 2 Beta"` | `"Version2 Beta"` | `"Version 2 Beta"` | `"Version2 Beta"` | `"Version 2 Beta"` | `"Version2Beta"` |
| `"base64Encode"` | `"Base64 Encode"` | `"Base 64 Encode"` | — | — | `"Base64 Encode"` | `"Base 64 Encode"` | `"Base 64 Encode"` | `"Base64 Encode"` | `"Base 64 Encode"` | `"Base64 Encode"` | `"Base 64 Encode"` | `"Base64Encode"` |
| `"HTML5Parser"` | `"Html5 Parser"` | `"Html 5 Parser"` | — | — | `"Html5 Parser"` | `"Html 5 Parser"` | `"HTML 5 Parser"` | `"H T M L5 Parser"` | `"HTML 5 Parser"` | `"HTML5 Parser"` | `"Html 5 Parser"` | `"Html5Parser"` |
| `"ABC123Def"` | `"Abc123 Def"` | `"Abc 123 Def"` | — | — | `"Abc123 Def"` | `"Abc 123 Def"` | `"ABC 123 Def"` | `"A B C123 Def"` | `"ABC 123 Def"` | `"ABC123 Def"` | `"Abc 123 Def"` | `"Abc123Def"` |
| `"v1.2.3"` | `"V1 2 3"` | `"V 1.2.3"` | — | — | `"V1 2 3"` | `"V 1 2 3"` | `"V 1 2 3"` | `"V1 2 3"` | `"V 1 . 2 . 3"` | `"V1 2 3"` | `"V 123"` | `"V1.2.3"` |
| `"don't stop"` | `"Don't Stop"` | `"Don't Stop"` | — | — | `"Don T Stop"` | `"Don T Stop"` | `"Dont Stop"` | `"Don't Stop"` | `"Don't Stop"` | `"Don't stop"` | `"Dont Stop"` | `"Don'T Stop"` |
| `"the lord of the rings"` | `"The Lord Of The Rings"` | `"The Lord Of The Rings"` | — | — | `"The Lord Of The Rings"` | `"The Lord Of The Rings"` | `"The Lord Of The Rings"` | `"The Lord Of The Rings"` | `"The Lord Of The Rings"` | `"The lord of the rings"` | `"The Lord Of The Rings"` | `"The Lord Of The Rings"` |
| `"foo__bar"` | `"Foo Bar"` | `"Foo__Bar"` | — | — | `"Foo Bar"` | `"Foo Bar"` | `"Foo Bar"` | `"Foo Bar"` | `"Foo Bar"` | `"Foo Bar"` | `"Foo Bar"` | `"Foo__Bar"` |
| `"_private"` | `"Private"` | `"_Private"` | — | — | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"_Private"` |
| `"  padded  "` | `"Padded"` | `"Padded"` | — | — | `"Padded"` | `"Padded"` | `"Padded"` | `"Padded"` | `"Padded"` | `"  padded  "` | `"Padded"` | `"  Padded  "` |
| `"c++ code"` | `"C ++ Code"` | `"C++ Code"` | — | — | `"C Code"` | `"C Code"` | `"C Code"` | `"C++ Code"` | `"C++ Code"` | `"C++ code"` | `"C ++ Code"` | `"C++ Code"` |
| `"a+b"` | `"A + B"` | `"A+B"` | — | — | `"A B"` | `"A B"` | `"A B"` | `"A+b"` | `"A+b"` | `"A+b"` | `"A + B"` | `"A+B"` |
| `"price$"` | `"Price $"` | `"Price$"` | — | — | `"Price"` | `"Price"` | `"Price"` | `"Price$"` | `"Price$"` | `"Price$"` | `"Price $"` | `"Price$"` |
| `"20°C"` | `"20 ° C"` | `"20°C"` | — | — | `"20 C"` | `"20 C"` | `"20 C"` | `"20° C"` | `"20 °c"` | `"20° C"` | `"20 ° C"` | `"20°C"` |
| `"userIDs"` | `"User I Ds"` | `"User I Ds"` | — | — | `"User I Ds"` | `"User I Ds"` | `"User I Ds"` | `"User I Ds"` | `"User I Ds"` | `"User I Ds"` | `"User I Ds"` | `"UserIDs"` |
| `"iOSApp"` | `"I Os App"` | `"I Os App"` | — | — | `"I Os App"` | `"I Os App"` | `"I OS App"` | `"I O S App"` | `"I OS App"` | `"I OS App"` | `"I Os App"` | `"IOsApp"` |
| `"version2beta"` | `"Version2beta"` | `"Version 2 Beta"` | — | — | `"Version2beta"` | `"Version 2 Beta"` | `"Version 2 Beta"` | `"Version2beta"` | `"Version 2 Beta"` | `"Version2beta"` | `"Version 2 Beta"` | `"Version2Beta"` |
| `"2fast4you"` | `"2fast4you"` | `"2 Fast 4 You"` | — | — | `"2fast4you"` | `"2 Fast 4 You"` | `"2 Fast 4 You"` | `"2fast4you"` | `"2 Fast 4 You"` | `"2fast4you"` | `"2 Fast 4 You"` | `"2Fast4You"` |
| `"ÉcoleNormale"` | `"École Normale"` | `"École Normale"` | — | — | `"École Normale"` | `"École Normale"` | `"Ecole Normale"` | `"École Normale"` | `"École Normale"` | `"École Normale"` | `"É Cole Normale"` | `"ÉcoleNormale"` |
| `"écoleNormale"` | `"École Normale"` | `"École Normale"` | — | — | `"E Cole Normale"` | `"E Cole Normale"` | `"Ecole Normale"` | `"École Normale"` | `"École Normale"` | `"École Normale"` | `"E ́ Cole Normale"` | `"ÉcoleNormale"` |
| `"straße"` | `"Straße"` | `"Stra SSe"` | — | — | `"Straße"` | `"Straße"` | `"Strasse"` | `"Straße"` | `"Straße"` | `"Straße"` | `"Stra SSE"` | `"Straße"` |
| `"İstanbul"` | `"İstanbul"` | `"İStanbul"` | — | — | `"İstanbul"` | `"İstanbul"` | `"Istanbul"` | `"İstanbul"` | `"İstanbul"` | `"İstanbul"` | `"I ̇ Stanbul"` | `"İstanbul"` |
| `"ǅemal"` | `"Ǆemal"` | `"ǄEmal"` | — | — | `"Ǆemal"` | `"Ǆemal"` | `"Ǆemal"` | `"Ǆemal"` | `"Ǆemal"` | `"Ǆemal"` | `"Ǆ Emal"` | `"Ǆemal"` |
| `"日本語Text"` | `"日本語 Text"` | `"日本語Text"` | — | — | `"日本語text"` | `"日本語text"` | `"日本語 Text"` | `"日本語 Text"` | `"日本語Text"` | `"日本語 Text"` | `"日本語 Text"` | `"日本語text"` |
| `"emoji😀Face"` | `"Emoji 😀 Face"` | `"Emoji😀Face"` | — | — | `"Emoji Face"` | `"Emoji 😀 Face"` | `"Emoji 😀 Face"` | `"Emoji😀 Face"` | `"Emoji😀Face"` | `"Emoji😀 Face"` | `"Emoji 😀 Face"` | `"Emoji😀face"` |
| `"👩\u{200D}💻dev"` | `"👩\u{200D}💻 Dev"` | `"👩\u{200D}💻Dev"` | — | — | `"Dev"` | `"👩 💻 Dev"` | `"👩\u{200D}💻 Dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻dev"` | `"👩\u{200D}💻 Dev"` | `"👩\u{200D}💻dev"` |
| `"a"` | `"A"` | `"A"` | — | — | `"A"` | `"A"` | `"A"` | `"A"` | `"A"` | `"a"` | `"A"` | `"A"` |
| `""` | `""` | `""` | — | — | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` |
| `"version2Beta", { "splitNumbers": false }` | `"Version2 Beta"` | — | — | — | `"Version2 Beta"` | — | — | `"Version2 Beta"` | — | `"Version2 Beta"` | — | `"Version2Beta"` |
| `"version2Beta", { "splitNumbers": true }` | `"Version 2 Beta"` | `"Version 2 Beta"` | — | `"Version 2 Beta"` | — | `"Version 2 Beta"` | `"Version 2 Beta"` | — | `"Version 2 Beta"` | — | `"Version 2 Beta"` | — |
| `"base64Encode", { "splitNumbers": true }` | `"Base 64 Encode"` | `"Base 64 Encode"` | — | `"Base 64 Encode"` | — | `"Base 64 Encode"` | `"Base 64 Encode"` | — | `"Base 64 Encode"` | — | `"Base 64 Encode"` | — |
| `"HTML5Parser", { "splitNumbers": true }` | `"Html 5 Parser"` | `"Html 5 Parser"` | — | `"Html 5 Parser"` | — | `"Html 5 Parser"` | `"HTML 5 Parser"` | — | `"HTML 5 Parser"` | — | `"Html 5 Parser"` | — |
| `"ABC123Def", { "splitNumbers": true }` | `"Abc 123 Def"` | `"Abc 123 Def"` | — | `"Abc 123 Def"` | — | `"Abc 123 Def"` | `"ABC 123 Def"` | — | `"ABC 123 Def"` | — | `"Abc 123 Def"` | — |
| `"v1.2.3", { "splitNumbers": true }` | `"V 1 2 3"` | `"V 1.2.3"` | — | `"V 1 2 3"` | — | `"V 1 2 3"` | `"V 1 2 3"` | — | `"V 1 . 2 . 3"` | — | `"V 123"` | — |
| `"utf8", { "splitNumbers": true }` | `"Utf 8"` | `"Utf 8"` | — | `"Utf 8"` | — | `"Utf 8"` | `"Utf 8"` | — | `"Utf 8"` | — | `"Utf 8"` | — |
| `"version2beta", { "splitNumbers": true }` | `"Version 2 Beta"` | `"Version 2 Beta"` | — | `"Version 2 Beta"` | — | `"Version 2 Beta"` | `"Version 2 Beta"` | — | `"Version 2 Beta"` | — | `"Version 2 Beta"` | — |
| `"2fast4you", { "splitNumbers": true }` | `"2 Fast 4 You"` | `"2 Fast 4 You"` | — | `"2 Fast 4 You"` | — | `"2 Fast 4 You"` | `"2 Fast 4 You"` | — | `"2 Fast 4 You"` | — | `"2 Fast 4 You"` | — |
| `"x²", { "splitNumbers": true }` | `"X ²"` | `"X²"` | — | `"X"` | — | `"X"` | `"X"` | — | `"X²"` | — | `"X ²"` | — |
| `"fooBarBaz", { "splitNumbers": true }` | `"Foo Bar Baz"` | `"Foo Bar Baz"` | — | `"Foo Bar Baz"` | — | `"Foo Bar Baz"` | `"Foo Bar Baz"` | — | `"Foo Bar Baz"` | — | `"Foo Bar Baz"` | — |
| `"_private", { "keepOuterUnderscores": false }` | `"Private"` | `"_Private"` | — | — | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"Private"` | `"_Private"` |
| `"_private", { "keepOuterUnderscores": true }` | `"_Private"` | — | `"_Private"` | — | — | — | — | — | — | — | — | — |
| `"_private_key", { "keepOuterUnderscores": true }` | `"_Private Key"` | — | `"_Private Key"` | — | — | — | — | — | — | — | — | — |
| `"__foo_bar__", { "keepOuterUnderscores": true }` | `"__Foo Bar__"` | — | `"__Foo Bar__"` | — | — | — | — | — | — | — | — | — |
| `"__init__", { "keepOuterUnderscores": true }` | `"__Init__"` | — | `"__Init__"` | — | — | — | — | — | — | — | — | — |
| `"___", { "keepOuterUnderscores": true }` | `"___"` | — | `"___"` | — | — | — | — | — | — | — | — | — |
| `"foo__bar", { "keepOuterUnderscores": true }` | `"Foo Bar"` | — | `"Foo Bar"` | — | — | — | — | — | — | — | — | — |
| `"fooBar", { "keepOuterUnderscores": true }` | `"Foo Bar"` | — | `"Foo Bar"` | — | — | — | — | — | — | — | — | — |
| `‹a boxed string›` | `"Hi"` | `"Hi"` | — | — | `"Hi"` | `"Hi"` | `"Hi"` | `"Hi"` | `‹function›` | `""` | `"Hi"` | `"Hi"` |
| `42` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `"42"` | 💥 `TypeError` | `‹function›` | `""` | 💥 `TypeError` | `"42"` |
| `null` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `""` | `""` | `‹function›` | `""` | 💥 `TypeError` | `""` |
| `undefined` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `""` | `""` | `‹function›` | `""` | 💥 `TypeError` | `""` |
| `‹a symbol›` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | `"Symbol Hostile"` | 💥 `TypeError` | `‹function›` | `""` | 💥 `TypeError` | `"Symbol(Hostile)"` |
| `‹an object with a throwing toString›` | `""` | 💥 `TypeError` | — | — | 💥 `TypeError` | 💥 `TypeError` | 💥 `Error` | 💥 `TypeError` | `‹function›` | `""` | 💥 `TypeError` | 💥 `Error` |
<!-- prettier-ignore-end -->

### sentenceCase

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`sentenceCase` | change-case<br>`sentenceCase(value, { prefixCharacters: "_", suffixCharacters: "_" })` | change-case<br>`sentenceCase(value, { split: splitSeparateNumbers })` | change-case<br>`sentenceCase(value)` | humanize-string<br>`humanizeString(value)` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `"fooBarBaz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"FooBarBaz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"foo_bar_baz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"foo-bar-baz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"foo bar baz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"FOO_BAR_BAZ"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"Foo Bar Baz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo bar baz"` |
| `"foo.bar/baz"` | `"Foo bar baz"` | — | — | `"Foo bar baz"` | `"Foo.bar/baz"` |
| `"XMLHttpRequest"` | `"Xml http request"` | — | — | `"Xml http request"` | `"Xml http request"` |
| `"IOError"` | `"Io error"` | — | — | `"Io error"` | `"Io error"` |
| `"userID"` | `"User id"` | — | — | `"User id"` | `"User id"` |
| `"iPhone"` | `"I phone"` | — | — | `"I phone"` | `"I phone"` |
| `"ABC"` | `"Abc"` | — | — | `"Abc"` | `"Abc"` |
| `"version2Beta"` | `"Version2 beta"` | — | — | `"Version2 beta"` | `"Version2 beta"` |
| `"base64Encode"` | `"Base64 encode"` | — | — | `"Base64 encode"` | `"Base64 encode"` |
| `"HTML5Parser"` | `"Html5 parser"` | — | — | `"Html5 parser"` | `"Html5 parser"` |
| `"ABC123Def"` | `"Abc123 def"` | — | — | `"Abc123 def"` | `"Abc123 def"` |
| `"v1.2.3"` | `"V1 2 3"` | — | — | `"V1 2 3"` | `"V1.2.3"` |
| `"don't stop"` | `"Don't stop"` | — | — | `"Don t stop"` | `"Don't stop"` |
| `"the lord of the rings"` | `"The lord of the rings"` | — | — | `"The lord of the rings"` | `"The lord of the rings"` |
| `"foo__bar"` | `"Foo bar"` | — | — | `"Foo bar"` | `"Foo bar"` |
| `"_private"` | `"Private"` | — | — | `"Private"` | `"Private"` |
| `"  padded  "` | `"Padded"` | — | — | `"Padded"` | `"Padded"` |
| `"c++ code"` | `"C ++ code"` | — | — | `"C code"` | `"C++ code"` |
| `"a+b"` | `"A + b"` | — | — | `"A b"` | `"A+b"` |
| `"price$"` | `"Price $"` | — | — | `"Price"` | `"Price$"` |
| `"20°C"` | `"20 ° c"` | — | — | `"20 c"` | `"20°c"` |
| `"userIDs"` | `"User i ds"` | — | — | `"User i ds"` | `"User ids"` |
| `"iOSApp"` | `"I os app"` | — | — | `"I os app"` | `"I os app"` |
| `"version2beta"` | `"Version2beta"` | — | — | `"Version2beta"` | `"Version2beta"` |
| `"2fast4you"` | `"2fast4you"` | — | — | `"2fast4you"` | `"2fast4you"` |
| `"ÉcoleNormale"` | `"École normale"` | — | — | `"École normale"` | `"École normale"` |
| `"écoleNormale"` | `"École normale"` | — | — | `"E cole normale"` | `"École normale"` |
| `"straße"` | `"Straße"` | — | — | `"Straße"` | `"Straße"` |
| `"İstanbul"` | `"İstanbul"` | — | — | `"İstanbul"` | `"İstanbul"` |
| `"ǅemal"` | `"Ǆemal"` | — | — | `"Ǆemal"` | `"ǅemal"` |
| `"日本語Text"` | `"日本語 text"` | — | — | `"日本語text"` | `"日本語text"` |
| `"emoji😀Face"` | `"Emoji 😀 face"` | — | — | `"Emoji face"` | `"Emoji😀face"` |
| `"👩\u{200D}💻dev"` | `"👩\u{200D}💻 dev"` | — | — | `"Dev"` | `"👩\u{200D}💻dev"` |
| `"a"` | `"A"` | — | — | `"A"` | `"A"` |
| `""` | `""` | — | — | `""` | `""` |
| `"version2Beta", { "splitNumbers": false }` | `"Version2 beta"` | — | — | `"Version2 beta"` | `"Version2 beta"` |
| `"version2Beta", { "splitNumbers": true }` | `"Version 2 beta"` | — | `"Version 2 beta"` | — | — |
| `"base64Encode", { "splitNumbers": true }` | `"Base 64 encode"` | — | `"Base 64 encode"` | — | — |
| `"HTML5Parser", { "splitNumbers": true }` | `"Html 5 parser"` | — | `"Html 5 parser"` | — | — |
| `"ABC123Def", { "splitNumbers": true }` | `"Abc 123 def"` | — | `"Abc 123 def"` | — | — |
| `"v1.2.3", { "splitNumbers": true }` | `"V 1 2 3"` | — | `"V 1 2 3"` | — | — |
| `"utf8", { "splitNumbers": true }` | `"Utf 8"` | — | `"Utf 8"` | — | — |
| `"version2beta", { "splitNumbers": true }` | `"Version 2 beta"` | — | `"Version 2 beta"` | — | — |
| `"2fast4you", { "splitNumbers": true }` | `"2 fast 4 you"` | — | `"2 fast 4 you"` | — | — |
| `"x²", { "splitNumbers": true }` | `"X ²"` | — | `"X"` | — | — |
| `"fooBarBaz", { "splitNumbers": true }` | `"Foo bar baz"` | — | `"Foo bar baz"` | — | — |
| `"_private", { "keepOuterUnderscores": false }` | `"Private"` | — | — | `"Private"` | `"Private"` |
| `"_private", { "keepOuterUnderscores": true }` | `"_Private"` | `"_Private"` | — | — | — |
| `"_private_key", { "keepOuterUnderscores": true }` | `"_Private key"` | `"_Private key"` | — | — | — |
| `"__foo_bar__", { "keepOuterUnderscores": true }` | `"__Foo bar__"` | `"__Foo bar__"` | — | — | — |
| `"__init__", { "keepOuterUnderscores": true }` | `"__Init__"` | `"__Init__"` | — | — | — |
| `"___", { "keepOuterUnderscores": true }` | `"___"` | `"___"` | — | — | — |
| `"foo__bar", { "keepOuterUnderscores": true }` | `"Foo bar"` | `"Foo bar"` | — | — | — |
| `"fooBar", { "keepOuterUnderscores": true }` | `"Foo bar"` | `"Foo bar"` | — | — | — |
| `‹a boxed string›` | `"Hi"` | — | — | `"Hi"` | 💥 `TypeError` |
| `42` | `""` | — | — | 💥 `TypeError` | 💥 `TypeError` |
| `null` | `""` | — | — | 💥 `TypeError` | 💥 `TypeError` |
| `undefined` | `""` | — | — | 💥 `TypeError` | 💥 `TypeError` |
| `‹a symbol›` | `""` | — | — | 💥 `TypeError` | 💥 `TypeError` |
| `‹an object with a throwing toString›` | `""` | — | — | 💥 `TypeError` | 💥 `TypeError` |
<!-- prettier-ignore-end -->

### Names in the wild

The naming evidence from `pnpm research:usage`, quoted whole; code-search counts drift daily, so read them as orders of magnitude.

| Name           | JavaScript | TypeScript |     Total |
| :------------- | ---------: | ---------: | --------: |
| camelCase      |  1,820,672 |    417,792 | 2,238,464 |
| pascalCase     |    131,840 |    114,048 |   245,888 |
| upperCamelCase |      4,744 |      2,636 |     7,380 |
| snakeCase      |     44,864 |     59,136 |   104,000 |
| kebabCase      |     45,824 |     41,280 |    87,104 |
| trainCase      |        241 |        611 |       852 |
| sentenceCase   |     11,248 |      9,184 |    20,432 |

- **Method**: GitHub code search, one exact-phrase query (`"<name>"`) per name, reading its `total_count`.
- **Collected**: 2026-11-03
- **Caveats**:
  - Counts are approximate and change from day to day; cite one with its date, as an order of magnitude.
  - Matching ignores case.
  - Without a `language:` qualifier every language counts, so an unprefixed name can collide with another language's API (`parseBoolean` matches Java's `Boolean.parseBoolean`).

| Name               | JavaScript | TypeScript |      Total |
| :----------------- | ---------: | ---------: | ---------: |
| toCamelCase        |     62,592 |     39,744 |    102,336 |
| constantCase       |      1,226 |      3,536 |      4,762 |
| screamingSnakeCase |        259 |        978 |      1,237 |
| titleCase          |    182,528 |     80,768 |    263,296 |
| capitalCase        |      2,592 |      3,632 |      6,224 |
| startCase          |     22,464 |      8,080 |     30,544 |
| lowerCase          | 21,069,824 | 11,599,872 | 32,669,696 |
| noCase             |     45,696 |     30,208 |     75,904 |
| spaceCase          |        568 |      1,668 |      2,236 |
| splitWords         |     15,520 |      6,336 |     21,856 |
| changeCase         |     81,280 |      7,584 |     88,864 |

- **Method**: GitHub code search, one exact-phrase query (`"<name>"`) per name, reading its `total_count`.
- **Collected**: 2026-11-03
- **Caveats**:
  - Counts are approximate and change from day to day; cite one with its date, as an order of magnitude.
  - Matching ignores case.
  - Without a `language:` qualifier every language counts, so an unprefixed name can collide with another language's API (`parseBoolean` matches Java's `Boolean.parseBoolean`).

| Package         | Weekly downloads |
| :-------------- | ---------------: |
| lodash          |      204,687,288 |
| es-toolkit      |       79,011,794 |
| remeda          |       16,535,350 |
| change-case     |       45,365,871 |
| scule           |       12,018,869 |
| string-ts       |        3,122,921 |
| case-anything   |        3,019,627 |
| voca            |          390,479 |
| humanize-string |          730,075 |
| radash          |        4,166,833 |
| camelcase       |      245,271,523 |
| decamelize      |       91,925,220 |

- **Method**: npm's downloads API, 2026-10-26 to 2026-11-01.
- **Collected**: 2026-11-03
- **Caveats**:
  - Downloads count every install, CI and mirrors included, so they measure reach, not users.

## Why

- **The plan agrees most with change-case: 32 of 41 strings in `words` and every style but `camelCase` and `pascalCase`,** where string-ts agrees on 34 and change-case on 31; change-case's misses are where it loses data:
  - it splits `"don't"` into `"don"` and `"t"`, and a decomposed `"e\u0301"` into `"e"` and its accent;
  - it drops every symbol and emoji (`"price"`, `"emojiFace"`), and doesn't split `"日本語Text"`.
- **Keeping digits on their word follows change-case, scule, and Rails,** and keeps a version or encoding name whole (`"base64"`, `"html5"`).
  - lodash, es-toolkit, remeda, Voca, string-ts, and case-anything split every digit run off; radash's `snake` splits only before a capital (`"version_2_beta"`, but `"utf8"`) (`"base_64_encode"`); both round-trip through `camelCase`, so only the snake, kebab, and spaced styles differ.
- **`splitNumbers` gives a caller lodash's digits with one flag,** for keys already stored as `base_64_encode`; with it, `words` matches lodash, es-toolkit, Voca, and change-case's `splitSeparateNumbers` on every option case but `"x²"`, where they drop the `²`, and string-ts on all of them.
- **Splitting an acronym before its last capital** is what every JavaScript library measured does.
  - Guava converts only from a format the caller declares (camelCase, or PascalCase for its `camelCase` column, since camelCase to camelCase returns the input unchanged), and Jackson and .NET only from camelCase: none of them touches `"foo-bar-baz"`, and Guava gives `"x_m_l_http_request"`.
- **Flattening acronyms** matches lodash, es-toolkit, change-case, string-ts, and case-anything, and makes the output the same whatever case the input used (`"FOO_BAR"` and `"fooBar"` both give `"Foo Bar"`).
  - lodash's `startCase` and scule keep an acronym's capitals (`"XML Http Request"`), so `"FOO_BAR_BAZ"` stays `"FOO BAR BAZ"`; remeda keeps `"XML"` but flattens `"FOO"`.
- **Symbols as words extend the emoji rule to every symbol,** as string-ts does (`"c_++_code"`).
  - lodash, es-toolkit, change-case, Voca, and case-anything drop them (`"c_code"`, `"price"`); radash and remeda keep them on the word before (`"c++_code"`), which would make `"a+b"` one word.
- **`keepOuterUnderscores` matches change-case's `prefixCharacters: "_"` and `suffixCharacters: "_"`** on every option case in every style; without it, the plan drops the runs, as lodash, es-toolkit, change-case, and string-ts do.
- **Data is kept wherever the style allows it:** a symbol, an emoji, an accent, or a caseless script survives, unlike change-case and case-anything, which drop symbols and emoji, or case-anything, which drops `"日本語"` entirely.
- **Bare names win on usage:** `camelCase` appears in about 22 times as many files as `toCamelCase`, and only remeda prefixes its case functions with `to`.
  - `constantCase` is the name in es-toolkit, change-case, string-ts, and case-anything, and outnumbers `screamingSnakeCase` about four to one.
  - `titleCase` outnumbers `startCase` (lodash, es-toolkit) and `capitalCase` (change-case, case-anything).
  - `lowerCase` is lodash's and es-toolkit's name for `"foo bar baz"`; change-case's `noCase` and case-anything's `spaceCase` are rarer.
- **The left-out styles are rare:** `trainCase` appears in under a thousand files, and only change-case and case-anything ship most of them.

## Consequences

- The README documents the splitter's rules, with `"version2Beta"` → `"version2_beta"` as the example that differs from lodash.
- The README notes that the result follows the engine's Unicode version, as case mapping and `\p{…}` classes do.
- `lowerCase` isn't `toLowerCase`: `lowerCase("fooBar")` is `"foo bar"`; the README says so beside the function.
- Every export takes `(value, options?)`, with `fallback`, `keepOuterUnderscores`, and `splitNumbers` in `options`.
- An implementation shares one internal splitter; each export joins its words, so a fix to a boundary reaches every style.
