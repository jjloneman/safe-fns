import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { SourceFile } from "../../scripts/research/sources.ts";

import { readJsonFile } from "../../scripts/research/json.ts";
import { parseCaseFile } from "../../scripts/research/results.ts";
import {
  checkSourceFunctions,
  toSourceColumns,
} from "../../scripts/research/sources.ts";

/*
 * The docs-only adapter: prints the columns cached in `research/sources/` for
 * tools that can't run in a container, such as Excel and Google Sheets.
 *
 * - Usage: `node sources.mts <case-file>…`, inside the `sources` Compose
 *   service.
 *
 * - Each `<tool>.json` transcribes what its `<tool>.md` excerpt settles; the
 *   columns cite the excerpt, so the tables mark them docs-only.
 */

/** Where the case files are mounted. */
const CASES_DIR = fileURLToPath(new URL("../cases/", import.meta.url));

/** Where the cached sources are mounted. */
const SOURCES_DIR = fileURLToPath(new URL("../sources/", import.meta.url));

/** Every cached source's JSON, with the excerpt it transcribes. */
const SOURCE_FILES: readonly SourceFile[] = readdirSync(SOURCES_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => ({
    json: readJsonFile(`${SOURCES_DIR}${file}`),
    source: `research/sources/${file.replace(/\.json$/u, ".md")}`,
  }));

// Against every case file, not just this run's, so a narrowed run still
// catches a misspelled function.
checkSourceFunctions({
  functionNames: readdirSync(CASES_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => parseCaseFile(readJsonFile(`${CASES_DIR}${file}`)).function),
  sourceFiles: SOURCE_FILES,
});

/** The case files named on the command line, read and narrowed. */
const CASE_FILES = process.argv
  .slice(2)
  .map((file) => parseCaseFile(readJsonFile(file)));

process.stdout.write(
  JSON.stringify({
    columns: CASE_FILES.flatMap((caseFile) =>
      toSourceColumns({ caseFile, sourceFiles: SOURCE_FILES })
    ),
  })
);
