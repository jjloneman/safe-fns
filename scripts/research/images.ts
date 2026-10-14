/*
 * Names the image each Compose service reports, and finds committed results
 * that no longer match it.
 *
 * - The runner and `pnpm research --check-images` share these functions, so
 *   the check can never disagree with what a run would record.
 *
 * - Dockerfiles are read through a caller-supplied function, which keeps
 *   everything here pure and testable without a filesystem.
 */
import path from "node:path";

import type { FunctionResult } from "./results.ts";

import { isRecord } from "./codec.ts";

/** Reads a Dockerfile's text from its resolved path. */
export type ReadDockerfile = (file: string) => string;

/** A raw Compose service, every service beside it, and how to read files. */
export type ReportedImageInput = {
  /**
   * Reads a built service's Dockerfile.
   *
   * @example `(file) => readFileSync(file, "utf8")`
   */
  readDockerfile: ReadDockerfile;

  /**
   * The service, as `docker compose config` prints it.
   *
   * @example `{ depends_on: { postgres: { … } }, image: "…" }`
   */
  service: Record<string, unknown>;

  /**
   * Every service in the config, keyed by name, for its dependencies.
   *
   * @example `{ postgres: { image: "postgres:18.6-bookworm@sha256:…" } }`
   */
  services: Record<string, unknown>;
};

/** A service whose committed columns name an image it no longer reports. */
export type StaleImage = {
  /**
   * The function whose results hold the stale columns.
   *
   * @example "safeParseBoolean"
   */
  function: string;

  /**
   * The image the columns record.
   *
   * @example `"golang:1.27.0-bookworm@sha256:…"`
   */
  recorded: string;

  /**
   * The image the service reports today, or `undefined` when no Compose
   * service has its name any more.
   *
   * @example `"golang:1.27.1-bookworm@sha256:…"`
   */
  reported: string | undefined;

  /**
   * The Compose service that produced the columns.
   *
   * @example "go"
   */
  service: string;
};

/** Committed results, and the image each service would report today. */
export type StaleImageInput = {
  /**
   * The image each Compose service reports, keyed by service name.
   *
   * @example `new Map([["go", "golang:1.27.1-bookworm@sha256:…"]])`
   */
  reportedImages: ReadonlyMap<string, string>;

  /**
   * Every committed function result.
   *
   * @example `[{ cases: [], columns: [], function: "safeParseBoolean" }]`
   */
  results: readonly FunctionResult[];
};

/** A built service's `build` section, and how to read its Dockerfile. */
type DockerfileImageInput = {
  /**
   * The service's `build`, as `docker compose config` prints it.
   *
   * @example `{ context: "/repo/research", dockerfile: "docker/node/Dockerfile" }`
   */
  build: Record<string, unknown>;
} & Pick<ReportedImageInput, "readDockerfile">;

/** A built or pulled service, and how to read its Dockerfile. */
type ImageInput = Pick<ReportedImageInput, "readDockerfile" | "service">;

/** The column `image` of the planned and docs-only columns, never checked. */
const NO_IMAGE = "-";

/** The label saying whether a service is an adapter, database, or formatter. */
export const ROLE_LABEL = "dev.safe-fns.research.role";

/** The roles a Compose service can carry in `ROLE_LABEL`. */
export const ROLES = {
  adapter: "adapter",
  database: "database",
  formatter: "formatter",
} as const;

/** Describe a stale service on one line, naming both images. */
export function describeStaleImage({
  function: functionName,
  recorded,
  reported,
  service,
}: StaleImage): string {
  if (reported === undefined) {
    return `${functionName}: "${service}" isn't a Compose service any more (results record ${recorded})`;
  }

  return `${functionName}: "${service}" reports ${reported}, but its results record ${recorded}`;
}

/**
 * Find committed columns whose image differs from what their service reports.
 *
 * - Each function, service, and recorded image is reported once, however
 *   many columns share it.
 *
 * - The planned and docs-only columns record `-` and are skipped.
 *
 * @returns the stale services, in result and column order.
 */
export function findStaleImages({
  reportedImages,
  results,
}: StaleImageInput): StaleImage[] {
  const staleImages = results.flatMap(({ columns, function: functionName }) =>
    columns.flatMap(({ image, service }) => {
      const reported = reportedImages.get(service);

      return image === NO_IMAGE || image === reported
        ? []
        : [{ function: functionName, recorded: image, reported, service }];
    })
  );

  const staleByKey = new Map(
    staleImages.map((stale) => [
      `${stale.function}\n${stale.service}\n${stale.recorded}`,
      stale,
    ])
  );

  return [...staleByKey.values()];
}

/**
 * Name the image whose answers a service reports.
 *
 * - A database adapter only relays what its database returns, so the
 *   database's image is the one a reader needs to reproduce its column.
 *
 * @returns the image of the database it depends on, or else its own.
 */
export function toReportedImage({
  readDockerfile,
  service,
  services,
}: ReportedImageInput): string {
  const dependencies = isRecord(service.depends_on) ? service.depends_on : {};

  const database = Object.keys(dependencies)
    .map((name) => services[name])
    .find(
      (dependency) =>
        isRecord(dependency) &&
        isRecord(dependency.labels) &&
        dependency.labels[ROLE_LABEL] === ROLES.database
    );

  return isRecord(database)
    ? toImage({ readDockerfile, service: database })
    : toImage({ readDockerfile, service });
}

/**
 * Read the base image a built service's Dockerfile pins.
 *
 * @returns the first `FROM` reference, or `unknown` when there is none.
 */
function imageFromDockerfile({
  build,
  readDockerfile,
}: DockerfileImageInput): string {
  const context = typeof build.context === "string" ? build.context : ".";
  const dockerfile =
    typeof build.dockerfile === "string" ? build.dockerfile : "Dockerfile";

  const text = readDockerfile(path.resolve(context, dockerfile));
  const match = /^FROM\s+(?<image>\S+)/mu.exec(text);

  return match?.groups?.image ?? "unknown";
}

/** Name the image a service runs: its pinned `image`, or a build's base. */
function toImage({ readDockerfile, service }: ImageInput): string {
  if (isRecord(service.build)) {
    return imageFromDockerfile({ build: service.build, readDockerfile });
  }

  return typeof service.image === "string" ? service.image : "unknown";
}
