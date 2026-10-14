/*
 * Runs the cross-language comparison harness, `pnpm research`.
 *
 * - Every adapter service in `research/compose.yaml` runs over the case files
 *   in `research/cases/`, in parallel, and the merged results are written to
 *   `research/results/` as JSON plus a generated Markdown table.
 *
 * - `--function <name>` and `--profile <name>` narrow the run; both repeat.
 *   `--concurrency <n>` caps parallel containers (default: the Docker VM's CPU
 *   count).
 *
 * - `--format` formats every adapter (Prettier on the host, each other
 *   language's formatter in its container); `--format --check` only reports
 *   drift.
 */
import type { ChildProcess } from "node:child_process";

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { CaseFile, FunctionResult, ServiceColumns } from "./results.ts";

import { isRecord } from "./codec.ts";
import {
  buildResults,
  CODEC_FUNCTION,
  findCodecMismatches,
  mergeWithPrevious,
  parseAdapterOutput,
  parseCaseFile,
  parseFunctionResult,
  stringifyStable,
} from "./results.ts";
import { renderResultMarkdown } from "./tables.ts";

/** What a finished child process printed, and how it exited. */
type CommandResult = {
  /** The exit code, or 1 when the process died on a signal. */
  exitCode: number;

  /** Everything written to stderr. */
  stderr: string;

  /** Everything written to stdout. */
  stdout: string;
};

/** One service from `research/compose.yaml`, as the runner needs it. */
type ComposeService = {
  /** The pinned image it runs, or a built image's pinned base. */
  image: string;

  /** The labels it carries, such as its role and formatter arguments. */
  labels: Record<string, string>;

  /** The Compose service name. */
  name: string;

  /** The profiles that enable it. */
  profiles: string[];
};

/** A case file, with the path an adapter reads it from inside its container. */
type LoadedCaseFile = {
  /** The path inside the container, under the `/work` mount. */
  containerPath: string;

  /** The file's name without `.json`, which names its results too. */
  stem: string;
} & CaseFile;

const CASES_DIR = path.resolve(import.meta.dirname, "../../research/cases");

const CHECK_ARGS_LABEL = "dev.safe-fns.research.check-args";

/**
 * How long any one command may run before it's killed.
 *
 * - Generous enough for a cold image pull or build; a stuck adapter fails the
 *   run instead of hanging it, locally and in CI.
 */
const COMMAND_TIMEOUT_MS = 15 * 60 * 1000;

const COMPOSE_FILE = path.resolve(
  import.meta.dirname,
  "../../research/compose.yaml"
);

const FORMAT_ARGS_LABEL = "dev.safe-fns.research.format-args";
const LOG_PREFIX = "[research]";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const RESULTS_DIR = path.resolve(import.meta.dirname, "../../research/results");
const ROLE_LABEL = "dev.safe-fns.research.role";

/** The roles a Compose service can carry in `ROLE_LABEL`. */
const ROLES = { adapter: "adapter", formatter: "formatter" } as const;

/**
 * Run Compose against the research file.
 *
 * @returns what the command printed and how it exited.
 */
function compose(args: readonly string[]): Promise<CommandResult> {
  return runCommand({
    args: ["compose", "--file", COMPOSE_FILE, ...args],
    command: "docker",
  });
}

/**
 * Format, or check, every adapter.
 *
 * @returns whether every formatter succeeded.
 */
