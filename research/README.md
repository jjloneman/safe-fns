# 🔬 Research harness

Runs each planned safe-fns function's edge cases through the equivalent calls in
other languages, libraries, databases, and formats, and records what each one
returns. Decision records in [docs/decisions/](../docs/decisions/index.md) quote
the generated tables instead of summarizing other tools' docs.

- Every tool runs in a pinned container, so anyone who clones the repo gets the
  same results with one command.
- Nothing here is published or run by normal CI.

## 📚 Table of Contents

- [📚 Table of Contents](#-table-of-contents)
- [🚀 Running it](#-running-it)
- [🗂️ Layout](#️-layout)
- [📦 The case format](#-the-case-format)
- [🧩 The adapter contract](#-the-adapter-contract)
- [➕ Adding a function or a tool](#-adding-a-function-or-a-tool)
- [🖌️ Formatters](#️-formatters)

---

## 🚀 Running it

1. Install a Docker-compatible runtime.
   - The owner's Mac mini uses [OrbStack](https://orbstack.dev)
     (`brew install --cask orbstack`), which is free for personal use.
   - [Colima](https://github.com/abiosoft/colima), Docker Desktop, and GitHub
     Actions' runners run the same `compose.yaml` unchanged.
2. Run `pnpm research` from the repo root.
   - It builds and pulls the images it needs, runs every adapter in parallel,
     and rewrites `research/results/`.
   - The first run pulls ~1–2 GB of images; later runs take seconds.

| Command                           | What it does                                                                    |
| :-------------------------------- | :------------------------------------------------------------------------------ |
| `pnpm research`                   | Runs every adapter over every case file                                         |
| `pnpm research --function <name>` | Runs one function's cases (`safeParseBoolean` or `safe-parse-boolean`); repeats |
| `pnpm research --profile <name>`  | Runs one Compose profile's adapters (`jvm`, `node`, `python`); repeats          |
| `pnpm research --concurrency <n>` | Caps parallel containers (default: the Docker VM's CPU count)                   |
| `pnpm research --format`          | Formats every adapter: Prettier, then each language's own formatter             |
| `pnpm research --format --check`  | Reports formatting drift without writing                                        |

- Results are byte-identical across runs and concurrency levels: columns are
  sorted, keys are sorted, and nothing records a timestamp.
- The manual **🔬 Research** workflow (`.github/workflows/research.yml`) runs
  the same command on GitHub and uploads the results as an artifact.
- Clean up with `docker compose --file research/compose.yaml down` and
  `docker image prune`.

## 🗂️ Layout

- `cases/<function>.json` — the inputs, in the portable format below.
  - `codec.json` isn't a function: every language adapter must return its values
    unchanged, which proves the codec twins agree.
- `adapters/` — one adapter per language: `node.mts`, `python.py`, `sqlite.py`,
  and `research_codec.py`, the Python codec.
  - `jvm/` is a Gradle project, compiled into the `jvm` image rather than
    mounted: Java's standard library, Commons Lang, Guava, and Spring in Java,
    Kotlin in `.kt`, Groovy in `.groovy`, and `ResearchCodec.java`, the JVM
    codec.
  - The runner's `docker compose build` step recompiles it after an edit; its
    library versions are exact, and Dependabot's cooldown holds them 7 days
    back, since Maven has no release-age floor.
- `results/<function>.json` and `.md` — generated; never edit them by hand.
  - The Markdown has a tiers 0–2 summary for decision records, a by-outcome
    table for functions with few distinct results, the full table, and every
    column's version, locale, and image.
- `sources/` — cached excerpts for tools that can't run in a container, each
  with its URL, version or commit, and fetch date.
- `compose.yaml` — every service; `docker/` holds Dockerfiles for images that
  need a build step.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` — the Node adapter's
  libraries, a separate pnpm root with the repo's 7-day moratorium.
- `tsconfig.json` — a nested config, so the editor and ESLint resolve the Node
  adapter's imports from `research/node_modules`.
- The host-side TypeScript lives in [scripts/research/](../scripts/research/):
  the runner, the codec, result merging, and the table generator.

## 📦 The case format

A case file names the function and lists its cases; each case has `args` and,
where a decision record settles it, safe-fns' `expected` answer, which becomes
the tier-0 **safe-fns (planned)** column.

```json
{
  "cases": [{ "args": [" yes "], "expected": true }],
  "function": "safeParseBoolean"
}
```

Plain JSON passes through. Values JSON can't hold are single-key tagged objects:

| Encoding                            | Value                                                         |
| :---------------------------------- | :------------------------------------------------------------ |
| `{ "$number": "NaN" }`              | `NaN`, `-0`, `Infinity`, or `-Infinity`                       |
| `{ "$bigint": "9007199254740993" }` | a bigint                                                      |
| `{ "$undefined": true }`            | `undefined`                                                   |
| `{ "$object": { "$tag": 1 } }`      | an object whose keys start with `$`, so data can't fake a tag |
| `{ "$js": "a revoked proxy" }`      | a JavaScript-only value, built by the Node adapter            |
| `{ "$repr": "[object Map]" }`       | an output with no encoding; never valid as an input           |

- A `$js` name is a factory in `adapters/node.mts`, or the `description` of an
  entry in `test/hostile-inputs.ts` or `test/cross-realm-inputs.ts`.
- A language that can't express an input (Python has no `undefined`) reports
  `n/a` for it.
- Write invisible characters as `\u` escapes, so a reviewer can see them.

## 🧩 The adapter contract

An adapter is a Compose service labeled `dev.safe-fns.research.role: adapter`,
in a profile, whose entrypoint takes case-file paths and prints one JSON object
to stdout:

```json
{
  "columns": [
    {
      "call": "yn(value)",
      "function": "safeParseBoolean",
      "locale": "en-US",
      "name": "yn",
      "outcomes": [{ "kind": "value", "value": true }],
      "tier": 1,
      "version": "5.1.0"
    }
  ]
}
```

- One column per call: a tool with two relevant calls (`Number(value)`,
  `Number.parseFloat(value)`) prints two columns.
- One outcome per case, in case-file order: `value` (the encoded return value),
  `error` (the thrown class's name), or `n/a`.
- Report the tool's real version and the locale it actually ran under; the
  runner adds the pinned image.
- Write nothing to disk: the repo is mounted read-only under `/work`, mirroring
  its layout.

## ➕ Adding a function or a tool

- **A function:** add `cases/<kebab-name>.json`, add probes for it to each
  adapter that has an opinion, and run `pnpm research --function <name>`.
- **A tool in an existing language:** add its library to `package.json` (a
  version at least 7 days old) or its probes to the Python adapter, then rerun.
- **A new language:**
  1. Add a service to `compose.yaml` with a pinned `image: name:X.Y.Z@sha256:…`
     whose tag was last pushed at least 7 days ago, the `adapter` role label, a
     profile, `LANG`/`LC_ALL` set to `C.UTF-8`, and read-only mounts.
  2. Write the adapter and its codec twin; the `codec` case file must
     round-trip.
  3. Add the language's formatter as a `formatter` service with `format-args`
     and `check-args` labels (see `ruff`), or a Prettier plugin in
     `package.json`.
  4. Add a Dependabot entry if the image comes from a Dockerfile.

## 🖌️ Formatters

| Language               | Formatter                                                                                                                                                |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, JSON, YAML | Prettier, through the repo's root config                                                                                                                 |
| Python                 | [Ruff](https://docs.astral.sh/ruff/) (`ruff.toml`): `ruff format` in the `ruff` service, `ruff check` (annotations, docstrings, imports) in `ruff-check` |
| Java                   | Prettier, through [`prettier-plugin-java`](https://github.com/jhipster/prettier-java) in the root config                                                 |
| Kotlin                 | [ktfmt](https://github.com/facebook/ktfmt)'s Kotlin-lang style in the `ktfmt` service, at the 80 columns `adapters/jvm/.editorconfig` sets               |
| Groovy                 | [npm-groovy-lint](https://github.com/nvuillam/npm-groovy-lint) (`adapters/jvm/.groovylintrc.json`): CodeNarc's recommended rules, plus `--format`        |

- Every language follows the repo's conventions
  ([AGENTS.md → Every language](../AGENTS.md#-every-language)); each formatter
  and linter is configured to enforce what it can.
- npm-groovy-lint runs with `--no-parse`: its parse check compiles each file
  alone, so it can't see the Java and Kotlin classes the Groovy files use.
- `--format` runs the container formatters one at a time, since `ruff format`
  and `ruff check --fix` can rewrite the same file; `--format --check` runs them
  in parallel.
