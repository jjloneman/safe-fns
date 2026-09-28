---
paths:
  - ".github/**"
  - "scripts/post-ci-timings.ts"
  - "scripts/post-coverage-pr-comment.ts"
  - "scripts/lib/publish-ci-report.ts"
---

# 🤖 Changing CI

What to know before editing a workflow. AGENTS.md's CI section lists what runs; this covers why it is shaped that way.

## 🧱 Job layout

- **Jobs run in parallel**, and each pays the setup prelude in [.github/actions/setup/action.yml](../../.github/actions/setup/action.yml) (pnpm → Node → `pnpm install --frozen-lockfile`).
  - A new job only earns its place if its work takes appreciably longer than that prelude; otherwise add a step to an existing job.
  - `actions/checkout` must come **before** `uses: ./.github/actions/setup` in every job, since the action file is only on disk after checkout.
- **The `test` matrix passes `node-version` into the setup action**; every other job takes its default (26).
  - Only the Node 26 leg runs `pnpm test:coverage` and uploads `coverage/` for the `report` job, so a gate failure is reported once, not three times.
  - `fail-fast: false`, so one Node's failure doesn't hide whether the others pass.
- **`report` posts both PR comments** and skips the setup action: it only needs Node, which runs the scripts by stripping their types, so installing would multiply its runtime.
  - That means the report scripts and anything they import may use only Node built-ins — never a package from `node_modules`.
  - Posting from `report`, not from the job a report describes, is what keeps a broken report from turning `Tests` red.
- **`report` lists every other job in `needs:`.** Add a new job there too, or its steps are missing from the timings table.
- **`concurrency` cancels superseded PR runs only.** A `main` push is that commit's record, so its group is keyed by sha and never cancelled.

## 💾 Caches

- The pnpm store is cached by `pnpm/action-setup`'s `cache: true`.
- **ESLint runs uncached** (`pnpm exec eslint .`, not `pnpm lint`).
  - Typed linting makes a file's verdict depend on the types it imports, which `.eslintcache`'s content key can't see, so a restored cache can pass a file a sibling's type change just broke.
  - A cold run takes seconds; don't add the cache back unless that stops being true, and then key it on every file a verdict can depend on.

## 🔐 Permissions

- The workflow sets `permissions: {}`, and each job grants only what it uses.
  - Only `report` gets `pull-requests: write` (to comment) and `actions: read` (to list the run's jobs and download the coverage artifact).
- `actions/checkout` sets `persist-credentials: false`; the comment scripts authenticate `gh` through `GH_TOKEN`, not the git credential.

## 💬 Sticky comments

- Each report upserts its comment through [scripts/lib/publish-ci-report.ts](../../scripts/lib/publish-ci-report.ts), found by the report's opening `## …` heading.
  - Never switch to `gh pr comment --edit-last`: it edits the newest bot comment whatever it says, so the two reports would overwrite each other.
  - Changing a report's heading orphans its old comment on open PRs; the next run posts a new one.
- **A bug fails `report`; an outage only warns.**
  - A script's own failure — a missing scope, an unreadable summary — exits 1, so it gets fixed.
  - A failure to post that the script can't fix — the read-only token Dependabot and fork PRs get, an API blip — is warned about and swallowed in `publishCiReport`, so it never turns a PR red.
- Coverage is uploaded even when the gate fails (`!cancelled()`), guarded on `coverage/coverage-summary.json` existing, since a coverage drop is when the table matters most.
  - `report` downloads it by `pattern`, which matches nothing, rather than failing, when the tests never wrote it.
- Run either script locally to print its report: `node scripts/post-coverage-pr-comment.ts` after `pnpm test:coverage`, or `node scripts/post-ci-timings.ts <run-id>`.

## 📌 Pins

- Every `uses:` is pinned to an exact `vX.Y.Z`; Dependabot proposes bumps after a 7-day cooldown.
- Keys under `.github/` follow GitHub's documented order, not the alphabet: `name`, `on`, … `jobs` in a workflow; `name`, `if`, `uses`, `with`, `env`, `run` in a step.
  - `yml/sort-keys` enforces it through the `documentedOrder` options in `eslint.config.ts`; a key it doesn't list follows the listed ones, alphabetized.
  - `eslint --fix` reorders the keys but can strand a comment on the wrong key; check the diff after.
