/*
 * The consumer TypeScript support matrix, shared by `pnpm test:consumer` and
 * `pnpm research:types`, so both check the same compilers.
 */

export type ResolutionMode =
  (typeof RESOLUTION_MODES)[keyof typeof RESOLUTION_MODES];

export type TypeScriptVersion = {
  /** The dev-dependency alias the compiler is installed under. */
  packageName: string;

  /** The resolution modes this version understands. */
  resolutionModes: readonly ResolutionMode[];
};

/*
 * Each mode compiles the fixture under the file extensions that mode treats
 * differently.
 *
 * - `node16` checks both a CommonJS (`.cts`) and an ES module (`.mts`)
 *   importer, since each resolves a different `exports` condition.
 */
export const RESOLUTION_MODES = {
  bundler: {
    files: ["types.ts"],
    flags: ["--module", "esnext", "--moduleResolution", "bundler"],
    name: "bundler",
  },
  node10: {
    files: ["types.ts"],
    flags: ["--module", "commonjs", "--moduleResolution", "node"],
    name: "node10",
  },
  node16: {
    files: ["types.cts", "types.mts"],
    flags: ["--module", "node16", "--moduleResolution", "node16"],
    name: "node16",
  },
} as const;

const { bundler, node10, node16 } = RESOLUTION_MODES;

/*
 * The consumer TypeScript support matrix.
 *
 * - `bundler` resolution arrived in 5.0.
 *
 * - `node10` resolution is deprecated in 6.0 and removed in 7.0.
 */
export const TYPESCRIPT_VERSIONS: readonly TypeScriptVersion[] = [
  { packageName: "typescript-4.9", resolutionModes: [node10, node16] },
  { packageName: "typescript-5.0", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript-5.4", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript-5.9", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript", resolutionModes: [bundler, node10, node16] },
  { packageName: "typescript-7.0", resolutionModes: [bundler, node16] },
];
