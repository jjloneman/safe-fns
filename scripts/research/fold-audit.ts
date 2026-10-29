import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { parseFoldAuditReport, renderFoldAudit } from "./fold-audit-table.ts";
import { parseJson } from "./json.ts";
import { describeError, printPrefixed } from "./logging.ts";

/*
 * `pnpm research:audit`: runs the toBasicAscii fold audit in its pinned
 * container and writes `research/audits/to-basic-ascii.md`.
 *
 * - `--check` compares instead of writing, and fails on any difference.
 */

const AUDIT_FILE = fileURLToPath(
  new URL("../../research/audits/to-basic-ascii.md", import.meta.url)
);

const COMPOSE_FILE = fileURLToPath(
  new URL("../../research/compose.yaml", import.meta.url)
);

/** The container's output can be large: every row of the audit. */
const MAX_BUFFER = 64 * 1024 * 1024;

/** Run one Compose command, returning what it printed. */
function compose(args: readonly string[]): string {
  return execFileSync("docker", ["compose", "--file", COMPOSE_FILE, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Print one line, prefixed with the script's name. */
function log(message: string): void {
  console.log(`[fold-audit] ${message}`);
}

/** Read the committed audit, or `undefined` if there is none. */
function readCommitted(): string | undefined {
  try {
    return readFileSync(AUDIT_FILE, "utf8");
  } catch {
    return undefined;
  }
}

/** Run the audit, then write or check it. */
function main(): void {
  const { values } = parseArgs({ options: { check: { type: "boolean" } } });

  log("building and running the fold-audit service");
  compose(["build", "fold-audit"]);

  const output = compose(["run", "--rm", "--no-deps", "fold-audit"]);
  const report = parseFoldAuditReport(
    parseJson({ source: "the fold-audit service", text: output })
  );

  if (report === undefined) {
    throw new Error("the fold-audit service printed a malformed report");
  }

  const markdown = renderFoldAudit(report);

  if (values.check === true) {
    if (readCommitted() !== markdown) {
      log(
        "research/audits/to-basic-ascii.md is stale; run pnpm research:audit"
      );
      process.exitCode = 1;

      return;
    }

    log("research/audits/to-basic-ascii.md is up to date");

    return;
  }

  writeFileSync(AUDIT_FILE, markdown);
  log(
    `wrote research/audits/to-basic-ascii.md (${String(report.rows.length)} rows)`
  );
}

try {
  main();
} catch (error) {
  printPrefixed({
    message: describeError(error),
    prefix: "[fold-audit]",
    print: (line) => {
      console.error(line);
    },
  });
  process.exitCode = 1;
}
