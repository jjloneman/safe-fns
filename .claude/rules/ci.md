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
- **The timings table spans workflows.** `post-ci-timings.ts` reads the newest run of each workflow in its `TIMED_WORKFLOWS` on the PR's commit, and every one of them runs it from its own `report` job, so whichever finishes last posts the complete table.
  - A new workflow whose timings matter needs both: a line in `TIMED_WORKFLOWS`, and a `report` job that `needs:` its other jobs.
  - A workflow without a `report` job (CodeQL) stays out, since nothing would re-post the table once it finishes.
- **`concurrency` cancels superseded PR runs only.** A `main` push is that commit's record, so its group is keyed by sha and never cancelled.

## 💾 Caches

- The pnpm store is cached by `pnpm/action-setup`'s `cache: true`.
- **ESLint runs uncached** (`pnpm exec eslint .`, not `pnpm lint`).
  - Typed linting makes a file's verdict depend on the types it imports, which `.eslintcache`'s content key can't see, so a restored cache can pass a file a sibling's type change just broke.
  - A cold run takes seconds; don't add the cache back unless that stops being true, and then key it on every file a verdict can depend on.

## 🔐 Permissions

- The workflow sets `permissions: {}`, and each job grants only what it uses.
  - Only a `report` job gets `pull-requests: write` (to comment) and `actions: read` (to list the runs' jobs and download the coverage artifact): `ci.yml`'s, and `research-check.yml`'s.
  - In `release.yml`, `release-please` gets `contents`, `issues`, and `pull-requests: write` to manage the release PR, tags, and labels.
  - Only `publish` gets `id-token: write`, which npm trusted publishing exchanges for a one-off publish token.
- `actions/checkout` sets `persist-credentials: false`; the comment scripts authenticate `gh` through `GH_TOKEN`, not the git credential.

## 🚀 Release workflow

- **`publish` lives in `release.yml`, gated on `release_created`**, not in a workflow triggered by the tag or release.
  - Events created with `GITHUB_TOKEN` never start another workflow, so an `on: release` workflow would never fire.
- **`publish` checks out `tag_name`, not the triggering commit.**
  - A later push can replace the run on the release PR's merge commit, and that later run still tags the merge commit.
  - Building the run's own `github.sha` would then ship code the tag doesn't hold.
- **`concurrency` queues, never cancels**: a cancelled run could be the one on the release PR's merge commit.
  - A newer push may still replace a queued run; release-please finds a merged release PR by its `autorelease: pending` label, so the next run cuts the release.
- **Keep release-please's `label` and `release-label` at their defaults.** It finds its open release PR by `label`; `extra-label` (`🚀 release`) is applied only when the PR is first opened.
- **A step's `env` is evaluated even when its `if` skips the step.** Guard any expression that can fail on a missing output, such as `fromJSON(steps.release.outputs.pr || '{}')`.
- `release.yml` is not in `report`'s `needs:`: it is a separate workflow that runs only on `main`.

## 🔬 Research workflows

- **`research-check.yml` is path-filtered** to the harness and what it depends on: `research/**`, `scripts/research/**`, the test inputs the Node adapter imports, and the root configs and lockfile that decide how it's linted, typechecked, and formatted; the workflow's own comment lists the paths.
  - Checking `research/` costs a second install (`pnpm --dir research install`) plus container pulls for the formatters, which no other PR should pay.
  - Its own workflow, not a job in `ci.yml`: a job-level path filter would need a third-party action, and a skipped job would still show up in every PR's checks.
- **`research.yml` is `workflow_dispatch` only**: its results are reviewed and committed by hand, so a run on every push would only produce artifacts nobody reads.
  - Its inputs reach the shell through `env`, never `${{ }}` inside `run:`, so a crafted input can't inject a command.
- **Neither is in `ci.yml`'s `report` `needs:`**; they are separate workflows, like `release.yml`.
  - `research-check.yml` has a `report` job of its own instead, which re-posts the shared CI timings comment once its check ends.
- Every job that runs the harness grants only `contents: read`; only `research-check.yml`'s `report` job gets more (see Permissions).

## ⬆️ Renovate workflow

- **`renovate.yml` authenticates as a GitHub App**, minted by `actions/create-github-app-token` from `RENOVATE_APP_CLIENT_ID` and `RENOVATE_APP_PRIVATE_KEY`.
  - A PR or push made with `GITHUB_TOKEN` starts no workflows, so Renovate's PRs would never run CI.
  - The job itself grants only `contents: read`; the App's own permissions do the writing.
  - `RENOVATE_GIT_AUTHOR` and `RENOVATE_USERNAME` name the App's bot user (`safe-fns-renovate[bot]`, id `346092702`); Renovate tells its own commits from someone else's by author, and stops rebasing a branch it thinks someone else edited.
- **Its cron must overlap the config's `schedule`** (Monday 9am to noon, New York), in both EST and EDT, since Renovate creates and updates branches only inside it.
- **The Renovate CLI version is pinned** in the action's `renovate-version`, at least 7 days old, like any other dependency: it runs with write access.
- **`RENOVATE_DOCKER_MAX_PAGES` stays at 10.** Docker Hub refuses an anonymous tag listing past page 10, and Renovate then drops every tag's push date, which `minimumReleaseAge` needs to release an image update.
- **`concurrency` queues, never cancels**, so a run is never stopped partway through pushing branches.
- Like `release.yml`, it is not in `report`'s `needs:` and not in `TIMED_WORKFLOWS`: it never runs on a PR.

## 💬 Sticky comments

- Each report upserts its comment through [scripts/lib/publish-ci-report.ts](../../scripts/lib/publish-ci-report.ts), found by the report's opening `## …` heading.
  - Never switch to `gh pr comment --edit-last`: it edits the newest bot comment whatever it says, so the two reports would overwrite each other.
  - Changing a report's heading orphans its old comment on open PRs; the next run posts a new one.
- **A bug fails `report`; an outage only warns.**
  - A script's own failure — a missing scope, an unreadable summary — exits 1, so it gets fixed.
  - A failure to post that the script can't fix — the read-only token fork PRs get, an API blip — is warned about and swallowed in `publishCiReport`, so it never turns a PR red.
- Coverage is uploaded even when the gate fails (`!cancelled()`), guarded on `coverage/coverage-summary.json` existing, since a coverage drop is when the table matters most.
  - `report` downloads it by `pattern`, which matches nothing, rather than failing, when the tests never wrote it.
- Run either script locally to print its report: `node scripts/post-coverage-pr-comment.ts` after `pnpm test:coverage`, or `node scripts/post-ci-timings.ts <run-id>`.

## 📌 Pins

- Every `uses:` is pinned to an exact `vX.Y.Z`; Renovate proposes bumps once a release is 7 days old.
- Keys under `.github/` follow GitHub's documented order, not the alphabet: `name`, `on`, … `jobs` in a workflow; `name`, `if`, `uses`, `with`, `env`, `run` in a step.
  - `yml/sort-keys` enforces it through the `documentedOrder` options in `eslint.config.ts`; a key it doesn't list follows the listed ones, alphabetized.
  - `eslint --fix` reorders the keys but can strand a comment on the wrong key; check the diff after.
