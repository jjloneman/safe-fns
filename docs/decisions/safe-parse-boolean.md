---
type: Decision
title: What safeParseBoolean accepts
description: Booleans, 1n / 0n, the numbers 1 and 0, and the strings true, t, yes, y, on, 1 and false, f, no, n, off, 0 (trimmed, any case) parse; everything else returns the fallback.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-13T03:00:00Z }
---

# What safeParseBoolean accepts

`safeParseBoolean(value, { fallback })` reads the spellings that configuration files, environment variables, query params, form fields, and database exports actually use, and returns the caller's fallback for anything else.

## Decision

- **`true`:**
  - the boolean `true`, the number `1`, and the bigint `1n`;
  - the strings `"true"`, `"t"`, `"yes"`, `"y"`, `"on"`, and `"1"`.
- **`false`:**
  - the boolean `false`, the numbers `0` and `-0`, and the bigint `0n`;
  - the strings `"false"`, `"f"`, `"no"`, `"n"`, `"off"`, and `"0"`.
- **Strings are trimmed and compared case-insensitively,** so `" TRUE "`, `"Yes"`, and `"OFF"` parse.
  - Trimming strips the same characters `isSafeEmpty` treats as blank, through the shared internal `trimBlank`, so `"true​"` is `true`.
  - Case folding is ASCII-only, so the result doesn't depend on the engine's locale data.
- **Only those exact spellings count.**
  - `"1.0"`, `"-0"`, `"01"`, `"tru"`, `"enabled"`, and full-width `"ｔｒｕｅ"` return the fallback.
  - The numbers `1.0` and `-0` work, since they're the same values as `1` and `0`.
- **Everything else returns the fallback:** blank strings, other numbers (`2`, `NaN`), other bigints, `null`, and boxed booleans (`new Boolean(false)`, an object, and so truthy).
- **Implementation:** a `typeof` fast path returns booleans as-is; strings are matched after `trimBlank` by two anchored, case-insensitive `.test()` regexes, `/^(?:true|t|yes|y|on|1)$/i` and then the `false` one.

## Why

- Both of the owner's shared copies fell back to JavaScript truthiness, so any unrecognized non-empty string, a typo included, came back `true`; a third copy skipped trimming, so `" true "` parsed differently.
- **The accepted set is exactly the one two independent, widely used parsers agree on:** npm's [`yn`](https://www.npmjs.com/package/yn) and Python's `strtobool`, and systemd's `parse_boolean` uses the same twelve spellings.
  - It's a superset of Python's `configparser`, Spring, envalid, and git config, and it covers Go's lowercase forms.
  - `t` / `f` are included because PostgreSQL writes booleans as `t` / `f` in its text output, so CSV exports contain them.
  - `on` is included because an HTML checkbox without a `value` submits `"on"` when checked.
