import { fileURLToPath } from "node:url";

import type { Tier } from "../../../scripts/research/results.ts";

import { readJsonFile } from "../../../scripts/research/json.ts";

/** One expression a tool offers for a function. */
export type Probe = {
  /**
   * Whether the call can take these arguments at all; `n/a` otherwise.
   *
   * @example `([value]) => typeof value === "string"`
   */
  accepts?: (args: readonly unknown[]) => boolean;

  /**
   * The expression, as the table header shows it.
   *
   * @example "yn(value)"
   */
  call: string;

  /**
   * Runs the expression on one case's decoded arguments.
   *
   * @example `([value]) => yn(value)`
   */
  run: (args: readonly unknown[]) => unknown;
};

/** A library or runtime, and its probes for each function. */
export type Tool = {
  /**
   * Probes keyed by the function name in a case file.
   *
   * @example `{ safeParseBoolean: [{ call: "yn(value)", run }] }`
   */
  functions: Record<string, readonly Probe[]>;

  /**
   * The display name.
   *
   * @example "zod"
   */
  name: string;

  /**
   * The table tier.
   *
   * @example 1
   */
  tier: Tier;

  /**
   * The version, read from the installed package.
   *
   * @example "4.6.5"
   */
  version: string;
};

/** Accept only a string first argument; other cases are `n/a`. */
export const isString = ([value]: readonly unknown[]): boolean =>
  typeof value === "string";

/** Read an installed library's version. */
export function packageVersion(name: string): string {
  // Read from disk: some packages leave `package.json` out of `exports`.
  const manifest = readJsonFile(
    fileURLToPath(
      new URL(`../../node_modules/${name}/package.json`, import.meta.url)
    )
  );

  return typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
    ? manifest.version
    : "unknown";
}
