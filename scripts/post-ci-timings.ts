/**
 * Publish the per-step durations of every timed workflow on this commit as one
 * sticky PR comment.
 *
 * - The timings are GitHub's own: `GET /actions/runs/{id}/jobs` carries a
 *   `steps[]` array with `started_at`/`completed_at` for every step. Nothing
 *   here instruments the `pnpm` scripts, because wrapping them would duplicate
 *   a measurement Actions already takes and add noise to local runs.
 *
 * - Each workflow in `TIMED_WORKFLOWS` runs this script from its own `report`
 *   job, and each run reads every timed workflow's latest run for the same
 *   commit; whichever finishes last posts the complete table.
 *
 * - Needs no installed package, only Node's built-ins and a sibling script, so
 *   the `report` job runs it with Node's type stripping and skips
 *   `pnpm install` — the setup prelude would otherwise dwarf a few seconds of
 *   API calls.
 *
 * - Like the coverage report, a failure to post the comment only warns, but a
 *   bug in the script itself fails the step.
 *
 * - Run locally against any finished run to print the table instead of
 *   commenting: `node scripts/post-ci-timings.ts <run-id>`; the table covers
 *   every timed workflow on that run's commit.
 */
import { execFileSync } from "node:child_process";

import { publishCiReport } from "./lib/publish-ci-report.ts";

/** The slice of an Actions job the report reads. */
type ActionsJob = {
  /** The job's display name, e.g. `🧪 Tests (Node 26)`. */
  name: string;

  /** The job's steps; absent for a job that never started. */
  steps?: ActionsStep[];
} & TimedSpan;

/** The slice of an Actions workflow run the report reads. */
type ActionsRun = {
  /** When the run was created, as an ISO timestamp; the latest one wins. */
  created_at: string;

  /** The event that started it, e.g. `pull_request`. */
  event: string;

  /** The commit it ran on. */
  head_sha: string;

  /** The run's id. */
  id: number;

  /** The workflow's display name, e.g. `☁️ CI`. */
  name: string;

  /** The workflow file, e.g. `.github/workflows/ci.yml`. */
  path: string;
};

/** The slice of an Actions step the report reads. */
type ActionsStep = {
  /** The step's `name:`, or `Run <command>` when it has none. */
  name: string;
} & TimedSpan;

/** A job's or step's outcome and span; the times are `null` until it has run. */
type TimedSpan = {
  /** When it finished, as an ISO timestamp. */
  completed_at: null | string;

  /** How it ended (`success`, `failure`, `skipped`, …); `null` while running. */
  conclusion: null | string;

  /** When it started, as an ISO timestamp. */
  started_at: null | string;
};

/** One timed workflow's latest run on the commit, with its jobs. */
type TimedWorkflow = {
  /** Every job in the run. */
  jobs: ActionsJob[];
} & Pick<ActionsRun, "id" | "name">;

/** This report's stable opening heading, used to find its own comment. */
const MARKER = "## ⏱️ CI timings";

/**
 * Steps _not_ worth a row — everything else is kept.
 *
 * - A denylist rather than an allowlist because a step carrying its own
 *   `name:` is reported under that name, losing the `Run ` prefix entirely. An
 *   allowlist keyed on the command silently drops exactly the steps someone
 *   bothered to name, which are the ones worth watching.
 */
const UNTIMED_STEP = /^(?:Set up job|Complete job|Run actions\/|Post Run )/u;

/**
 * The workflows the table covers, by file.
 *
 * - Each one runs this script from a `report` job that `needs:` all its other
 *   jobs; a workflow without one (CodeQL) would show as permanently running.
 */
const TIMED_WORKFLOWS: ReadonlySet<string> = new Set([
  ".github/workflows/ci.yml",
  ".github/workflows/research-check.yml",
]);

/**
 * Human-readable duration, matching how the Actions UI renders one.
 *
 * @param seconds - elapsed whole seconds.
 * @returns e.g. `"6s"` or `"2m28s"`.
 */
const formatDuration = (seconds: number): string =>
  seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m${seconds % 60}s`;

/**
 * Elapsed whole seconds between two ISO timestamps.
 *
 * @returns the duration, or `null` when the span never finished.
 */
const elapsedSeconds = ({
  completed_at: completedAt,
  started_at: startedAt,
}: TimedSpan): null | number => {
  if (startedAt === null || completedAt === null) {
    return null;
  }

  return Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 1000);
};

/**
 * The Duration cell for one step.
 *
 * - A skipped step reports equal start and end instants, so it would read as a
 *   genuine 0s.
 *
 * - A `null` elapsed time is a step that never finished, which is a different
 *   thing from one that took no time.
 *
 * @returns the cell's text.
 */
const stepDuration = (step: TimedSpan): string => {
  if (step.conclusion === "skipped") {
    return "skipped";
  }

  const seconds = elapsedSeconds(step);

  return seconds === null ? "—" : formatDuration(seconds);
};

/**
 * Fetch every job in a run, following pagination.
 *
 * @returns the parsed jobs.
 */
const fetchJobs = ({
  repo,
  runId,
}: {
  /** The `owner/name` repository slug. */
  repo: string;

  /** The Actions run to time. */
  runId: string;
}): ActionsJob[] => {
  const raw = execFileSync(
    "gh",
    [
      "api",
      `repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
      "--paginate",
      "--jq",
      ".jobs[] | {name, conclusion, started_at, completed_at, steps}",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );

  return raw
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ActionsJob);
};

/**
 * Fetch the latest run of every timed workflow on the same commit and event as
 * `runId`, with their jobs.
 *
 * - A re-run or a newer push to the same commit supersedes an older run of the
 *   same workflow, so only each workflow's newest run counts.
 *
 * @returns the workflows, in `TIMED_WORKFLOWS` order.
 */
