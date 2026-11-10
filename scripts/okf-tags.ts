/*
 * Regenerates the tag index in `docs/decisions/index.md` from the records'
 * `tags` and `DECISION_TAGS`.
 *
 * - Run through `pnpm okf:tags` after adding, removing, or retagging a
 *   record, or after changing the vocabulary; a test fails while the index is
 *   stale.
 *
 * - Rewrites only the text between the tag-index markers.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildTagIndex,
  replaceTagIndex,
  TAG_INDEX_END,
  TAG_INDEX_START,
  toTaggedRecord,
} from "./lib/decision-tags.ts";

/** The decision bundle, relative to this script. */
const BUNDLE_DIRECTORY = path.join(import.meta.dirname, "../docs/decisions");

/** The bundle's index, which holds the generated tag index. */
const INDEX_FILE = "index.md";

/** Regenerate the index, writing the file only when it changed. */
function main(): void {
  const indexPath = path.join(BUNDLE_DIRECTORY, INDEX_FILE);

  const records = readdirSync(BUNDLE_DIRECTORY)
    .filter((fileName) => fileName.endsWith(".md") && fileName !== INDEX_FILE)
    .map((fileName) =>
      toTaggedRecord({
        fileName,
        text: readFileSync(path.join(BUNDLE_DIRECTORY, fileName), "utf8"),
      })
    );

  const text = readFileSync(indexPath, "utf8");
  const updated = replaceTagIndex({ index: buildTagIndex(records), text });

  if (updated === undefined) {
    console.error(
      `[okf-tags] ${indexPath} needs ${TAG_INDEX_START} before ${TAG_INDEX_END}.`
    );
    process.exitCode = 1;

    return;
  }

  if (updated === text) {
    console.log("[okf-tags] The tag index is already current.");

    return;
  }

  writeFileSync(indexPath, updated);
  console.log(
    `[okf-tags] Updated the tag index from ${records.length} records.`
  );
}

main();