async function formatAdapters({
  services,
  shouldCheck,
}: {
  services: readonly ComposeService[];
  shouldCheck: boolean;
}): Promise<boolean> {
  const formatters = services.filter(
    ({ labels }) => labels[ROLE_LABEL] === ROLES.formatter
  );

  const label = shouldCheck ? CHECK_ARGS_LABEL : FORMAT_ARGS_LABEL;

  const containerRuns = formatters.map((service) => {
    const formatterArgs = service.labels[label];

    if (formatterArgs === undefined) {
      throw new Error(`the ${service.name} service lacks the ${label} label`);
    }

    return { args: formatterArgs.split(" "), service };
  });

  /*
   * Prettier never touches what the container formatters do, so it runs
   * beside them.
   *
   * - Checks run in parallel; writes run one container at a time, since two
   *   (`ruff format` and `ruff check --fix`) can rewrite the same file.
   */
  const containerTasks = containerRuns.map(({ args, service }) => async () => ({
    name: service.name,
    result: await runService({ args, service }),
  }));

  const [prettier, containerResults] = await Promise.all([
    runCommand({
      args: [
        "exec",
        "prettier",
        // Name only the files that are (or were) unformatted.
        "--log-level",
        "warn",
        shouldCheck ? "--check" : "--write",
        "research",
      ],
      command: "pnpm",
    }),
    shouldCheck
      ? Promise.all(containerTasks.map((task) => task()))
      : runSequentially(containerTasks),
  ]);

  const results = [{ name: "prettier", result: prettier }, ...containerResults];

  // Log every formatter before deciding, so one failure never hides another's.
  const statuses = results.map(({ name, result }) => {
    // Compose narrates container setup on stderr; show it only on failure.
    const output =
      result.exitCode === 0 ? result.stdout : result.stdout + result.stderr;

    log(`${name}:\n${output.trim() || "no changes"}`);

    return result.exitCode === 0;
  });

  return statuses.every(Boolean);
}

/**
 * Read the base image a built service's Dockerfile pins.
 *
 * @returns the first `FROM` reference.
 */
function imageFromDockerfile(build: Record<string, unknown>): string {
  const context = typeof build.context === "string" ? build.context : ".";
  const dockerfile =
    typeof build.dockerfile === "string" ? build.dockerfile : "Dockerfile";

  const text = readFileSync(path.resolve(context, dockerfile), "utf8");
  const match = /^FROM\s+(?<image>\S+)/mu.exec(text);

  return match?.groups?.image ?? "unknown";
}

/**
 * Read and narrow the case files, keeping `codec` and the requested functions.
 *
 * @throws Error when a requested function matches no case file, so a typo
 *   fails instead of quietly regenerating nothing.
 */
function loadCaseFiles(functionNames: readonly string[]): LoadedCaseFile[] {
  const caseFiles = readdirSync(CASES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      ...parseCaseFile(
        JSON.parse(readFileSync(path.join(CASES_DIR, file), "utf8"))
      ),
      containerPath: `/work/research/cases/${file}`,
      stem: file.replace(/\.json$/u, ""),
    }));

  const unknownNames = functionNames.filter(
    (name) =>
      !caseFiles.some(
        (caseFile) => caseFile.function === name || caseFile.stem === name
      )
  );

  if (unknownNames.length > 0) {
    throw new Error(`no case file for --function ${unknownNames.join(", ")}`);
  }

  return caseFiles.filter(
    (caseFile) =>
      functionNames.length === 0 ||
      caseFile.function === CODEC_FUNCTION ||
      functionNames.includes(caseFile.function) ||
      functionNames.includes(caseFile.stem)
  );
}

/** Read the services from Compose's resolved config. */
async function loadServices(): Promise<ComposeService[]> {
  const result = await compose([
    "--profile",
    "*",
    "config",
    "--format",
    "json",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`docker compose config failed:\n${result.stderr}`);
  }

  const config: unknown = JSON.parse(result.stdout);
  const services = isRecord(config) ? config.services : undefined;

  if (!isRecord(services)) {
    throw new Error("docker compose config printed no services");
  }

  return Object.entries(services).flatMap(([name, service]) => {
    if (!isRecord(service)) {
      return [];
    }

    return [
      {
        image: toImage(service),
        labels: toStringRecord(service.labels),
        name,
        profiles: Array.isArray(service.profiles)
          ? service.profiles.filter(
              (profile): profile is string => typeof profile === "string"
            )
          : [],
      },
    ];
  });
}

/** Print a message, prefixing every line. */
function log(message: string): void {
  for (const line of message.split("\n")) {
    console.log(`${LOG_PREFIX} ${line}`);
  }
}

/** Print an error, prefixing every line. */
function logError(message: string): void {
  for (const line of message.split("\n")) {
    console.error(`${LOG_PREFIX} ${line}`);
  }
}