- **YAML 1.1's "Norway problem"** (the country code `NO` read as `false`) came from guessing types for untyped data; a caller of `safeParseBoolean` has already declared the field is a boolean, so the wider set doesn't carry that risk.
- **Two `.test()` regexes were the most consistent implementation measured on Node 26:** never the slowest, no allocation, and no lowercase copy, which slowed a `toLowerCase()` + `Map` lookup on `"TRUE"` and on long strings. A single regex with a named group was slowest on matches, since `exec` builds a match object.
- **How each source compares,** from its own source code or, where marked, its documentation:

  | Source                                            | `true`                                                                              | `false`                                                | Case                    | Anything else                                                                   |
  | :------------------------------------------------ | :---------------------------------------------------------------------------------- | :----------------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------ |
  | **This package**                                  | `true` `t` `yes` `y` `on` `1`                                                       | `false` `f` `no` `n` `off` `0`                         | insensitive, trims      | fallback                                                                        |
  | npm `yn`                                          | `y` `yes` `t` `true` `1` `on`                                                       | `n` `no` `f` `false` `0` `off`                         | insensitive, trims      | `undefined`                                                                     |
  | zod `stringbool()`                                | `true` `1` `yes` `on` `y` `enabled`                                                 | `false` `0` `no` `off` `n` `disabled`                  | insensitive             | validation error                                                                |
  | envalid `bool()`                                  | `true` `t` `yes` `on` `1`                                                           | `false` `f` `no` `off` `0`                             | sensitive               | throws                                                                          |
  | joi `boolean()`                                   | `true`                                                                              | `false`                                                | insensitive, trims      | validation error                                                                |
  | yup `boolean()`                                   | `true` `1`                                                                          | `false` `0`                                            | insensitive             | validation error                                                                |
  | Python `configparser`                             | `1` `yes` `true` `on`                                                               | `0` `no` `false` `off`                                 | insensitive             | `ValueError`                                                                    |
  | Python `strtobool` (removed in 3.12)              | `y` `yes` `t` `true` `on` `1`                                                       | `n` `no` `f` `false` `off` `0`                         | insensitive             | `ValueError`                                                                    |
  | Java `Boolean.parseBoolean`                       | `true`                                                                              | everything else                                        | insensitive             | `false`                                                                         |
  | Kotlin `toBoolean()` (docs) / `toBooleanStrict()` | `true`                                                                              | everything else / `false`                              | insensitive / sensitive | `false` / throws                                                                |
  | Groovy `String.toBoolean()`                       | `true` `y` `1`                                                                      | everything else                                        | insensitive, trims      | `false`                                                                         |
  | Spring `StringToBooleanConverter`                 | `true` `on` `yes` `1`                                                               | `false` `off` `no` `0`                                 | insensitive, trims      | `""` → `null`, else throws                                                      |
  | Rails `ActiveModel` boolean                       | everything else                                                                     | `0` `f` `F` `false` `FALSE` `off` `OFF`                | listed spellings only   | `""` → `nil`; `"no"` is `true`                                                  |
  | Go `strconv.ParseBool` (docs)                     | `1` `t` `T` `true` `True` `TRUE`                                                    | `0` `f` `F` `false` `False` `FALSE`                    | listed spellings only   | error                                                                           |
  | Rust `str::parse::<bool>`                         | `true`                                                                              | `false`                                                | sensitive               | error                                                                           |
  | systemd `parse_boolean`                           | `1` `yes` `y` `true` `t` `on`                                                       | `0` `no` `n` `false` `f` `off`                         | insensitive             | error                                                                           |
  | git config                                        | `true` `yes` `on` (and nonzero integers)                                            | `false` `no` `off` (and `0`, and `""`)                 | insensitive             | error                                                                           |
  | PostgreSQL `boolean` input (docs)                 | `true` `yes` `on` `1`, and unique prefixes (`t`, `y`)                               | `false` `no` `off` `0`, and unique prefixes (`f`, `n`) | insensitive, trims      | error; output is always `t` / `f`                                               |
  | SQLite                                            | `TRUE` is the integer `1`                                                           | `FALSE` is the integer `0`                             | —                       | no boolean type; text isn't converted                                           |
  | YAML 1.1                                          | `y` `yes` `true` `on` (lower, Capitalized, or ALL-CAPS)                             | `n` `no` `false` `off` (same)                          | listed spellings only   | not a boolean                                                                   |
  | YAML 1.2 core                                     | `true` (`True`, `TRUE`)                                                             | `false` (`False`, `FALSE`)                             | listed spellings only   | not a boolean                                                                   |
  | Shells (bash, zsh)                                | no boolean type; `true` and `false` are commands, and exit status `0` means success | —                                                      | —                       | conventions vary by variable (`CI=true`, `DEBUG=1`, `NO_COLOR` set to anything) |

## Consequences

- A caller that relied on truthiness gets the fallback for unrecognized strings, and passes `{ fallback: false }` to keep a boolean result.
- A caller migrating from `value === "true"` now also gets `true` for `"yes"`, `"on"`, `"t"`, `"y"`, and `"1"`; the README's migration note says so.
- The docs list every accepted spelling, so users can tell exactly what counts as what.
