---
paths:
  - "research/**"
  - "scripts/research/**"
---

# 🔬 Changing the research harness

[research/README.md](../../research/README.md) explains the case format, the adapter contract, and how to add a tool; this covers the traps.

## 🧱 Results must stay reproducible

- **Byte-identical reruns are the contract.** A change that makes two runs differ — a timestamp, an unsorted key, a column order that depends on which container finished first — is a bug.
- **Never edit `research/results/` by hand**, and never quote a table into a decision record without regenerating it first.
- **Report what the tool actually did.** If a probe needs a wrapper (a parser that returns `{ error }` instead of throwing), keep the call text honest about it.

## 🐳 Containers

- **Pin every image by version and digest**, and pick a tag last pushed at least 7 days ago; Docker Hub's `tag_last_pushed` is the date that counts, since tags get re-pushed.
- **No host ports**, no named volumes, and read-only repo mounts for adapters; only a formatter service mounts `research/adapters` writable.
- **Set the locale explicitly** (`LANG` / `LC_ALL` = `C.UTF-8`); a function that depends on locale gets explicit extra-locale cases rather than the host's.
- **Watch for distro-patched tools.** Python 3.11's image injects setuptools' `distutils` unless `SETUPTOOLS_USE_DISTUTILS=stdlib`; Debian's SQLite is older than upstream. The version column must name what really ran.
  - A tool from a Debian package reports its package version (`5.2.37-2+b10`), which names any Debian patch.
- **Install Debian packages from the base image's snapshot**, as `docker/debian/Dockerfile` does, so a rebuild can't pick up a newer package than the results were made with.
- **Pin every gem, PSGallery module, and other build-time download exactly**, at least 7 days old; a lockfile's transitive versions count too, so check each one's release date.

## 🔷 Code

- `scripts/research/*.ts` follows the `scripts/` conventions; the Node adapter (`research/adapters/node.mts`) follows the TypeScript ones and is checked through `research/tsconfig.json`.
- **The codecs are twins.** A change to `scripts/research/codec.ts` needs the same change in every `research/adapters/research_codec.*` (Python, Ruby, PHP, Swift, PowerShell), and a `codec.json` case proving it.
- **A driven adapter hands the tool a string, never a script.** Pass the value as a positional parameter or environment variable, so no quoting can change what runs; NUL can't travel that way, so it's `n/a`.
- **Check what a CLI probe really evaluated.** systemd strips leading whitespace and treats an empty assignment as a reset, so a blank value never reaches `parse_boolean`; such an input is `n/a`, not a guess.
- **PowerShell unrolls arrays on the pipeline.** Return one with the unary comma (`return , $array`); `Write-Output -NoEnumerate` hands a captured caller a `List` instead.
- **Non-TS adapters follow the same conventions** ([AGENTS.md → Every language](../../AGENTS.md#-every-language)): Python is fully annotated and documented, keyword-only past one parameter, and checked by `ruff-check`.
- **Parse JSON only through `scripts/research/json.ts`** (`parseJson`, `readJsonFile`), whose errors name the file or process; ESLint's `no-restricted-properties` rejects a bare `JSON.parse` in research code. `JSON.stringify` needs no wrapper: it only ever sees encoded values, which hold nothing it throws on.
- **Name every parameter object type and document every property**, with an `@example`, as AGENTS.md asks of all code.
- **Wrap an `any`-returning library call** in a small function typed `unknown` (`parseJson`, `parseYaml11`) rather than disabling the unsafe-return rule.
