---
type: Decision
title: What createLogger writes to the console
description: "`createLogger(scope, options?)` returns `debug`, `error`, `info`, `log`, `trace`, and `warn`, each the current `console` method bound with a `[scope]` prefix, so the call site devtools and stack traces show is the caller's line; every read re-binds, so a `console` method replaced later still applies and a `prefix` option runs on each call; the prefix fills a `%s` slot, so `%` in it prints as written; an empty or non-string scope means no prefix, a throwing or non-string `prefix` falls back to `[scope]`, and a missing `console`, a missing method, or a throwing lookup gives a no-op."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-02T08:40:00Z }
---

# What createLogger writes to the console

`createLogger("checkout").info("ready")` prints `[checkout] ready`. It replaces the owner's getter-based logger, keeping the call-site links that a wrapper function loses, without the crashes and the `%` bug of a bare `console.info.bind(console, "[checkout]")`.

## Decision

- **Signature:**

  ```ts
  type LogLevel = "debug" | "error" | "info" | "log" | "trace" | "warn";

  type LogMethod = (...data: unknown[]) => void;

  type Logger = Readonly<Record<LogLevel, LogMethod>>;

  type LoggerPrefixInput = {
    /** The method being read. */
    level: LogLevel;
    /** The scope the logger was created with, or `""` for a non-string. */
    scope: string;
  };

  createLogger(
    scope: string,
    options?: { prefix?: (input: LoggerPrefixInput) => string },
  ): Logger
  ```

  - `scope` is the one value the function works on, so it's positional, and `prefix` goes in a trailing options object, as [How a function takes its parameters](function-parameters.md) asks.
  - "Scope" names the part of the app a logger belongs to, the word signale uses; "level" names the method, as pino, winston, loglevel, and Python's `logging` do.
  - `LogMethod` is the package's own type, not `typeof console.log`: `Console` comes from the DOM lib or `@types/node`, typed differently by each and with `any`, and a project with neither would fail on `Cannot find name 'Console'` in the package's declarations.
  - It ships on its own subpath, `safe-fns/create-logger`, as every export does, so importing a parser never pulls it in.
  - The name stays `createLogger`, a plain name under [the naming rule](safe-prefix-naming.md): it wraps no single native API.

- **Six methods: `debug`, `error`, `info`, `log`, `trace`, and `warn`,** the `console` methods whose first argument is a message, so a prefix can go in front of it.
  - Not `table` or `dir`, which would show the prefix as the data; `assert`, whose first argument is the condition; or `count` and `time`, which key on their first argument.
  - Not `group` or `groupCollapsed`, which take a label rather than log; a caller who wants any of these calls `console` directly.
  - No levels or filtering: a caller silences a level by replacing it on `console` (`console.debug = () => {}`), which every logger picks up, since each read re-binds (below).
- **Each method is the native `console` method, bound,** so the logger is never on the stack when it logs.
  - Reading `log.info` runs the getter, which returns before the call; the call itself goes straight to `console.info`, so devtools' source link and `console.trace`'s stack both start at the caller's line, not inside `safe-fns`.
  - Binding means `createLogger` never sees the call, so it can't catch a throw from a `console` method a caller replaced with one that throws; the throw is the caller's own code, and the docs say so.
- **The default prefix is `[scope]` and nothing else:** no level, no timestamp.
  - A browser already shows the level: devtools style `warn` and `error` and filter by method, so a printed level repeats it on every line.
  - Node loses the level in plain text (`info`, `log`, and `debug` all go to stdout), so the docs' `prefix` example adds it; a default can't print it in Node only, since a function never branches on its environment.
  - Adding to the default later would break every test that compares console output, while `prefix` lets a caller add more today.
- **The prefix fills a `%s` slot:** each method is bound as `console[level].bind(console, "%s", prefixText)`.
  - The prefix is never the format string, so `createLogger("50%s").info("a")` prints `[50%s] a`; bound as the format string, `%s` swallows `a` and prints `[50a]`.
  - Escaping `%` as `%%` instead is wrong when nothing follows: `console.info("[50%% done]")` prints `[50%% done]`, since Node skips format parsing for a lone argument.
  - The cost: the caller's first argument is never a format string, so `info("hello %s", "x")` prints `[checkout] hello %s x`; `%s`-style formatting needs a template literal instead. Every bound prefix has this cost, and the docs say so.
