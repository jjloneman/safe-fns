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
- [🧰 Profiles](#-profiles)
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
   - The first run pulls and builds ~4 GB of images (the .NET, Go, and Rust
     toolchains are most of it); later runs take seconds.

| Command                           | What it does                                                                    |
| :-------------------------------- | :------------------------------------------------------------------------------ |
| `pnpm research`                   | Runs every adapter over every case file                                         |
| `pnpm research --function <name>` | Runs one function's cases (`safeParseBoolean` or `safe-parse-boolean`); repeats |
| `pnpm research --profile <name>`  | Runs one Compose profile's adapters (see [Profiles](#-profiles)); repeats       |
| `pnpm research --concurrency <n>` | Caps parallel containers (default: the Docker VM's CPU count)                   |
| `pnpm research --format`          | Formats every adapter: Prettier, then each language's own formatter             |
| `pnpm research --format --check`  | Reports formatting drift without writing                                        |

- Results are byte-identical across runs and concurrency levels: columns are
  sorted, keys are sorted, and nothing records a timestamp.
- The manual **🔬 Research** workflow (`.github/workflows/research.yml`) runs
  the same command on GitHub and uploads the results as an artifact.
- Clean up with `docker compose --file research/compose.yaml down` and
  `docker image prune`.

## 🧰 Profiles

Each adapter service sits in one profile, named for its image.

| Profile      | Image                                   | Tools                                                    |
| :----------- | :-------------------------------------- | :------------------------------------------------------- |
| `c`          | `gcc`, with the C++ probes compiled in  | glibc (`ctypes`), libstdc++                              |
| `dotnet`     | .NET SDK                                | C# / .NET                                                |
| `go`         | `golang`                                | Go                                                       |
| `jvm`        | `gradle` (JDK 25)                       | Java, Commons Lang, Guava, Spring, Kotlin, Groovy        |
| `node`       | `node`, plus `package.json`'s libraries | JS built-ins and libraries                               |
| `php`        | `php` (CLI)                             | PHP                                                      |
| `powershell` | .NET SDK, which ships PowerShell        | PowerShell                                               |
| `python`     | `python`                                | Python 3.15 and 3.11, SQLite                             |
| `ruby`       | `ruby`, plus `docker/ruby/Gemfile.lock` | Ruby, Rails' ActiveModel                                 |
| `rust`       | `rust`, plus `adapters/rust/Cargo.lock` | Rust                                                     |
| `shell`      | `debian`, plus Debian's packages        | bash, dash (POSIX sh), fish, zsh, git, systemd           |
| `swift`      | `swift`, with the adapter compiled in   | Swift on Linux (swift-corelibs-foundation, not Darwin's) |

- Microsoft no longer publishes PowerShell's own image, so PowerShell comes from
  the .NET SDK image.
- The `shell` image installs from the Debian snapshot its base image was built
  from, so a rebuild gets the same package versions.

## 🗂️ Layout

- `cases/<function>.json` — the inputs, in the portable format below.
  - `codec.json` isn't a function: every language adapter must return its values
    unchanged, which proves the codec twins agree.
- `adapters/` — one adapter per language, beside its codec twin:
  - `node.mts`;
  - `python.py`, `sqlite.py`, `shell.py`, and `c.py` (with `cxx_probes.cpp`), on
    `research_codec.py`;
  - `ruby.rb` on `research_codec.rb`, `php.php` on `research_codec.php`,
    `swift.swift` on `research_codec.swift`, and `powershell.ps1` on
    `research_codec.psm1`.
  - `jvm/` is a Gradle project, compiled into the `jvm` image rather than
    mounted: Java's standard library, Commons Lang, Guava, and Spring in Java,
    Kotlin in `.kt`, Groovy in `.groovy`, and `ResearchCodec.java`, the JVM
    codec.
  - The runner's `docker compose build` step recompiles it after an edit; its
    library versions are exact, and Dependabot's cooldown holds them 7 days
    back, since Maven has no release-age floor.
  - `dotnet/`, `go/`, and `rust/` are each a project compiled into its own image
    the same way, each with its codec twin: `Codec.cs`, `codec.go`, and
    `src/codec.rs`. Go and .NET use only their standard libraries; Rust's crates
    come from the committed `Cargo.lock`.
- `results/<function>.json` and `.md` — generated; never edit them by hand.
  - The Markdown has a tiers 0–2 summary for decision records, a by-outcome
    table for functions with few distinct results, the full table, and every
    column's version, locale, and image.
- `sources/` — cached excerpts for tools that can't run in a container, each
  with its URL, version or commit, and fetch date.
- `compose.yaml` — every service; `docker/` holds Dockerfiles for images that
  need a build step: one per compiled adapter (`c`, `dotnet`, `go`, `jvm`,
  `rust`, `swift`), which also carries that language's formatter and linter,
  plus `node` and the JVM formatters' own; `docker/ruby/` also holds the Ruby
  gems' `Gemfile.lock`.
- `.swift-format` — swift-format's settings: 80 columns, 2-space indents.
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
  its layout. A compiled adapter (`c`'s C++ probes, `dotnet`, `go`, `jvm`,
  `rust`, `swift`) is built into its image instead, so its service mounts only
  `cases/`.

### 🔌 Two adapter shapes

- **Native:** the language reads the case file itself, so the adapter needs a
  codec twin of `scripts/research/codec.ts` and a `codec` column that
  round-trips (Node, Python, Ruby, PHP, Swift, PowerShell).
- **Driven:** the tool only ever sees a string, so a Python driver decodes the
  cases with `research_codec.py` and hands each string to the real tool (shells,
  git, systemd, C / C++).
  - A shell gets the value as a positional parameter, never interpolated into
    its script; git gets it through `GIT_CONFIG_VALUE_0`.
  - Anything but a string is `n/a`, and so is a string holding NUL, which no
    argument or environment variable can carry.
  - A nonzero exit status is the error `exit <status>`; a C++ exception or
    `std::errc` is reported by name.

## ➕ Adding a function or a tool

- **A function:** add `cases/<kebab-name>.json`, add probes for it to each
  adapter that has an opinion, and run `pnpm research --function <name>`.
- **A tool in an existing language:** add its library to `package.json` (a
  version at least 7 days old) or its probes to the Python adapter, then rerun.
- **A new language:**
  1. Add a service to `compose.yaml` with a pinned `image: name:X.Y.Z@sha256:…`
     whose tag was last pushed at least 7 days ago, the `adapter` role label, a
     profile, `LANG`/`LC_ALL` set to `C.UTF-8`, and read-only mounts.
     - A compiled language builds its adapter into a one-stage image instead
       (see `docker/go/Dockerfile`), and mounts only `cases/`.
  2. Write the adapter and its codec twin; the `codec` case file must
     round-trip.
  3. Add the language's formatter as a `formatter` service with `format-args`
     and `check-args` labels (see `ruff`), or a Prettier plugin in
     `package.json`.
  4. Add a Dependabot entry if the image comes from a Dockerfile, and one for
     any manifest the adapter or its formatter installs from (`Cargo.lock`,
     `dotnet-tools.json`), each with the 7-day cooldown.

## 🖌️ Formatters

| Language               | Formatter                                                                                                                                                                                                                                     |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, JSON, YAML | Prettier, through the repo's root config                                                                                                                                                                                                      |
| Python                 | [Ruff](https://docs.astral.sh/ruff/) (`ruff.toml`): `ruff format` in the `ruff` service, `ruff check` (annotations, docstrings, imports) in `ruff-check`                                                                                      |
| Java                   | Prettier, through [`prettier-plugin-java`](https://github.com/jhipster/prettier-java) in the root config; [Checkstyle](https://checkstyle.org) (`adapters/jvm/checkstyle.xml`) in the `checkstyle` service, for `final` parameters and locals |
| Kotlin                 | [ktfmt](https://github.com/facebook/ktfmt)'s Kotlin-lang style in the `ktfmt` service, at the 80 columns `adapters/jvm/.editorconfig` sets                                                                                                    |
| Groovy                 | [npm-groovy-lint](https://github.com/nvuillam/npm-groovy-lint) (`adapters/jvm/.groovylintrc.json`): CodeNarc's recommended rules, plus `--format`                                                                                             |
| C#                     | [CSharpier](https://csharpier.com) (`.csharpierrc.json`) in `csharpier`; the .NET analyzers (`AnalysisLevel`, warnings as errors) in `dotnet-build`                                                                                           |
| Go                     | `gofmt` in `gofmt`, `go vet` in `go-vet`                                                                                                                                                                                                      |
| Rust                   | rustfmt (`rustfmt.toml`) in `rustfmt`; [Clippy](https://doc.rust-lang.org/clippy/) (`pedantic`, warnings denied) in `clippy`                                                                                                                  |
| PHP                    | [`@prettier/plugin-php`](https://github.com/prettier/plugin-php), through the root Prettier config                                                                                                                                            |
| Ruby                   | [syntax_tree](https://github.com/ruby-syntax-tree/syntax_tree) (`stree`), in the `syntax-tree` service                                                                                                                                        |
| Swift                  | [swift-format](https://github.com/swiftlang/swift-format) (`.swift-format`), in the `swift-format` service; `--check` runs `lint --strict`                                                                                                    |
| C / C++                | [clang-format](https://clang.llvm.org/docs/ClangFormat.html), LLVM style, in the `clang-format` service                                                                                                                                       |
| PowerShell             | PSScriptAnalyzer's `Invoke-Formatter`, one-true-brace style, through `docker/powershell/format.ps1` in the `psscriptanalyzer` service                                                                                                         |

- Every language follows the repo's conventions
  ([AGENTS.md → Every language](../AGENTS.md#-every-language)); each formatter
  and linter is configured to enforce what it can.
- npm-groovy-lint runs with `--no-parse`: its parse check compiles each file
  alone, so it can't see the Java and Kotlin classes the Groovy files use.
- Neither `gofmt` nor any Go tool wraps lines, so Go's 80 columns are kept by
  hand.
- The shell, git, and systemd probes are scripts inside `shell.py`, so there are
  no shell or fish files to format; `prettier-plugin-sh` would cover any.
- `--format` runs the container formatters one at a time, since `ruff format`
  and `ruff check --fix` can rewrite the same file; `--format --check` runs them
  in parallel.
