---
type: Decision
title: What safeParseUrl accepts
description: A string or URL, resolved against an optional base with the native URL parser, returning a new URL or the fallback; it works on runtimes that lack URL.parse.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-11T03:42:10Z }
---

# What safeParseUrl accepts

`safeParseUrl(value, options?)` is `new URL()` with a fallback in place of the `TypeError`.

## Decision

- **Signature:** `safeParseUrl(value: unknown, options?: { base?: string | URL; fallback?: F }): URL | F`.
- **Accepted input:** a string, or a `URL` instance, which is copied, so the caller's object is never shared.
- **Parsing is the native URL parser's,** run inside a `try`:
  - its rules for whitespace, case, and percent-encoding apply unchanged;
  - a relative URL without a `base` returns the fallback.
- **Everything else returns the fallback:** other types, an invalid `base`, and a `URL` whose getters throw.
- **No protocol filtering.** `javascript:` and `data:` URLs parse, as they do natively; the docs warn callers who put the result in an `href`.

## Why

- Native [`URL.parse`](https://developer.mozilla.org/en-US/docs/Web/API/URL/parse_static) already returns `null` instead of throwing, but only from Node 22.1 and 2024 browsers, and its types need TypeScript 5.5's `lib`; the owner's Angular apps target older runtimes.
- It also takes `unknown` and a caller-chosen fallback, matching the other parsers.

## Consequences

- Once every supported runtime has `URL.parse`, this may move to [the native-first list](native-first-scope.md) as a thin wrapper.

## Open

- **A `protocols` allow-list option** (e.g. `["http:", "https:"]`) would make the result safe to use as a link; it isn't included yet.