- **`prefix` replaces the default text,** called with `{ level, scope }` each time a method is read, which for `log.info(…)` is each call.
  - So a timestamp, an emoji, a level, or ANSI colors (which Node and Chrome's devtools both render) all work: `prefix: ({ level, scope }) => \`[${scope}] ${level.toUpperCase()}\``.
  - A `prefix` that throws or returns a non-string falls back to `[scope]`, so a bug in it never stops a log line; one that returns `""` means no prefix.
  - There is no `colors` option: choosing `%c` CSS in a browser or ANSI codes in Node would mean detecting the runtime.
- **An empty scope means no prefix:** `createLogger("").info("x")` prints `x`, not `[] x`.
- **A scope that isn't a string means no prefix,** never a throw, so a value from untyped code is safe to pass; it is never coerced, since a revoked proxy or a throwing `toString` would throw at the first log call. `prefix` receives it as `""`.
  - Taking a string, not a class, is deliberate: a class's `name` is mangled by minifiers, so `createLogger(MyService)` would print `[t]` in production.
- **Every read re-binds the current `console` method,** so a test that replaces or spies on `console.info`, or a caller silencing `debug`, applies to loggers created earlier.
  - `const { info } = log` and `{ ...log }` take the method as bound at that moment, with its prefix text fixed, as any getter does; the docs say so.
- **A method that can't be bound is a no-op,** as [the package promise](package-promise.md) requires: no global `console`, a `console` without that method or with a non-function in its place, or a lookup that throws (a getter, a proxy) all give `() => {}`, so `log.debug("x")` never throws on a runtime whose `console` lacks `debug`.
- **The methods are enumerable getters** on a plain object, so `Object.keys(log)` lists all six and `{ ...log }` copies them.
- **Its output depends on the runtime's `console`,** per [the design principles](../../AGENTS.md#-design-principles): Node writes `info`, `log`, and `debug` to stdout and `warn`, `error`, and `trace` to stderr, and a browser shows each at its level in devtools.

## Comparison

The tiers 0–2 summary from [research/results/create-logger.md](../../research/results/create-logger.md), generated by `pnpm research`.

- Each case creates a logger, then calls one method, with a recording `console` and captured `process.stdout` and `process.stderr`; a cell lists what was written, as `<channel>: <text>`, with Node's `util.format` applied to what a `console` method received, as Node's `console` does.
  - Four cases change `console` first, named in their fourth argument: no `console.debug`, no `console`, a `console.info` getter that throws, and a `console.info` replaced after the logger was created.
  - The last four pass `createLogger`'s `prefix` option as a fifth argument, which no other tool takes.
  - An empty cell (`[]`) means nothing was written.
- **JS built-ins** is the owner's starting point, an object of all six `console` methods, each bound when the logger is created with the prefix as the format string.
- **debug** has one level, so every method name reaches the same call; it writes to `process.stderr` in Node, and its date and colors are off so a rerun writes the same text.
- **loglevel** is set to show every level; at its default, `warn`, it writes nothing for `debug`, `info`, `log`, or `trace`.
- **consola** runs from `consola/basic`, its basic reporter, at level 5, so `debug` and `trace` write too (its default, 3, drops both), with dates off.
- Other languages' loggers (SLF4J's `getLogger`, Python's `logging.getLogger`) write through configured handlers, not a console a probe can swap, so they have no column; their prefix is a logger name, never a format string, which is the behavior this record picks.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`createLogger` | consola<br>`createConsola({ formatOptions: { date: false }, level: 5 }).withTag(scope)[method](...args)` | debug<br>`createDebug.enable(scope); createDebug(scope)(...args)` | JS built-ins<br>`` Object.fromEntries(methods.map((m) => [m, console[m].bind(console, `[${scope}]`)]))[method](...args) `` | loglevel<br>`log.getLogger(scope).setLevel("trace"); log.getLogger(scope)[method](...args)` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `"app", "info", ["hello"]` | `["console.info: [app] hello"]` | `["stdout: [info] [app] hello"]` | `["stderr: app hello"]` | `["console.info: [app] hello"]` | `["console.info: hello"]` |
| `"app", "info", ["hello %s", "x"]` | `["console.info: [app] hello %s x"]` | `["stdout: [info] [app] hello x"]` | `["stderr: app hello x"]` | `["console.info: [app] hello %s x"]` | `["console.info: hello x"]` |
| `"app", "info", ["count", { "a": 1 }]` | `["console.info: [app] count { a: 1 }"]` | `["stdout: [info] [app] count { a: 1 }"]` | `["stderr: app count { a: 1 }"]` | `["console.info: [app] count { a: 1 }"]` | `["console.info: count { a: 1 }"]` |
| `"app", "debug", ["d"]` | `["console.debug: [app] d"]` | `["stdout: [debug] [app] d"]` | `["stderr: app d"]` | `["console.debug: [app] d"]` | `["console.log: d"]` |
| `"app", "log", ["l"]` | `["console.log: [app] l"]` | `["stdout: [log] [app] l"]` | `["stderr: app l"]` | `["console.log: [app] l"]` | `["console.log: l"]` |
| `"app", "warn", ["w"]` | `["console.warn: [app] w"]` | `["stderr: [warn] [app] w"]` | `["stderr: app w"]` | `["console.warn: [app] w"]` | `["console.warn: w"]` |
| `"app", "error", ["e"]` | `["console.error: [app] e"]` | `["stderr: [error] [app] e"]` | `["stderr: app e"]` | `["console.error: [app] e"]` | `["console.error: e"]` |
| `"app", "trace", ["t"]` | `["console.trace: [app] t"]` | `["stdout: [trace] [app] t"]` | `["stderr: app t"]` | `["console.trace: [app] t"]` | `["console.trace: t"]` |
| `"50%s", "info", ["a"]` | `["console.info: [50%s] a"]` | `["stdout: [info] [50%s] a"]` | `["stderr: 50%s a"]` | `["console.info: [50a]"]` | `["console.info: a"]` |
| `"50%s", "info", []` | `["console.info: [50%s]"]` | `["stdout: [info] [50%s]"]` | `["stderr: 50%s undefined"]` | `["console.info: [50%s]"]` | `["console.info: "]` |
| `"", "info", ["x"]` | `["console.info: x"]` | `["stdout: [info] x"]` | `[]` | `["console.info: [] x"]` | 💥 `TypeError` |
| `‹a revoked proxy›, "info", ["x"]` | `["console.info: x"]` | `["stdout: [info] x"]` | 💥 `TypeError` | 💥 `TypeError` | 💥 `TypeError` |
| `"no-debug", "debug", ["d"], "without console.debug"` | `[]` | `["stdout: [debug] [no-debug] d"]` | `["stderr: no-debug d"]` | 💥 `TypeError` | `["console.log: d"]` |
| `"no-console", "info", ["x"], "without console"` | `[]` | `["stdout: [info] [no-console] x"]` | `["stderr: no-console x"]` | 💥 `TypeError` | `[]` |
| `"getter", "info", ["x"], "console.info is a throwing getter"` | `[]` | `["stdout: [info] [getter] x"]` | `["stderr: getter x"]` | 💥 `Error` | 💥 `Error` |
| `"replaced", "info", ["x"], "console.info replaced after creation"` | `["console.info (replaced): [replaced] x"]` | `["stdout: [info] [replaced] x"]` | `["stderr: replaced x"]` | `["console.info: [replaced] x"]` | `["console.info: x"]` |
| `"app", "warn", ["w"], undefined, { "prefix": ‹a prefix showing the level› }` | `["console.warn: [app] WARN w"]` | — | — | — | — |
| `"app", "warn", ["w"], undefined, { "prefix": ‹a prefix that throws› }` | `["console.warn: [app] w"]` | — | — | — | — |
| `"app", "warn", ["w"], undefined, { "prefix": ‹a prefix returning a number› }` | `["console.warn: [app] w"]` | — | — | — | — |
| `"app", "warn", ["w"], undefined, { "prefix": ‹a prefix returning an empty string› }` | `["console.warn: w"]` | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- **Not a bare `bind`:** binding the prefix as the format string swallows an argument when the scope holds `%s` (`[50a]`), prints `[] x` for an empty scope, and throws `TypeError` at creation when `console` or one of its methods is missing, or when the scope is a revoked proxy; it also keeps the method bound at creation, so a replaced `console.info` is never seen.
- **Not debug:** it writes to `process.stderr` rather than `console` in Node, so `warn` and `error` lose their level; it logs nothing until `enable` names the logger, prints `undefined` for a call with no arguments, and has no levels.
- **Not loglevel:** it has no prefix without a plugin, throws `TypeError` for an empty scope, binds `console` once at creation (and again on `setLevel`), so a replaced or missing method is fixed at that moment, sends `debug` to `console.log`, and throws on a `console` getter that throws.
- **Not consola:** it writes through its own reporter to `process.stdout` and `process.stderr` rather than `console`, adding a `[info]` tag, and in a browser its wrapper is the call site devtools show.
- **What they do better:** debug, loglevel, and consola all apply the caller's format string (`hello %s`, `x` → `hello x`), which a bound prefix can't; that trade keeps the call site, which is the reason the owner's logger binds.
- **Re-binding on read:** the owner's getter design, kept because replacing or spying on `console.info` in a test or at startup should reach every logger, not only ones created after it; it is also what lets `prefix` run per call.
- **No factory of factories or global setting:** a project sets its format once with its own one-line wrapper (below).
  - A `createLoggerFactory({ prefix })` export would add a second way to do the same thing.
  - A global `configureLogger({ prefix })` would be shared state: a logger's output would depend on import order, and two libraries using `safe-fns` would overwrite each other's format.

## Consequences

- The docs show `createLogger("checkout")` per component, and a project-wide format as a wrapper the project owns:

  ```ts
  export function createAppLogger(scope: string): Logger {
    return createLogger(scope, {
      prefix: ({ level, scope }) => `[${scope}] ${level.toUpperCase()}`,
    });
  }
  ```

- They also say that `%s` in the first argument prints literally, that destructuring fixes the method and its prefix at that moment, and that a throwing `console` method replaced by the caller still throws.
- Its tests run each case above against a recording `console`, including a missing `console`, a missing method, a throwing getter, a revoked-proxy scope, a method replaced after creation, and each `prefix` fallback; they check that `Object.keys` lists the six methods and that `console.trace`'s first stack frame is the test's own line.
- Its type tests check that each method takes `unknown[]` and returns `void`, that `level` is `LogLevel`, and that `prefix` must return a string.
- The [hostile-inputs harness](../../test/hostile-inputs.ts) passes each hostile value as `scope`, as `options`, and as the global `console`.
- `mockConsole`, a test helper that spies on these six methods through Vitest's `vi`, Jest's `jest`, or `node:test`'s `mock`, is a separate candidate, filed on #100.
