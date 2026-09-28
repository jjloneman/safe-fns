---
paths:
  - "**/*.test.ts"
  - "**/*.test-d.ts"
  - "test/**"
  - "vitest.config.ts"
---

# 🧪 Testing (Vitest)

The scripts, projects, and coverage gate are described in [AGENTS.md](../../AGENTS.md#-testing); this rule covers how to write a test.

## 🗂️ Where tests live

- **Co-locate a function's tests** as a sibling `*.test.ts` (and `*.test-d.ts` for type tests) next to the file under test — not in a `__tests__/` directory.
- **Cross-cutting harnesses live in top-level `test/`**, imported through the `#test/*` alias rather than a relative `../../` path.
  - `#test/cross-env.cases` — the cross-environment table; add a row per behavior every runtime must agree on.
  - `#test/hostile-inputs` — values that trap on inspection; run every export over them.
  - `#test/cross-realm-inputs` — Node-only values from `node:vm`.
- **`*.node.test.ts` runs only in the `node` project.**
  - Use it for anything that needs a Node built-in, such as the cross-realm inputs.
  - Everything else must pass unchanged in both projects, so keep it free of Node and DOM APIs.

## 🧱 Test shape

- **`describe("<unit>")` → `test("<scenario>")`.** Use `test`, never the `it` alias.
- **Import from `vitest` explicitly** — no globals.
- **Body sections** follow AGENTS.md's `// Given` / `// When` / `// Then` convention, with these refinements:
  - Use only the phases that carry meaning; a pure value check with no action is `// Given` + `// Then`.
  - A combined label (`// Given/When/Then`) is fine when one line genuinely spans the phases.
  - `// When` marks the single action that triggers the asserted outcome.
- **Table tests name rows with `$description`**, never by printing the row's values.

## 🛡️ Hostile values

- **Assert on the function's return value, never on the hostile value itself.**
  - `expect(hostileValue)` makes Vitest diff and print it, which trips the same traps the test is probing and crashes the report instead of failing the assertion.
- **Never monkey-patch a global** (`Object.prototype`, `globalThis`, a built-in's method) to provoke a failure.
  - Build a `Proxy`, or an object with a throwing getter, and pass it in; a patched global leaks into every other test in the worker.

## 🔷 Type tests

- **`*.test-d.ts` files run through Vitest's typecheck mode**, in the `node` project only; they don't depend on the runtime.
- **Check a declared type with `expectTypeOf<typeof value>()`**, not `expectTypeOf(value)` — passing the value widens a literal type (`true` becomes `boolean`).
- **Prove a rejection with `// @ts-expect-error`** on the offending line, with a short reason after it.
