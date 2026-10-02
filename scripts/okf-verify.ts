/*
 * Signs off OKF records interactively: marks the ones you pick `status: stable`
 * with a `verified` entry, then commits just those files.
 *
 * - Refuses to run without a terminal on both stdin and stdout, and has no flag
 *   to skip the prompts: AGENTS.md says only a person adds `verified`.
 *
 * - Never passes `--no-verify` and never pushes.
 *
 * - Run through `pnpm okf:verify [bundle-dir]`; the bundle defaults to
 *   `docs/decisions`.
 */
import * as prompts from "@clack/prompts";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { RecordState, RecordSummary } from "./lib/okf-frontmatter.ts";

import {
  getRecordState,
  readRecordSummary,
  verifyRecord,
} from "./lib/okf-frontmatter.ts";

/**
 * A record in the bundle that could be verified.
 */
type Candidate = {
  /** Path from the repo root, as git prints it. */
  filePath: string;

  /** Whether the record still needs a sign-off. */
  state: RecordState;

  /** The frontmatter fields shown in the checklist. */
  summary: RecordSummary;

  /** The record as it is on disk. */
  text: string;
};

/** Who a `verified` entry is recorded as. */
const verifiedBy = "human:jjloneman";
/** The bundle verified when no directory is given. */
const defaultBundleDir = "docs/decisions";
/** The branch a record counts as changed against. */
const baseBranch = "main";

/**
 * Report that nothing changed, then end the run.
 */
function cancelAndExit(): never {
  prompts.cancel("Nothing changed.");

  return process.exit(0);
}

/**
 * Print an error, then end the run with a failing exit code.
 */
function fail(message: string): never {
  console.error(message);

  return process.exit(1);
}

/**
 * Find the root of the repo the script was run from.
 */
function findRepoRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fail("okf:verify must run inside the safe-fns git repository.");
  }
}

/**
 * Run a git command from the repo root.
 *
 * @returns its standard output.
 */
function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

/** The root every git command and record path is relative to. */
const repoRoot = findRepoRoot();

/**
 * Build the commit message: a subject counting the records, then one bullet
 * per record.
 */
function buildCommitMessage(
  bundleName: string,
  selected: readonly Candidate[]
): string {
  const types = new Set(selected.map(({ summary }) => summary.type));
  const [onlyType] = types.size === 1 ? types : [];
  const noun = onlyType?.toLowerCase() ?? "okf";
  const count = selected.length;
  const bullets = selected.map(
    ({ filePath, summary }) =>
      `- ${summary.title ?? path.basename(filePath)} (${path.basename(filePath)})`
  );

  return [
    `docs(${bundleName}): 📝 verify ${count} ${noun} ${count === 1 ? "record" : "records"}`,
    "",
    ...bullets,
  ].join("\n");
}

/**
 * Ask which records to verify.
 *
 * - Offers the changed records first, with a choice to widen to all of them.
 *
 * - Ends the run when the user cancels or nothing is left to verify.
 */
async function chooseCandidates(
  all: readonly Candidate[],
  changed: readonly Candidate[]
): Promise<readonly Candidate[]> {
  if (all.length === 0) {
    return fail("No records found.");
  }

  const shouldOfferToggle = changed.length > 0 && all.length > changed.length;
  let shown = changed.length > 0 ? changed : all;

  if (shouldOfferToggle) {
    const scope = await prompts.select({
      message: "Which records?",
      options: [
        {
          label: `Changed on this branch (${changed.length})`,
          value: "changed",
        },
        { label: `Every record in the bundle (${all.length})`, value: "all" },
      ],
    });

    if (prompts.isCancel(scope)) {
      return cancelAndExit();
    }

    shown = scope === "all" ? all : changed;
  } else if (changed.length === 0) {
    prompts.log.info(
      "No records changed on this branch; showing every record."
    );
  }

  const selectable = shown.filter(({ state }) => state !== "verified");

  if (selectable.length === 0) {
    prompts.outro("Every listed record is already verified.");

    return process.exit(0);
  }

  const chosen = await prompts.multiselect({
    message: "Which records do you verify? (space toggles, a toggles all)",
    options: shown.map((candidate) => ({
      disabled: candidate.state === "verified",
      hint: describeState(candidate),
      label: `${candidate.summary.title ?? "(untitled)"} — ${path.basename(candidate.filePath)}`,
      value: candidate,
    })),
    required: true,
  });

  return prompts.isCancel(chosen) ? cancelAndExit() : chosen;
}

/**
 * Word a candidate's state as the hint shown beside it in the checklist.
 */