/** Turn profile names into Compose's `--profile` flags. */
function profileArgs(profiles: readonly string[]): string[] {
  return profiles.flatMap((profile) => ["--profile", profile]);
}

/** Read a function's committed result, if there is one. */
function readPreviousResult(stem: string): FunctionResult | undefined {
  const file = path.join(RESULTS_DIR, `${stem}.json`);

  return existsSync(file)
    ? parseFunctionResult(JSON.parse(readFileSync(file, "utf8")))
    : undefined;
}

/** Read `--concurrency`, or default to the Docker VM's CPU count. */
async function resolveConcurrency(
  requested: string | undefined
): Promise<number> {
  if (requested !== undefined) {
    const parsed = Number(requested);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`--concurrency must be a positive integer: ${requested}`);
    }

    return parsed;
  }

  const result = await runCommand({
    args: ["info", "--format", "{{.NCPU}}"],
    command: "docker",
  });

  const cpus = Number(result.stdout.trim());

  return Number.isInteger(cpus) && cpus > 0 ? cpus : 1;
}

/** Run one adapter service over the case files and narrow its output. */
async function runAdapter({
  caseFiles,
  service,
}: {
  caseFiles: readonly LoadedCaseFile[];
  service: ComposeService;
}): Promise<ServiceColumns> {
  const startedAt = performance.now();

  const result = await runService({
    args: caseFiles.map(({ containerPath }) => containerPath),
    service,
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `${service.name} exited ${result.exitCode}:\n${result.stderr.trim()}`
    );
  }

  const columns = parseAdapterOutput(JSON.parse(result.stdout));
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);

  log(`${service.name}: ${columns.length} columns in ${seconds}s`);

  return { columns, image: service.image, service: service.name };
}

/** Run a command from the repo root, collecting its output. */
function runCommand({
  args,
  command,
}: {
  args: readonly string[];
  command: string;
}): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: COMMAND_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);

    child.on("close", (code, signal) => {
      const killedNote =
        signal === null ? "" : `\nkilled by ${signal} (timeout or interrupt)`;

      resolve({ exitCode: code ?? 1, stderr: stderr + killedNote, stdout });
    });
  });
}

/**
 * Run tasks with at most `concurrency` in flight.
 *
 * - After the first failure no new task starts; those already running finish,
 *   and the failure is rethrown.
 *
 * @returns each task's result, in task order whatever order they finish in.
 */
async function runPool<T>({
  concurrency,
  tasks,
}: {
  concurrency: number;
  tasks: readonly (() => Promise<T>)[];
}): Promise<T[]> {
  const results: T[] = [];
  let hasFailed = false;
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (!hasFailed && nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;

      const task = tasks[index];

      if (task) {
        try {
          results[index] = await task();
        } catch (error) {
          hasFailed = true;
          throw error;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  );

  return results;
}

/**
 * Run tasks one after another.
 *
 * @returns each task's result, in task order.
 */
async function runSequentially<T>(
  tasks: readonly (() => Promise<T>)[]
): Promise<T[]> {
  const results: T[] = [];

  for (const task of tasks) {
    results.push(await task());
  }

  return results;
}

/**
 * Run one Compose service once, in a container named for this process.
 *
 * - The name lets a failed or timed-out run remove its container: killing the
 *   `docker` CLI doesn't stop the container it started.
 *
 * @returns what the service printed and how it exited.
 */
async function runService({
  args,
  service,
}: {
  args: readonly string[];
  service: ComposeService;
}): Promise<CommandResult> {
  const containerName = `safe-fns-research-${service.name}-${process.pid}`;

  const result = await compose([
    ...profileArgs(service.profiles),
    "run",
    "--rm",
    "--no-deps",
    "-T",
    "--name",
    containerName,
    service.name,
    ...args,
  ]);

  if (result.exitCode !== 0) {
    await runCommand({
      args: ["rm", "--force", containerName],
      command: "docker",
    });
  }

  return result;
}

/** Name the image a service runs: its pinned `image`, or a build's base. */
function toImage(service: Record<string, unknown>): string {
  if (isRecord(service.build)) {
    return imageFromDockerfile(service.build);
  }

  return typeof service.image === "string" ? service.image : "unknown";
}

/** Keep only the string values of an object. */
function toStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === "string" ? [[key, item]] : []
    )
  );
}

