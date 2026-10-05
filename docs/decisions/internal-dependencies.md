---
type: Decision
title: How exports share code
description: Shared logic lives in non-public modules under `src/internal/`; imports stay shallow, and each entry's size budget catches bloat.
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-09-30T20:24:01Z }
verified: { by: human:jjloneman, at: 2026-10-05T15:38:06Z }
---

# How exports share code

Exports may share code, as long as importing one function stays cheap.

## Decision

- **Shared logic lives under `src/internal/`.**
  - The build's entry glob is `src/*.ts`, so files one level down never become public subpaths.
  - Examples: the word splitter every case-conversion function uses.
- **A public function may import an internal module or another public function.**
  - `toError` can build its message with `safeJsonStringify`.
  - The storage aliases call `safeStorageGetItem`.
- **Imports stay shallow:** a public function reaches its helpers directly, rather than through chains of internal modules importing each other.
- **The per-entry `size-limit` budget enforces it.**
  - It measures each entry bundled with everything it imports, so a function that drags in too much fails `pnpm size`.
- **No hand-maintained standalone copies.**
  - A second, dependency-free copy of each function would reintroduce the drift the package exists to end.
  - A "copy standalone source" view could later be generated from the build output on the docs site ([#13](https://github.com/jjloneman/safe-fns/issues/13)).

## Why

- lodash shows the failure mode: importing `isEmpty` from lodash-es costs 2.3 kB gzipped, because it pulls in lodash's internal type-tag and array-like machinery (measured with esbuild, 2026-09-29).
- The output is unbundled ES modules, one file per module, so bundlers share an internal helper between the functions that import it instead of duplicating it.

## Consequences

- AGENTS.md's project layout describes `src/internal/` once the first internal module lands.
- The first internal module must also keep its types private.
  - `exports` already hides `src/internal/`, but the `typesVersions` wildcard (`./dist/*.d.ts`) would let `safe-fns/internal/*` typecheck under `moduleResolution: "node"` (`node10`), then fail at runtime.
  - Several of the owner's work apps use that setting.
  - The fix narrows `typesVersions` or emits internals where the wildcard can't reach, and `test:consumer` checks that `safe-fns/internal/*` doesn't resolve.
