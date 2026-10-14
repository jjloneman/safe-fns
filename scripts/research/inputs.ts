/*
 * Fingerprints the files that pin what a Compose service runs, and finds
 * committed results that no longer match them.
 *
 * - `images.ts` checks a column's image; this covers what an image can't
 *   show: a service's Dockerfile, and the lockfiles and manifests it declares
 *   in `INPUTS_LABEL`.
 *
 * - The runner and `pnpm research --check-inputs` share these functions, so
 *   the check can never disagree with what a run would record.
 *
 * - Files are read through a caller-supplied function, which keeps
 *   everything here pure and testable without a filesystem.
 */
import { createHash } from "node:crypto";
import path from "node:path";

import type { FunctionResult } from "./results.ts";

import { isRecord } from "./codec.ts";
import { NO_IMAGE, toDockerfilePath, toStaleKey } from "./images.ts";

/** Reads an input file's bytes from its resolved path. */
export type ReadInput = (file: string) => Uint8Array;

/** The files a service's results depend on, and their fingerprint. */
export type ServiceInputs = {
  /**
   * The files, relative to `research/` and sorted.
   *
   * @example `["docker/db/Dockerfile", "docker/db/requirements.txt"]`
   */
  files: string[];

  /**
   * A SHA-256 of every file's path and contents.
   *
   * @example `"sha256:3b5d…"`
   */
  fingerprint: string;
};

/** A raw Compose service, and how to find and read its input files. */
export type ServiceInputsInput = {
  /**
   * The Compose service name, for an unreadable input's error.
   *
   * @example "postgres-adapter"
   */
  name: string;

  /**
   * Reads an input file.
   *
   * @example `(file) => readFileSync(file)`
   */
  readInput: ReadInput;

  /**
   * The absolute path of `research/`, which input paths are relative to.
   *
   * @example "/repo/research"
   */
  researchDir: string;

  /**
   * The service, as `docker compose config` prints it.
   *
   * @example `{ build: { … }, labels: { … } }`
   */
  service: Record<string, unknown>;
};

/** A service whose committed columns record different inputs than it has. */
export type StaleInputs = {
  /**
   * The files the service depends on today.
   *
   * @example `["docker/ruby/Dockerfile", "docker/ruby/Gemfile.lock"]`
   */
  files: string[];

  /**
   * The function whose results hold the stale columns.
   *
   * @example "safeParseBoolean"
   */
  function: string;

  /**
   * The fingerprint the columns record, or `undefined` when they record none.
   *
   * @example `"sha256:3b5d…"`
   */
  recorded: string | undefined;

  /**
   * The Compose service that produced the columns.
   *
   * @example "ruby"
   */
  service: string;
};

/** Committed results, and each service's inputs today. */
export type StaleInputsInput = {
  /**
   * Every committed function result.
   *
   * @example `[{ cases: [], columns: [], function: "safeParseBoolean" }]`
   */
  results: readonly FunctionResult[];

  /**
   * Each Compose service's inputs, keyed by service name.
   *
   * @example `new Map([["ruby", { files: […], fingerprint: "sha256:…" }]])`
   */
  serviceInputs: ReadonlyMap<string, ServiceInputs>;
};

/** One declared input, and the service that declares it. */
type DeclaredInput = {
  /**
   * The input's path, relative to `research/`.
   *
   * @example "docker/db/requirements.txt"
   */
  file: string;
} & Pick<ServiceInputsInput, "name" | "readInput" | "researchDir">;

/**
 * The label listing a service's input files, whitespace-separated and
 * relative to `research/`; a built service's Dockerfile is added without
 * being listed.
 */
export const INPUTS_LABEL = "dev.safe-fns.research.inputs";

/** Describe a stale service on one line, naming its input files. */
export function describeStaleInputs({
  files,
  function: functionName,
  recorded,
  service,
}: StaleInputs): string {
  if (recorded === undefined) {
    return `${functionName}: "${service}" columns record no input fingerprint`;
  }

  if (files.length === 0) {
    return `${functionName}: "${service}" declares no inputs, but its results record some`;
  }

  return `${functionName}: "${service}" results don't match its inputs (${files.join(", ")})`;
}

/**
 * Find committed columns whose inputs differ from their service's today.
 *
 * - Each function and service is reported once, however many columns share
 *   it.
 *
 * - The planned and docs-only columns record no image and are skipped, and
 *   so is a removed service, which `findStaleImages` already reports.
 *
 * @returns the stale services, in result and column order.
 */
export function findStaleInputs({
  results,
  serviceInputs,
}: StaleInputsInput): StaleInputs[] {
  const staleInputs = results.flatMap(({ columns, function: functionName }) =>
    columns.flatMap(({ image, inputs, service }) => {
      const current = serviceInputs.get(service);

      return image === NO_IMAGE ||
        current === undefined ||
        inputs === current.fingerprint
        ? []
        : [
            {
              files: current.files,
              function: functionName,
              recorded: inputs,
              service,
            },
          ];
    })
  );

  const staleByKey = new Map(
    staleInputs.map((stale) => [toStaleKey(stale), stale])
  );

  return [...staleByKey.values()];
}

/**
 * Fingerprint the files a service's results depend on.
 *
 * - The fingerprint hashes each file's path relative to `research/`, never
 *   an absolute one, so the owner's machine and CI agree.
 *
 * @returns the files and their fingerprint.
 * @throws Error naming the service and file when an input can't be read, so
 *   a renamed lockfile can't silently drop out of the fingerprint.
 */
export function toServiceInputs({
  name,
  readInput,
  researchDir,
  service,
}: ServiceInputsInput): ServiceInputs {
  const labels = isRecord(service.labels) ? service.labels : {};
  const declared = labels[INPUTS_LABEL];

  const dockerfiles = isRecord(service.build)
    ? [path.relative(researchDir, toDockerfilePath(service.build))]
    : [];

  const files = [
    ...new Set([
      ...(typeof declared === "string" ? toDeclaredFiles(declared) : []),
      ...dockerfiles,
    ]),
  ].sort();

  const manifest = files
    .map(
      (file) =>
        `${sha256(readDeclaredInput({ file, name, readInput, researchDir }))}  ${file}\n`
    )
    .join("");

  return { files, fingerprint: `sha256:${sha256(manifest)}` };
}

/** Read one input, naming its service when it can't be read. */
function readDeclaredInput({
  file,
  name,
  readInput,
  researchDir,
}: DeclaredInput): Uint8Array {
  try {
    return readInput(path.resolve(researchDir, file));
  } catch (error) {
    throw new Error(`the ${name} service can't read its input ${file}`, {
      cause: error,
    });
  }
}

/** Hash bytes or text with SHA-256. */
function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Split an inputs label into paths, tolerating any run of whitespace.
 *
 * - Normalizing lets `./docker/x/Dockerfile` match the Dockerfile path the
 *   build adds, so a file is never hashed twice under two names.
 */
function toDeclaredFiles(declared: string): string[] {
  return declared
    .split(/\s+/u)
    .filter((file) => file !== "")
    .map((file) => path.normalize(file));
}