/**
 * Write each result's JSON and Markdown under the stem of the case file it
 * came from.
 *
 * - With `servicesRun`, a narrowed run keeps every other service's committed
 *   columns instead of dropping them.
 */
function writeResults({
  caseFiles,
  results,
  servicesRun,
}: {
  caseFiles: readonly LoadedCaseFile[];
  results: readonly FunctionResult[];
  servicesRun: ReadonlySet<string> | undefined;
}): void {
  mkdirSync(RESULTS_DIR, { recursive: true });

  const stemsByFunction = new Map(
    caseFiles.map(({ function: name, stem }) => [name, stem])
  );

  // Merge every result before writing any, so a merge that throws leaves the
  // committed results untouched rather than half-updated.
  const mergedResults = results.map((result) => {
    const stem = stemsByFunction.get(result.function) ?? result.function;

    const merged = servicesRun
      ? mergeWithPrevious({
          next: result,
          previous: readPreviousResult(stem),
          servicesRun,
        })
      : result;

    return { merged, stem };
  });

  for (const { merged, stem } of mergedResults) {
    writeFileSync(
      path.join(RESULTS_DIR, `${stem}.json`),
      stringifyStable(merged)
    );

    writeFileSync(
      path.join(RESULTS_DIR, `${stem}.md`),
      renderResultMarkdown(merged)
    );

    log(`wrote research/results/${stem}.{json,md}`);
  }
}

/** Run the harness, or its formatters, per the command-line flags. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean" },
      concurrency: { type: "string" },
      format: { type: "boolean" },
      function: { multiple: true, type: "string" },
      profile: { multiple: true, type: "string" },
    },
  });

  const services = await loadServices();

  if (values.format === true) {
    const isClean = await formatAdapters({
      services,
      shouldCheck: values.check === true,
    });

    process.exitCode = isClean ? 0 : 1;

    return;
  }

  const profiles = values.profile ?? [];

  const adapters = services.filter(
    (service) =>
      service.labels[ROLE_LABEL] === ROLES.adapter &&
      (profiles.length === 0 ||
        service.profiles.some((profile) => profiles.includes(profile)))
  );

  if (adapters.length === 0) {
    throw new Error(`no adapters match --profile ${profiles.join(", ")}`);
  }

  const activeProfiles = [
    ...new Set(adapters.flatMap((service) => service.profiles)),
  ];

  const caseFiles = loadCaseFiles(values.function ?? []);
  const concurrency = await resolveConcurrency(values.concurrency);

  log(
    `${adapters.length} adapters × ${caseFiles.length} case files, ${concurrency} at a time`
  );

  // Build and pull once up front, so parallel runs never race to fetch the
  // same image.
  for (const step of [["build"], ["pull", "--ignore-buildable", "--quiet"]]) {
    const result = await compose([...profileArgs(activeProfiles), ...step]);

    if (result.exitCode !== 0) {
      throw new Error(
        `docker compose ${step[0] ?? ""} failed:\n${result.stderr}`
      );
    }
  }

  const serviceColumns = await runPool({
    concurrency,
    tasks: adapters.map((service) => () => runAdapter({ caseFiles, service })),
  });

  const results = buildResults({ caseFiles, serviceColumns });

  const codecMismatches = results
    .filter((result) => result.function === CODEC_FUNCTION)
    .flatMap((result) => findCodecMismatches(result));

  if (codecMismatches.length > 0) {
    logError(`the codec round-trip failed:\n${codecMismatches.join("\n")}`);
    process.exitCode = 1;

    return;
  }

  writeResults({
    caseFiles,
    results: results.filter((result) => result.function !== CODEC_FUNCTION),
    servicesRun:
      profiles.length > 0
        ? new Set(adapters.map((service) => service.name))
        : undefined,
  });
}

try {
  await main();
} catch (error) {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
