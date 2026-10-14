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

## 🔷 Code

- `scripts/research/*.ts` follows the `scripts/` conventions; the Node adapter (`research/adapters/node.mts`) follows the TypeScript ones and is checked through `research/tsconfig.json`.
- **The two codecs are twins.** A change to `scripts/research/codec.ts` needs the same change in `research/adapters/research_codec.py`, and a `codec.json` case proving it.
- **Non-TS adapters follow the same conventions** ([AGENTS.md → Every language](../../AGENTS.md#-every-language)): Python is fully annotated and documented, keyword-only past one parameter, and checked by `ruff-check`.
- **Wrap an `any`-returning library call** in a small function typed `unknown` (`parseJson`, `parseYaml11`) rather than disabling the unsafe-return rule.
