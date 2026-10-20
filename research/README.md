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
- [⬆️ Dependency bumps](#️-dependency-bumps)
- [🧰 Profiles](#-profiles)
- [🗂️ Layout](#️-layout)
- [📦 The case format](#-the-case-format)
- [🧩 The adapter contract](#-the-adapter-contract)
- [🏅 Tiers](#-tiers)
- [🗄️ Databases](#️-databases)
- [➕ Adding a function or a tool](#-adding-a-function-or-a-tool)
- [🖌️ Formatters](#️-formatters)
- [🔎 Usage in the wild](#-usage-in-the-wild)

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

| Command                           | What it does                                                                                           |
| :-------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `pnpm research`                   | Runs every adapter over every case file                                                                |
| `pnpm research --function <name>` | Runs one function's cases (`safeParseBoolean` or `safe-parse-boolean`); repeats                        |
| `pnpm research --profile <name>`  | Runs one Compose profile's adapters (see [Profiles](#-profiles)); repeats                              |
| `pnpm research --concurrency <n>` | Caps parallel containers (default: the Docker VM's CPU count)                                          |
| `pnpm research --format`          | Formats every adapter: Prettier, then each language's own formatter                                    |
| `pnpm research --format --check`  | Reports formatting drift without writing                                                               |
| `pnpm research --check-inputs`    | Fails when a committed column records a different image or inputs than its service has; builds nothing |

- Results are byte-identical across runs and concurrency levels: columns are
  sorted, keys are sorted, and nothing records a timestamp.
- The manual **🔬 Research** workflow (`.github/workflows/research.yml`) runs
  the same command on GitHub and uploads the results as an artifact.
- The `db` profile starts each database before its adapter runs and removes it
  afterward; SQL Server runs under emulation on Apple Silicon, so it's the
  slowest to come up.
- Several sessions can share one Docker engine, so give each its own Compose
  project before any `docker compose` or `pnpm research` command:

  ```sh
  export COMPOSE_PROJECT_NAME=safe-fns-research-gh-<issue>
  ```

- Once your PR merges, remove only the images your project built. Compose labels
  every image it builds with its project, and `:?` makes each command fail
  rather than match every project's images when the name is unset. The first
  removes the tagged images; the second, the untagged ones a rebuild left
  behind:

  ```sh
  docker images --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:?}" --format '{{.Repository}}:{{.Tag}}' | xargs -r docker image rm
  docker image prune --force --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:?}"
  ```

  - Match by that label, not by a `${COMPOSE_PROJECT_NAME}-` name prefix, which
    would also catch a project whose name extends yours.

  - Leave the pulled base images and the build cache: another session may be
    building from them, and they make the next build fast.
  - A project-wide `docker compose down`, an unscoped `docker image prune`, and
    `docker builder prune` are the owner's housekeeping, run only once no
    session is in flight.

## ⬆️ Dependency bumps

Dependabot bumps the image pins and the libraries' lockfiles weekly but never
regenerates `research/results/`, so `research-check.yml` runs
`pnpm research --check-inputs` on every PR that touches the harness.

- **Every column records two pins:** its service's `image`, and an `inputs`
  fingerprint, a SHA-256 of the files that decide what the service runs.
  - A built service's Dockerfile is always an input.
  - Every other input is listed in the service's `dev.safe-fns.research.inputs`
    label, whitespace-separated and relative to `research/`: the lockfiles and
    manifests it installs from (`pnpm-lock.yaml`, `docker/ruby/Gemfile.lock`,
    `adapters/rust/Cargo.lock`).
  - Adapter source and case files stay out: a change to them shows up as a
    result diff once regenerated, and including them would fail the check on
    edits that can't change a result.
- **The check compares, it doesn't run.** It reads `docker compose config`, each
  Dockerfile's first `FROM`, and every input, computes each service's image and
  fingerprint exactly as the runner would (a database adapter reports its
  database's image), and fails on any committed column that records something
  else.
  - It names the function and the service, with both images or the service's
    inputs, then prints the `pnpm research --profile …` command that regenerates
    them.
  - A column without a fingerprint is stale.
  - The planned and docs-only columns record `-` and are never checked.
  - An input that can't be read fails the check, so a renamed lockfile can't
    silently drop out of its service's fingerprint.
  - The JVM adapter pins only its direct dependencies in `build.gradle.kts`, so
    a transitive change without an edit there goes unseen.
- **Regenerate a bump's results by hand**, on the Dependabot branch:
  1. `gh pr checkout <n>`, and set your own `COMPOSE_PROJECT_NAME`.
  2. Run the command the check printed, then run it again; the second run must
     leave `git status` clean.
  3. Commit the results as `chore(research): 🔬 regenerate results for <bump>`
     and push.
  - Dependabot stops rebasing a PR once someone else has pushed to it;
    `@dependabot recreate` would drop the results commit, so regenerate again
    after one.
- **An image several adapters share moves in one PR**, so its results are
  regenerated together; `scripts/research/image-pins.test.ts` fails if a shared
  image is split across Dependabot groups. `python311` is the one deliberate
  exception: its own entry holds it on 3.11.

  | Image                          | Services                                | Group                      |
  | :----------------------------- | :-------------------------------------- | :------------------------- |
  | `node`                         | `firebase`, `hermes`, `node`, `sources` | `research-dockerfiles`     |
  | `python` (3.x)                 | `db`, `python`, `sqlite`, `xml-schema`  | `research-dockerfiles`     |
  | `mcr.microsoft.com/dotnet/sdk` | `dotnet`, `powershell`                  | `research-compiled-images` |
  - `db` and `sources` share an image without recording it: a database column
    records its database's image, and a docs-only column records `-`. A bump to
    `docker/db/Dockerfile` still fails the check, through the database columns'
    `inputs`.

- **Every image tracks its latest stable major.** A new major is a result to
  record, not a break to avoid, so Dependabot proposes majors and they merge
  once their results are regenerated; pre-releases are never pinned.

## 🧰 Profiles

Each adapter service sits in one profile, named for its image.

| Profile      | Image                                                              | Tools                                                                                                                                                                                                                                                                                                                                                 |
| :----------- | :----------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c`          | `gcc`, with the C++ probes compiled in                             | glibc (`ctypes`), libstdc++                                                                                                                                                                                                                                                                                                                           |
| `db`         | `docker/db/`, beside each database's own image; `docker/firebase/` | PostgreSQL, MySQL, MariaDB, SQL Server, MongoDB, the Firebase Realtime Database and Firestore emulators                                                                                                                                                                                                                                               |
| `dotnet`     | .NET SDK                                                           | C# / .NET                                                                                                                                                                                                                                                                                                                                             |
| `go`         | `golang`                                                           | Go                                                                                                                                                                                                                                                                                                                                                    |
| `hermes`     | `docker/hermes/`: `node`, plus the Hermes CLI release (amd64)      | Hermes, React Native's engine, running the JS built-ins' calls                                                                                                                                                                                                                                                                                        |
| `jvm`        | `gradle` (JDK 25)                                                  | Java, Commons Lang, Gson, Guava, Jackson, Spring, Kotlin, Groovy; XML Schema 1.0 (Xerces-J)                                                                                                                                                                                                                                                           |
| `node`       | `node`, plus `package.json`'s libraries                            | JS built-ins; lodash, es-toolkit, remeda, Underscore, Ramda, radash, Effect, `@sindresorhus/is`, is-plain-obj; zod, valibot, joi, yup, envalid, yn, validator.js, Ajv; safe-stable-stringify, fast-safe-stringify, json-stringify-safe, fast-json-stable-stringify, canonicalize, ensure-error; JSON, YAML, TOML, CSV, INI, and the HTML spec (jsdom) |
| `php`        | `php` (CLI)                                                        | PHP                                                                                                                                                                                                                                                                                                                                                   |
| `powershell` | .NET SDK, which ships PowerShell                                   | PowerShell                                                                                                                                                                                                                                                                                                                                            |
| `python`     | `docker/python/` and `docker/python311/`: `python`                 | Python 3.14 and 3.11, SQLite                                                                                                                                                                                                                                                                                                                          |
| `ruby`       | `ruby`, plus `docker/ruby/Gemfile.lock`                            | Ruby, Rails' ActiveModel                                                                                                                                                                                                                                                                                                                              |
| `rust`       | `rust`, plus `adapters/rust/Cargo.lock`                            | Rust, `serde_json`, and the `url` crate                                                                                                                                                                                                                                                                                                               |
| `shell`      | `debian`, plus Debian's packages                                   | bash, dash (POSIX sh), fish, zsh, git, systemd                                                                                                                                                                                                                                                                                                        |
| `sources`    | `docker/node/`'s `base` stage: `node`, without the libraries       | Docs-only columns from `sources/`; Excel and Google Sheets are cached, but settle no current case                                                                                                                                                                                                                                                     |
| `swift`      | `swift`, with the adapter compiled in                              | Swift on Linux (swift-corelibs-foundation, not Darwin's)                                                                                                                                                                                                                                                                                              |
| `xml`        | `docker/xml-schema/`: `python`, plus hash-pinned `xmlschema`       | `xmlschema`'s XSD 1.0 built-in types                                                                                                                                                                                                                                                                                                                  |

- Microsoft no longer publishes PowerShell's own image, so PowerShell comes from
  the .NET SDK image.
- The `shell` image installs from the Debian snapshot its base image was built
  from, so a rebuild gets the same package versions.
- The Hermes CLI release is x86_64-only, so `hermes` runs as `linux/amd64`
  (emulated on an arm64 host), and its Dockerfile downloads a checksummed
  release tarball that Dependabot can't track: bump it by hand from
  [the releases page](https://github.com/facebook/hermes/releases). Its image
  column names the Node base; its version column is Hermes's own.

## 🗂️ Layout

- `cases/<function>.json` — the inputs, in the portable format below.
  - `codec.json` isn't a function: every language adapter must return its values
    unchanged, which proves the codec twins agree.
- `adapters/` — one adapter per language or runtime, beside its codec twin:
  - `node.mts`, the Node entry, with one module per tool under `node/`
    (`node/<tool>.mts`) and their shared types in `node/tool.mts`;
  - `hermes.mts`, which runs the JS built-ins' calls in Hermes, embedding
    `codec.ts`'s own encoder rather than keeping a twin;
  - `sources.mts`, which prints the docs-only columns from `sources/`;
  - `python.py`, `sqlite.py`, `shell.py`, and `c.py` (with `cxx_probes.cpp`), on
    `research_codec.py`;
  - `postgres.py`, `mysql.py` (MySQL and MariaDB), `mssql.py`, `mongo.py`, and
    `firebase.py`, also on `research_codec.py`, with `database_probe.py`
    building the probes they share;
  - `xml_schema.py` and its schema, `xml-schema.xsd`, also on
    `research_codec.py`;
  - `ruby.rb` on `research_codec.rb`, `php.php` on `research_codec.php`,
    `swift.swift` on `research_codec.swift`, and `powershell.ps1` on
    `research_codec.psm1`.
  - `jvm/` is a Gradle project, compiled into the `jvm` image rather than
    mounted: Java's standard library, Commons Lang, Guava, Spring, and Xerces-J
    in Java, Kotlin in `.kt`, Groovy in `.groovy`, and `ResearchCodec.java`, the
    JVM codec.
  - `XmlSchemaTools.java` decodes against the shared `xml-schema.xsd`, which the
    `jvm` service passes to its build as the `adapters` context.
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
  with its URL, version or commit, and fetch date, plus a `.json` of the
  outcomes an excerpt settles (see [sources/README.md](sources/README.md)).
- `compose.yaml` — every service; `docker/` holds Dockerfiles for images that
  need a build step: one per compiled adapter (`c`, `dotnet`, `go`, `jvm`,
  `rust`, `swift`), which also carries that language's formatter and linter,
  plus `node`, `hermes`, `python`, `xml-schema`, and the JVM formatters' own;
  `docker/ruby/` also holds the Ruby gems' `Gemfile.lock`.
- `.swift-format` — swift-format's settings: 80 columns, 2-space indents.
  - `docker/db/` — Python plus the database drivers, hash-pinned in
    `requirements.txt`.
  - `docker/firebase/` — the Firebase emulators: Node, a JRE, and
    `firebase-tools` from its own pnpm root, with the emulator jars fetched at
    build time.
  - `docker/python/` — only a `FROM`: `python` and `sqlite` build from it,
    rather than pinning Python in `compose.yaml`, so Dependabot bumps it in the
    same PR as every other 3.x Python.
  - `docker/python311/` — only a `FROM`, with no build step: a separate
    Dockerfile gives Dependabot a separate dependency, so it can hold
    `python311` on 3.11 without holding the other `python` pins.
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` — the Node adapter's
  libraries, a separate pnpm root with the repo's 7-day moratorium.
- `tsconfig.json` — a nested config, so the editor and ESLint resolve the Node
  adapter's imports from `research/node_modules`.
- The host-side TypeScript lives in [scripts/research/](../scripts/research/):
  the runner, the codec, result merging, and the table generator, plus
  `usage-search.ts` and its pure halves, `usage-tally.ts` and
  `call-arguments.ts` (see [Usage in the wild](#-usage-in-the-wild)), and
  `logging.ts`, the log and error helpers both scripts share.

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

| Encoding                            | Value                                                                                              |
| :---------------------------------- | :------------------------------------------------------------------------------------------------- |
| `{ "$number": "NaN" }`              | `NaN`, `-0`, `Infinity`, or `-Infinity`                                                            |
| `{ "$bigint": "9007199254740993" }` | a bigint                                                                                           |
| `{ "$undefined": true }`            | `undefined`                                                                                        |
| `{ "$object": { "$tag": 1 } }`      | an object whose keys start with `$`, so data can't fake a tag                                      |
| `{ "$js": "a revoked proxy" }`      | a JavaScript-only value, built by the Node adapter                                                 |
| `{ "$utf16": [55296] }`             | in `expected` only: the string these UTF-16 code units spell, the one way to plan a lone surrogate |
| `{ "$repr": "[object Map]" }`       | an output with no encoding; never valid as an input                                                |

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
- A result the format can only name (a `URL`, an `Error`) is reported through a
  property the call text spells out (`new URL(value, base).href`), and a result
  whose key order is the point (`deepSortObject`) through its JSON text, since
  results sort every object's keys.
- A Node clone or copy marks a reference back to an ancestor as `Symbol(cycle)`
  and a second reference to an object as `Symbol(repeat)` (`markReferences` in
  `node/tool.mts`): encoding a cycle would never end, and two references would
  otherwise print as two equal copies.
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

## 🏅 Tiers

Every column carries a tier, set by its adapter: `tier` on a Node `Tool`, or on
each tool in a language adapter's own codec (`research_codec.Tool` in Python,
and its twin in every other language). Tables sort columns by tier, and the
summary table that decision records quote shows tiers 0–2 only, so a tier
decides whether a column is quoted.

| Tier | What                                          | Examples                                                                                                                                                                 |
| :--: | :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|  0   | safe-fns itself                               | **safe-fns (planned)**, from the case files' `expected` answers                                                                                                          |
|  1   | JavaScript runtimes and libraries             | JS built-ins, Hermes, lodash, es-toolkit, Ramda, remeda, zod, valibot, yn                                                                                                |
|  2   | Python, the JVM languages, .NET, Go, and Rust | their standard libraries, plus the libraries most code in them reaches for: Guava, Commons Lang, Spring                                                                  |
|  3   | Formats, specs, and databases                 | JSON, YAML, TOML, CSV, INI, HTML, XML Schema, SQLite, PostgreSQL, MySQL, MariaDB, SQL Server, MongoDB, Firebase                                                          |
|  4   | Everything else                               | JS validation and config libraries (Ajv, envalid, joi, validator.js, yup); Python's xmlschema; C, C++, PHP, Ruby, Rails, Swift, PowerShell, the shells, systemd, and git |

- Tier 2 is set by language, not by "standard library": Guava is tier 2, while
  Ruby's and PHP's standard libraries are tier 4.
- Pick a new tool's tier from this table; a tool that fits none is a question
  for the owner, not a new tier.

## 🗄️ Databases

A database is a long-running Compose service labeled
`dev.safe-fns.research.role: database`, beside a one-shot adapter that queries
it.

| Database                   | Probes                                                   | Service            |
| :------------------------- | :------------------------------------------------------- | :----------------- |
| PostgreSQL                 | `CAST(? AS …)`, `CAST(? AS json/jsonb)::text`, `trim(?)` | `postgres`         |
| MySQL, MariaDB             | `? IS TRUE`, `CAST(? AS …)`, `TRIM(?)`, `JSON_…(?)`      | `mysql`, `mariadb` |
| SQL Server                 | `CAST(? AS …)`, `TRIM(?)`, `ISJSON(?)`                   | `mssql`            |
| MongoDB                    | `$toBool`, `$toLong`, `$toDouble`, `$toString`, `$trim`  | `mongo`            |
| Firebase Realtime Database | `isSafeEmpty`: does a written value survive?             | `firebase`         |
| Cloud Firestore            | `isSafeEmpty`: does a written field survive?             | `firebase`         |

- The runner starts the active profiles' databases with
  `docker compose up --wait`, gated on each one's healthcheck, and removes them
  and their networks by name (`docker compose down <names>`) when the adapters
  finish, whether or not they succeeded.
- An adapter shares an `internal` network with its database and nothing else, so
  neither can reach the internet; no database publishes a host port.
- Each database keeps its data in `tmpfs`, except SQL Server, which can't run on
  it.
- An adapter binds the case's value as a query parameter, and reports `n/a` for
  a value its driver would change on the way in: a bool where the database has
  no boolean type, an integer outside 64 bits, a string that isn't valid UTF-8.
- An error is the server's own code: a SQLSTATE, `Error 1292`, `Msg 245`, or a
  MongoDB `codeName`.
- A column's version is the server's own, its locale is the database's collation
  or `ctype`, and its image is the database's, not the adapter's.

## ➕ Adding a function or a tool

- **A function:** add `cases/<kebab-name>.json`, add probes for it to each
  adapter that has an opinion, and run `pnpm research --function <name>`.
- **A tool in an existing language:** add its library to `package.json` (a
  version at least 7 days old) and a `node/<tool>.mts` module listed in
  `node.mts`, or its probes to the Python adapter, then rerun.
- **A docs-only tool:** cache its excerpt as `sources/<tool>.md`, and once it
  settles a case, transcribe the outcomes into `sources/<tool>.json`.
- **A new language:**
  1. Add a service to `compose.yaml` with a pinned `image: name:X.Y.Z@sha256:…`
     whose tag was last pushed at least 7 days ago, the `adapter` role label, a
     profile, `LANG`/`LC_ALL` set to `C.UTF-8`, and read-only mounts.
     - List the lockfiles and manifests it installs from in its `inputs` label
       (see [Dependency bumps](#️-dependency-bumps)).
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
- **A database:** add it as a `database`-role service with a healthcheck, on an
  `internal` network of its own, and an adapter on that network whose
  `depends_on` names it; the runner reports the database's image for the
  adapter's columns.

## 🖌️ Formatters

| Language               | Formatter                                                                                                                                                                                                                                     |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, JSON, YAML | Prettier, through the repo's root config                                                                                                                                                                                                      |
| TOML, XML (`.xsd`)     | Prettier, through `prettier-plugin-toml` and `@prettier/plugin-xml` in the root config                                                                                                                                                        |
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

## 🔎 Usage in the wild

`pnpm research:usage` measures how code outside this repo names and calls things
— the naming and semantics questions a decision review asks, such as
`safeJsonParse` vs `safeParseJson`, or whether `parseInt` calls pass a radix.

| Command                                             | What it does                                                         |
| :-------------------------------------------------- | :------------------------------------------------------------------- |
| `pnpm research:usage counts <name>…`                | Counts the files GitHub's code search finds for each exact name      |
| `pnpm research:usage calls <callee> --argument <n>` | Tallies the values a call's `n`th argument takes in a sample of code |
| `pnpm research:usage files <query>`                 | Lists the files a code search finds, qualifiers such as `repo:` kept |
| `pnpm research:usage npm <package>…`                | Prints each package's downloads over the last week                   |

- `--language <name>` (repeatable) gives `counts` a column per language, plus a
  `Total` of them when there are several, and sets the languages `calls` samples
  (default JavaScript and TypeScript); `--pages` sets how many pages of 100
  files `calls` reads per language (default 3, at most 10); `--limit` caps
  `files` (default 30, at most 100).
- `files` joins its words with spaces, so quote an exact phrase inside the
  query: `pnpm research:usage files '"safe parse" repo:o/r'`.
- The report is JSON on stdout, ready for `jq`, or a Markdown table with
  `--markdown`, stamped with its method, date, and caveats, so a decision record
  can quote it with how it was measured; progress goes to stderr.
- GitHub is called through `gh api`, so it uses `gh`'s own login. Code search
  allows about 10 requests a minute: the script spaces its requests and waits
  out a rate-limit response.
- **Its numbers aren't reproducible**, unlike the harness, so they never go into
  `research/results/`:
  - counts drift daily (`safeJsonParse` read 35.8k on 2026-09-29 and 72.6k on
    2026-10-18), so cite one with its date, as an order of magnitude;
  - matching ignores case, and without a `language:` qualifier every language
    counts, so an unprefixed name can collide (`parseBoolean` matches Java's
    `Boolean.parseBoolean`);
  - a `calls` sample is GitHub's top-ranked files, not a random sample, and sees
    only the calls inside GitHub's text-match fragments;
  - `calls` scans rather than parses: it skips calls inside comments and strings
    (but not a template's `${…}`) and definitions (`function parseInt(`, a
    method followed by `{`, a typed signature followed by `:`), skips comments,
    strings, and regex literals inside a call, and counts a call it can't finish
    as `(cut off)`.
- A question none of the modes answers is a new mode in the script, not a
  one-off `gh api` or `curl` loop, so the next session gets the same method.