function describeState(candidate: Candidate): string {
  const hints: Record<RecordState, string> = {
    changed: "changed since you verified it",
    unverified: candidate.summary.status ?? "stable",
    verified: "already verified, unchanged",
  };

  return hints[candidate.state];
}

/**
 * Whether git sees any uncommitted change to a file.
 */
function hasUncommittedChanges(filePath: string): boolean {
  return git(["status", "--porcelain", "--", filePath]).trim() !== "";
}

/**
 * List the changed files under `bundleDir`, from the branch diff and the
 * working tree.
 *
 * @returns the paths, and whether the branch diff was unavailable.
 */
function listChangedPaths(bundleDir: string): {
  hasBranchDiff: boolean;
  paths: Set<string>;
} {
  const paths = new Set<string>();
  let hasBranchDiff = true;

  try {
    git(["diff", "--name-only", "-z", `${baseBranch}...HEAD`, "--", bundleDir])
      .split("\0")
      .filter(Boolean)
      .forEach((changedPath) => paths.add(changedPath));
  } catch {
    hasBranchDiff = false;
  }

  const entries = git(["status", "--porcelain", "-z", "-uall", "--", bundleDir])
    .split("\0")
    .filter(Boolean);

  // A rename or copy is followed by an extra entry holding its origin path.
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? "";
    paths.add(entry.slice(3));

    if (entry.startsWith("R") || entry.startsWith("C")) {
      index += 1;
    }
  }

  return { hasBranchDiff, paths };
}

/**
 * Read a record from disk.
 *
 * @returns the candidate, or `undefined` when it has no frontmatter block.
 */
function loadCandidate(filePath: string): Candidate | undefined {
  const text = readFileSync(path.join(repoRoot, filePath), "utf8");
  const summary = readRecordSummary(text, { verifiedBy });

  return summary === undefined
    ? undefined
    : { filePath, state: getRecordState(summary), summary, text };
}

/**
 * Run the interactive flow: choose, confirm, edit, commit.
 */
async function main(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(
      "okf:verify needs an interactive terminal: only a person may add `verified`."
    );
  }

  const { positionals } = parseArgs({ allowPositionals: true });
  const bundleDir = path
    .normalize(positionals[0] ?? defaultBundleDir)
    .replace(/[/\\]+$/, "");

  const bundleName = path.basename(bundleDir);

  prompts.intro(`Verify records in ${bundleDir}`);

  const { hasBranchDiff, paths: changedPaths } = listChangedPaths(bundleDir);

  if (!hasBranchDiff) {
    prompts.log.warn(
      `Can't diff against ${baseBranch}; showing uncommitted changes only.`
    );
  }

  const all = readdirSync(path.join(repoRoot, bundleDir))
    .filter((name) => name.endsWith(".md") && name !== "index.md")
    .sort()
    .map((name) => loadCandidate(path.posix.join(bundleDir, name)))
    .filter((candidate) => candidate !== undefined);

  const changed = all.filter(({ filePath }) => changedPaths.has(filePath));
  const selected = await chooseCandidates(all, changed);

  const at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const edits = selected.map((candidate) => ({
    candidate,
    result: verifyRecord(candidate.text, { at, verifiedBy }),
  }));
  const failures = edits.flatMap(({ candidate, result }) =>
    result.isOk ? [] : [`${candidate.filePath}: ${result.reason}`]
  );

  if (failures.length > 0) {
    return fail(`No files changed.\n${failures.join("\n")}`);
  }

  const message = buildCommitMessage(bundleName, selected);
  const filePaths = selected.map(({ filePath }) => filePath);
  const dirtyPaths = filePaths.filter((filePath) =>
    hasUncommittedChanges(filePath)
  );

  prompts.note(
    `${filePaths.join("\n")}\n\n${message}`,
    "Files and commit message"
  );

  if (dirtyPaths.length > 0) {
    prompts.log.warn(
      `These also have other uncommitted changes, which the commit will include:\n${dirtyPaths.join("\n")}`
    );
  }

  const isConfirmed = await prompts.confirm({ message: "Verify and commit?" });

  if (prompts.isCancel(isConfirmed) || !isConfirmed) {
    return cancelAndExit();
  }

  edits.forEach(({ candidate, result }) => {
    if (result.isOk) {
      writeFileSync(path.join(repoRoot, candidate.filePath), result.text);
    }
  });

  try {
    git(["add", "--", ...filePaths]);
    git(["commit", "-m", message, "--", ...filePaths]);
  } catch (error) {
    const output = error as { stderr?: string; stdout?: string };

    return fail(
      `The files are edited on disk but the commit failed:\n${output.stdout ?? ""}${output.stderr ?? ""}`
    );
  }

  prompts.outro(`Verified ${filePaths.length}, committed.`);
}

await main();