const fetchTimedWorkflows = ({
  repo,
  runId,
}: {
  /** The `owner/name` repository slug. */
  repo: string;

  /** The Actions run this script is reporting from. */
  runId: string;
}): TimedWorkflow[] => {
  const current = JSON.parse(
    execFileSync("gh", ["api", `repos/${repo}/actions/runs/${runId}`], {
      encoding: "utf8",
    })
  ) as ActionsRun;

  const runs = execFileSync(
    "gh",
    [
      "api",
      `repos/${repo}/actions/runs?head_sha=${current.head_sha}&event=${current.event}&per_page=100`,
      "--paginate",
      "--jq",
      ".workflow_runs[] | {created_at, event, head_sha, id, name, path}",
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  )
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as ActionsRun);

  return [...TIMED_WORKFLOWS].flatMap((workflowPath) => {
    const latest = runs
      .filter((run) => run.path === workflowPath)
      .reduce<ActionsRun | undefined>(
        (newestRun, run) =>
          newestRun === undefined || run.created_at > newestRun.created_at
            ? run
            : newestRun,
        undefined
      );

    return latest === undefined
      ? []
      : [
          {
            id: latest.id,
            jobs: fetchJobs({ repo, runId: String(latest.id) }),
            name: latest.name,
          },
        ];
  });
};

/**
 * The slowest finished job — the run's wall time, since jobs run concurrently.
 *
 * @returns the job and its duration, or `undefined` when none has finished.
 */
const findCriticalPath = (
  jobs: readonly ActionsJob[]
): { name: string; seconds: number } | undefined =>
  jobs.reduce<{ name: string; seconds: number } | undefined>(
    (slowestJob, job) => {
      const seconds = elapsedSeconds(job);

      return seconds !== null && seconds > (slowestJob?.seconds ?? -1)
        ? { name: job.name, seconds }
        : slowestJob;
    },
    undefined
  );

/**
 * Render one workflow's section: its step table, then its whole-job totals.
 *
 * @returns the section's Markdown lines.
 */
const renderWorkflow = ({
  repo,
  workflow,
}: {
  /** The `owner/name` repository slug. */
  repo: string;

  /** The workflow run to render. */
  workflow: TimedWorkflow;
}): string[] => {
  const stepRows = workflow.jobs.flatMap((job) =>
    (job.steps ?? [])
      .filter((step) => !UNTIMED_STEP.test(step.name))
      .map(
        (step) =>
          `| ${job.name} | \`${step.name.replace(/^Run /u, "")}\` | ${stepDuration(step)} |`
      )
  );

  const jobRows = workflow.jobs.map((job) => {
    const seconds = elapsedSeconds(job);

    return `| ${job.name} | ${job.conclusion ?? "running"} | ${seconds === null ? "—" : formatDuration(seconds)} |`;
  });

  return [
    `### ${workflow.name} · [run ${workflow.id}](https://github.com/${repo}/actions/runs/${workflow.id})`,
    "",
    "| Job | Step | Duration |",
    "| :--- | :--- | ---: |",
    ...stepRows,
    "",
    "<details><summary>Whole-job totals (including the setup prelude)</summary>",
    "",
    "| Job | Result | Total |",
    "| :--- | :--- | ---: |",
    ...jobRows,
    "",
    "</details>",
    "",
  ];
};

/**
 * Render the report body.
 *
 * @returns the full Markdown, opening with {@link MARKER}.
 */
const buildMarkdown = ({
  repo,
  workflows,
}: {
  /** The `owner/name` repository slug. */
  repo: string;

  /** Every timed workflow's latest run on the commit. */
  workflows: readonly TimedWorkflow[];
}): string => {
  // Workflows run concurrently too, so the slowest job anywhere sets the pace.
  const criticalPath = findCriticalPath(
    workflows.flatMap((workflow) =>
      workflow.jobs.map((job) => ({
        ...job,
        name:
          workflows.length > 1 ? `${workflow.name} › ${job.name}` : job.name,
      }))
    )
  );

  return [
    MARKER,
    "",
    criticalPath
      ? `**Critical path: ${criticalPath.name} — ${formatDuration(criticalPath.seconds)}.** Jobs and workflows run concurrently, so CI is only as fast as its slowest job.`
      : "No completed jobs to time yet.",
    "",
    ...workflows.flatMap((workflow) => renderWorkflow({ repo, workflow })),
    "<sub>Measured from the Actions API · whole-second resolution · runner speed varies between runs, so read these as a trend, not a benchmark.</sub>",
  ].join("\n");
};

const main = (): void => {
  const repo = process.env.GITHUB_REPOSITORY ?? "jjloneman/safe-fns";

  // A run id argument is the local path: print the table, comment on nothing.
  const runId = process.argv[2] ?? process.env.GITHUB_RUN_ID;

  if (runId === undefined) {
    console.warn(
      "[post-ci-timings] No run id — pass one as an argument, or set GITHUB_RUN_ID."
    );

    return;
  }

  const markdown = buildMarkdown({
    repo,
    workflows: fetchTimedWorkflows({ repo, runId }),
  });

  publishCiReport({ localConsole: markdown, markdown, marker: MARKER });
};

try {
  main();
} catch (error: unknown) {
  /*
   * A failure here is the script's own — a missing `actions: read` scope, a
   * malformed payload — so it fails the step to get fixed.
   *
   * - Posting problems a script can't fix (a read-only token, an API blip) are
   *   warned about and swallowed in `publishCiReport`, so they never reach
   *   here.
   */
  console.error("[post-ci-timings] Fatal error:", error);
  process.exit(1);
}
