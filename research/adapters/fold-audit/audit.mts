import anyAscii from "any-ascii";

import type {
  FoldAuditRow,
  FoldGroup,
} from "../../../scripts/research/fold-audit-table.ts";

import { FOLD_GROUPS } from "../../../scripts/research/fold-audit-table.ts";
import { packageVersion } from "../node/tool.mts";
import { foldBeforeDrop } from "./rules.mts";

/*
 * The toBasicAscii fold audit: scans every assigned code point, keeps the
 * ones the planned rules can't fold to ASCII in the groups a Latin-only table
 * could cover, and prints them as JSON for `pnpm research:audit` to render.
 *
 * - Runs in the `fold-audit` Compose service, on the `node` image, so the
 *   Unicode tables are the pinned Node's.
 */

/** The test for each group the audit lists, checked in `FOLD_GROUPS` order. */
const GROUP_TESTS: Readonly<Record<FoldGroup, RegExp>> = {
  currency: /^\p{Sc}$/u,
  letter: /^(?=\p{Script=Latin})\p{L}$/u,
  punctuation: /^(?=\p{Script=Common})\p{P}$/u,
  space: /^\p{Zs}$/u,
  symbol: /^(?=\p{Script=Common})[\p{Sk}\p{Sm}\p{So}\p{No}]$/u,
};

const GROUPS = Object.keys(FOLD_GROUPS).filter(
  (group): group is FoldGroup => group in GROUP_TESTS
);

/** The general categories a row reports, tested in this order. */
const CATEGORIES: readonly string[] = [
  "Ll",
  "Lm",
  "Lo",
  "Lt",
  "Lu",
  "No",
  "Pc",
  "Pd",
  "Pe",
  "Pf",
  "Pi",
  "Po",
  "Ps",
  "Sc",
  "Sk",
  "Sm",
  "So",
  "Zs",
];

const CATEGORY_TESTS = CATEGORIES.map(
  (category) => [category, new RegExp(`^\\p{gc=${category}}$`, "u")] as const
);

/**
 * The blocks a symbol must sit in to be listed: Latin-1 Supplement, General
 * Punctuation through Letterlike Symbols, and Supplemental Punctuation; the
 * other groups are listed from every block.
 */
const SYMBOL_BLOCKS: readonly (readonly [number, number])[] = [
  [0x0080, 0x00ff],
  [0x2000, 0x214f],
  [0x2e00, 0x2e7f],
];

/** What the scan skips: unassigned, private, surrogate, control, format, mark. */
const SKIPPED = /^[\p{Cn}\p{Co}\p{Cs}\p{Cc}\p{Cf}\p{M}]$/u;

/** Find the group a character belongs to, if the audit lists it. */
function groupOf(char: string, codePoint: number): FoldGroup | undefined {
  const group = GROUPS.find((name) => GROUP_TESTS[name].test(char));
  const isInSymbolBlock = SYMBOL_BLOCKS.some(
    ([first, last]) => codePoint >= first && codePoint <= last
  );

  return group === "symbol" && !isInSymbolBlock ? undefined : group;
}

/** Print the audit. */
function main(): void {
  const rows: FoldAuditRow[] = [];
  let unfoldable = 0;

  for (let codePoint = 0x80; codePoint <= 0x10ffff; codePoint++) {
    const char = String.fromCodePoint(codePoint);

    if (SKIPPED.test(char)) {
      continue;
    }

    const folded = foldBeforeDrop(char);

    // eslint-disable-next-line no-control-regex -- the ASCII range is the point.
    if (/^[\u0000-\u007f]+$/u.test(folded)) {
      continue;
    }

    unfoldable++;
    const group = groupOf(char, codePoint);

    if (group !== undefined) {
      rows.push({
        anyAscii: anyAscii(char),
        category:
          CATEGORY_TESTS.find(([, test]) => test.test(char))?.[0] ?? "other",
        codePoint,
        // eslint-disable-next-line no-control-regex -- the ASCII range is the point.
        folded: folded.replace(/[^\u0000-\u007f]/gu, ""),
        group,
      });
    }
  }

  process.stdout.write(
    JSON.stringify({
      anyAsciiVersion: packageVersion("any-ascii"),
      node: process.versions.node,
      rows,
      unfoldable,
      unicode: process.versions.unicode,
    })
  );
}

main();
