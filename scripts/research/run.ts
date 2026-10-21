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
 *
 * - `--check-inputs` fails when a committed column records a different image,
 *   or a different fingerprint of its service's Dockerfile and lockfiles,
 *   than its service has now, without building or running anything.
 */
import type { ChildProcess } from "node:child_process";

import { Duration } from "luxon";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { ServiceInputs } from "./inputs.ts";
import type { CaseFile, FunctionResult, ServiceColumns } from "./results.ts";

import { isRecord } from "./codec.ts";
import {
  findContainersToRemove,
  findNetworksInUse,
  findUnexpectedRemovalErrors,
  profileArgs,
  toDatabaseArgs,
} from "./compose.ts";
import {
  describeStaleImage,
  findStaleImages,
  ROLE_LABEL,
  ROLES,
  toReportedImage,
  toStaleKey,
} from "./images.ts";
import {
  describeStaleInputs,
  findStaleInputs,
  toServiceInputs,
} from "./inputs.ts";
import { parseJson, readJsonFile } from "./json.ts";
import {
  describeError,
  describeStillRunning,
  printPrefixed,
} from "./logging.ts";
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

/** The case files to run one adapter service over. */
type AdapterRunInput = {
  /**
   * The case files, each with its path inside the container.
   *
   * @example `[{ containerPath: "/work/research/cases/codec.json", … }]`
   */
  caseFiles: readonly LoadedCaseFile[];

  /**
   * The adapter service to run.
   *
   * @example `{ image: "python:3.14.7…", name: "python", … }`
   */
  service: ComposeService;
};

/** A command to run from the repo root. */
type CommandInput = {
  /**
   * The command's arguments.
   *
   * @example `["info", "--format", "{{.NCPU}}"]`
   */
  args: readonly string[];

  /**
   * The executable, found on `PATH`.
   *
   * @example "docker"
   */
  command: string;

  /**
   * Called with each chunk the command writes to stderr, as it arrives.
   *
   * @example `(chunk) => { stderr += chunk; }`
   */
  onStderr?: ((chunk: string) => void) | undefined;

  /**
   * Kills the command when aborted; the result still waits for it to exit.
   *
   * @example `TEARDOWN.signal`
   */
  signal?: AbortSignal;

  /**
   * How long the command may run before it's killed; defaults to
   * `COMMAND_TIMEOUT_MS`.
   *
   * @example `ADAPTER_TIMEOUT_MS`
   */
  timeoutMs?: number | undefined;
};

/** What a finished child process printed, and how it exited. */
type CommandResult = {
  /**
   * The exit code, or 1 when the process died on a signal.
   *
   * @example 0
   */
  exitCode: number;

  /**
   * Everything written to stderr, plus a note when a signal killed it.
   *
   * @example "Container safe-fns-research-node-run Created"
   */
  stderr: string;

  /**
   * Everything written to stdout.
   *
   * @example `{"columns":[]}`
   */
  stdout: string;
};

/** One service from `research/compose.yaml`, as the runner needs it. */
type ComposeService = {
  /**
   * The pinned image whose answers it reports: its own, or a built image's
   * pinned base, or for a database adapter its database's.
   *
   * @example `"python:3.14.7-slim-bookworm@sha256:…"`
   */
  image: string;

  /**
   * Fingerprints the files its results depend on.
   *
   * - Called only by a run or check that needs it, so a bad input on one
   *   service can't fail a command that never touches it.
   *
   * @example `() => ({ files: ["docker/python/Dockerfile"], fingerprint: "sha256:…" })`
   */
  inputs: () => ServiceInputs;

  /**
   * The labels it carries, such as its role and formatter arguments.
   *
   * @example `{ "dev.safe-fns.research.role": "adapter" }`
   */
  labels: Record<string, string>;

  /**
   * The Compose service name.
   *
   * @example "python"
   */
  name: string;

  /**
   * The profiles that enable it.
   *
   * @example `["python"]`
   */
  profiles: string[];
};

/** The databases to remove, and whether adapters may still be running. */
type DatabaseRemovalInput = {
  /**
   * The database services to stop and remove.
   *
   * @example `[{ name: "postgres", profiles: ["db"], … }]`
   */
  databases: readonly ComposeService[];

  /**
   * Whether a signal cut the run short, so adapters may still be running.
   *
   * - Otherwise the task has settled, and `runPool` waits for every adapter it
   *   started, so none is left.
   *
   * @example true
   */
  isInterrupted: boolean;
};

/** The formatter services, and whether to only check. */
type FormatInput = {
  /**
   * Every service in the Compose file; the formatters are picked out by role.
   *
   * @example `[{ name: "ruff", … }]`
   */
  services: readonly ComposeService[];

  /**
   * Whether to report drift instead of rewriting files.
   *
   * @example true
   */
  shouldCheck: boolean;
};

/** A case file, with the path an adapter reads it from inside its container. */
type LoadedCaseFile = {
  /**
   * The path inside the container, under the `/work` mount.
   *
   * @example "/work/research/cases/safe-parse-boolean.json"
   */
  containerPath: string;

  /**
   * The file's name without `.json`, which names its results too.
   *
   * @example "safe-parse-boolean"
   */
  stem: string;
} & CaseFile;

/** Tasks to run with a cap on how many are in flight. */
type PoolInput<T> = {
  /**
   * The most tasks to run at once.
   *
   * @example 8
   */
  concurrency: number;

  /**
   * The tasks, each started only when a slot is free.
   *
   * @example `[() => runAdapter({ caseFiles, service })]`
   */
  tasks: readonly (() => Promise<T>)[];
};

/** One run of one Compose service. */
type ServiceRunInput = {
  /**
   * The arguments appended to the service's entrypoint.
   *
   * @example `["/work/research/cases/codec.json"]`
   */
  args: readonly string[];

  /**
   * Called with each chunk the service writes to stderr, as it arrives.
   *
   * @example `(chunk) => { stderr += chunk; }`
   */
  onStderr?: CommandInput["onStderr"];

  /**
   * The service to run.
   *
   * @example `{ name: "ruff", profiles: ["format"], … }`
   */
  service: ComposeService;

  /**
   * How long the run may take before it's killed.
   *
   * @example `ADAPTER_TIMEOUT_MS`
   */
  timeoutMs?: CommandInput["timeoutMs"];
};

/** A task to run while the databases it queries are up. */
type WithDatabasesInput<T> = {
  /**
   * The database services to start first and remove afterward.
   *
   * @example `[{ name: "postgres", profiles: ["db"], … }]`
   */
  databases: readonly ComposeService[];

  /**
   * The work that needs them.
   *
   * @example `() => runPool({ concurrency, tasks })`
   */
  task: () => Promise<T>;
};

/** The results to write, and what a narrowed run should keep. */
type WriteResultsInput = {
  /**
   * The case files the results came from, which name their files.
   *
   * @example `[{ stem: "safe-parse-boolean", … }]`
   */
  caseFiles: readonly LoadedCaseFile[];

  /**
   * One result per function, codec excluded.
   *
   * @example `[{ cases: [["yes"]], columns: [], function: "safeParseBoolean" }]`
   */
  results: readonly FunctionResult[];

  /**
   * The services a narrowed run ran, or `undefined` for a full run.
   *
   * @example `new Set(["python"])`
   */
  servicesRun: ReadonlySet<string> | undefined;
};

/**
 * How long one adapter run may take before it's killed.
 *
 * - Images are built and pulled before any adapter starts, and the slowest
 *   adapter finishes in seconds, so a run this long has crashed without
 *   exiting (as .NET can while it writes a crash dump) or is stuck.
 */
const ADAPTER_TIMEOUT_MS = Duration.fromObject({ minutes: 5 }).toMillis();

/**
 * The `docker compose run` commands `runService` has in flight, so an
 * interrupted teardown can wait until none can still create a container.
 */
const ADAPTER_RUNS = new Set<Promise<CommandResult>>();

/** Where the case files live on the host. */
const CASES_DIR = path.resolve(import.meta.dirname, "../../research/cases");

/** The label holding a formatter's arguments in `--check` mode. */
const CHECK_ARGS_LABEL = "dev.safe-fns.research.check-args";

/**
 * How long any one command may run before it's killed.
 *
 * - Generous enough for a cold image pull or build; a stuck adapter fails the
 *   run instead of hanging it, locally and in CI.
 */
const COMMAND_TIMEOUT_MS = Duration.fromObject({ minutes: 15 }).toMillis();

/** The Compose file every `docker compose` call reads. */
const COMPOSE_FILE = path.resolve(
  import.meta.dirname,
  "../../research/compose.yaml"
);

/** The label holding a formatter's arguments when it rewrites files. */
const FORMAT_ARGS_LABEL = "dev.safe-fns.research.format-args";

/** How often a still-running adapter is reported. */
const HEARTBEAT_MS = Duration.fromObject({ seconds: 30 }).toMillis();

/** Starts every line the runner prints, per the `scripts/` conventions. */
const LOG_PREFIX = "[research]";

/** The repo root, where every command runs. */
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** The harness's root, which input paths are relative to. */
const RESEARCH_DIR = path.resolve(import.meta.dirname, "../../research");

/** Where results are written. */
const RESULTS_DIR = path.join(RESEARCH_DIR, "results");

/**
 * Identifies this run's adapter containers, by name and by `RUNNER_LABEL`.
 *
 * - Random rather than the pid, which another runner sharing the Docker engine
 *   from a different container or host could also have.
 */
const RUN_ID = randomUUID();

/**
 * The label marking each container `runService` starts with `RUN_ID`.
 *
 * - Teardown asks Docker for it rather than tracking containers itself, so it
 *   also finds one this run left behind when it killed the CLI.
 *
 * - Any other run's containers carry another id, so they're never touched.
 */
const RUNNER_LABEL = "dev.safe-fns.research.runner";

/** How much of an adapter's latest stderr the heartbeat keeps to quote. */
const STDERR_TAIL_LENGTH = 4096;

/**
 * Aborted when a signal starts database teardown: `runService` starts no new
 * adapter, and every `docker compose run` in flight is killed, so none can
 * recreate or hold a database network the teardown is removing.
 */
const TEARDOWN = new AbortController();

/**
 * Compare every committed column's image and inputs with its service's now.
 *
 * - Reads only Compose's config, the Dockerfiles, and the declared inputs, so
 *   it builds and pulls nothing, which keeps it cheap enough for every PR.
 *
 * - A service whose image moved is reported for its image alone, since the
 *   Dockerfile that pins it is one of its inputs too.
 *
 * @returns whether every committed result still matches its pins.
 */
function checkInputs(services: readonly ComposeService[]): boolean {
  const results = readdirSync(RESULTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) =>
      parseFunctionResult(readJsonFile(path.join(RESULTS_DIR, file)))
    );

  const staleImages = findStaleImages({
    reportedImages: new Map(services.map(({ image, name }) => [name, image])),
    results,
  });

  const staleImageKeys = new Set(staleImages.map((stale) => toStaleKey(stale)));

  const staleInputs = findStaleInputs({
    results,
    serviceInputs: new Map(
      services.map(({ inputs, name }) => [name, inputs()])
    ),
  }).filter((stale) => !staleImageKeys.has(toStaleKey(stale)));

  if (staleImages.length === 0 && staleInputs.length === 0) {
    log(`every column in ${results.length} results matches its pins`);

    return true;
  }

  const staleServices = new Set(
    [...staleImages, ...staleInputs].map(({ service }) => service)
  );

  // A narrowed run keeps the columns of services it didn't run, so only a full
  // run drops a removed service's.
  const hasRemovedService = staleImages.some(
    ({ reported }) => reported === undefined
  );

  const profiles = hasRemovedService
    ? []
    : [
        ...new Set(
          services
            .filter(({ name }) => staleServices.has(name))
            .flatMap((service) => service.profiles)
        ),
      ].sort();

  logError(
    [
      "results no longer match their pins:",
      ...staleImages.map((staleImage) => `  ${describeStaleImage(staleImage)}`),
      ...staleInputs.map((stale) => `  ${describeStaleInputs(stale)}`),
      `regenerate them: ${["pnpm research", ...profileArgs(profiles)].join(" ")}`,
    ].join("\n")
  );

  return false;
}

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
}: FormatInput): Promise<boolean> {
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
 * List this run's adapter containers that still need removing, logging a
 * failure to ask.
 *
 * @returns their ids; none when Docker couldn't be asked.
 */
async function listAdapterContainers(): Promise<string[]> {
  const listed = await runCommand({
    args: [
      "ps",
      "--all",
      "--filter",
      `label=${RUNNER_LABEL}=${RUN_ID}`,
      "--format",
      "{{.ID}} {{.State}}",
    ],
    command: "docker",
  });

  if (listed.exitCode !== 0) {
    logError(`couldn't list the adapter containers:\n${listed.stderr}`);

    return [];
  }

  return findContainersToRemove(listed.stdout);
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
      ...parseCaseFile(readJsonFile(path.join(CASES_DIR, file))),
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

  const config = parseJson({
    source: "docker compose config",
    text: result.stdout,
  });
  const services = isRecord(config) ? config.services : undefined;

  if (!isRecord(services)) {
    throw new Error("docker compose config printed no services");
  }

  // Services share Dockerfiles and lockfiles, so each file is read once.
  const filesByPath = new Map<string, Buffer>();

  const readCached = (file: string): Buffer => {
    const cached = filesByPath.get(file);

    if (cached !== undefined) {
      return cached;
    }

    const content = readFileSync(file);
    filesByPath.set(file, content);

    return content;
  };

  return Object.entries(services).flatMap(([name, service]) => {
    if (!isRecord(service)) {
      return [];
    }

    return [
      {
        image: toReportedImage({
          readDockerfile: (file) => readCached(file).toString("utf8"),
          service,
          services,
        }),
        inputs: () =>
          toServiceInputs({
            name,
            readInput: readCached,
            researchDir: RESEARCH_DIR,
            service,
          }),
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
  printPrefixed({ message, prefix: LOG_PREFIX, print: console.log });
}

/** Print an error, prefixing every line. */
function logError(message: string): void {
  printPrefixed({ message, prefix: LOG_PREFIX, print: console.error });
}

/** Read a function's committed result, if there is one. */
function readPreviousResult(stem: string): FunctionResult | undefined {
  const file = path.join(RESULTS_DIR, `${stem}.json`);

  return existsSync(file) ? parseFunctionResult(readJsonFile(file)) : undefined;
}

/**
 * Force-remove every container this run started, logging any failure.
 *
 * - `docker rm` also fails on a container `--rm` is already removing, or has
 *   just removed; that's no failure, and Docker's listing can't tell it apart
 *   reliably, so its error messages are what decide.
 */
async function removeAdapterContainers(): Promise<void> {
  const ids = await listAdapterContainers();

  if (ids.length === 0) {
    return;
  }

  const removed = await runCommand({
    args: ["rm", "--force", ...ids],
    command: "docker",
  });

  const errors = findUnexpectedRemovalErrors(removed.stderr);

  if (errors.length > 0) {
    logError(`couldn't remove the adapter containers:\n${errors.join("\n")}`);
  }
}

/**
 * Stop and remove database services by name, logging any failure.
 *
 * - After an interrupt, no new adapter starts, every one in flight is killed,
 *   and any container left goes first, since it holds its database's network.
 *   If `down` then fails or keeps a network in use, the sweep and `down` run
 *   once more, for a container the engine created just after its CLI died.
 *
 * - `down` with service names removes only those containers, their volumes,
 *   and their networks; leftover networks eventually exhaust Docker's address
 *   pools, so one it keeps in use is logged.
 *
 * - If `down` fails, as on a Compose whose `down` takes no service names,
 *   `rm` still removes the containers, though not their networks.
 */
async function removeDatabases({
  databases,
  isInterrupted,
}: DatabaseRemovalInput): Promise<void> {
  const downArgs = toDatabaseArgs({ command: "down", databases });
  const names = databases.map(({ name }) => name).join(", ");

  if (isInterrupted) {
    TEARDOWN.abort();
    await Promise.allSettled(ADAPTER_RUNS);
    await removeAdapterContainers();
  }

  const firstDown = await compose(downArgs);

  const shouldRetry =
    isInterrupted &&
    (firstDown.exitCode !== 0 ||
      findNetworksInUse(firstDown.stderr).length > 0);

  if (shouldRetry) {
    await removeAdapterContainers();
  }

  const removed = shouldRetry ? await compose(downArgs) : firstDown;

  if (removed.exitCode === 0) {
    const networksInUse = findNetworksInUse(removed.stderr);

    if (networksInUse.length > 0) {
      logError(`left in use, not removed: ${networksInUse.join(", ")}`);
    }

    return;
  }

  logError(
    `docker compose down failed for ${names}, so removing them with rm, which leaves their networks:\n${removed.stderr}`
  );

  const fallback = await compose(toDatabaseArgs({ command: "rm", databases }));

  if (fallback.exitCode !== 0) {
    logError(`couldn't remove ${names}:\n${fallback.stderr}`);
  }
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
}: AdapterRunInput): Promise<ServiceColumns> {
  const startedAt = performance.now();
  let stderrTail = "";

  // A crashed adapter can sit without exiting, so report each one still out.
  const heartbeat = setInterval(() => {
    log(
      describeStillRunning({
        elapsed: Duration.fromMillis(performance.now() - startedAt),
        stderr: stderrTail,
        subject: service.name,
      })
    );
  }, HEARTBEAT_MS);

  const result = await runService({
    args: caseFiles.map(({ containerPath }) => containerPath),
    // Only the end matters to the heartbeat, so the copy stays bounded.
    onStderr: (chunk) => {
      stderrTail = `${stderrTail}${chunk}`.slice(-STDERR_TAIL_LENGTH);
    },
    service,
    timeoutMs: ADAPTER_TIMEOUT_MS,
  }).finally(() => {
    clearInterval(heartbeat);
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `${service.name} exited ${result.exitCode}:\n${result.stderr.trim()}`
    );
  }

  const columns = parseAdapterOutput(
    parseJson({ source: `the ${service.name} adapter`, text: result.stdout })
  );
  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);

  log(`${service.name}: ${columns.length} columns in ${seconds}s`);

  return {
    columns,
    image: service.image,
    inputs: service.inputs().fingerprint,
    service: service.name,
  };
}

/** Run a command from the repo root, collecting its output. */
function runCommand({
  args,
  command,
  onStderr,
  signal,
  timeoutMs = COMMAND_TIMEOUT_MS,
}: CommandInput): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(command, args, {
      cwd: REPO_ROOT,
      // SIGTERM can leave `docker compose run` waiting on a container that
      // ignores it; SIGKILL ends the CLI, so `runService` can remove the
      // container.
      killSignal: "SIGKILL",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    /*
     * Killed by hand rather than through `spawn`'s own `signal` option, which
     * rejects with an `AbortError` at once; this settles only once the
     * command has exited, so a caller awaiting it knows it can do no more.
     */
    const kill = (): void => {
      child.kill();
    };

    signal?.addEventListener("abort", kill, { once: true });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    // Decoding across chunks keeps a character split between two reads whole.
    child.stderr?.setEncoding("utf8");

    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
      onStderr?.(chunk);
    });

    child.on("error", reject);

    child.on("close", (code, exitSignal) => {
      signal?.removeEventListener("abort", kill);

      const killedNote =
        exitSignal === null
          ? ""
          : `\nkilled by ${exitSignal} (interrupted, or still running after ${Duration.fromMillis(timeoutMs).toFormat("m'm'")})`;

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
async function runPool<T>({ concurrency, tasks }: PoolInput<T>): Promise<T[]> {
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

  const outcomes = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, tasks.length) }, worker)
  );

  const failure = outcomes.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected"
  );

  if (failure !== undefined) {
    throw failure.reason;
  }

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
 * Run one Compose service once, in a container named and labeled for this
 * run.
 *
 * - The name lets a failed or timed-out run remove its container: killing the
 *   `docker` CLI doesn't stop the container it started.
 *
 * - The label lets database teardown find every such container, and its
 *   abort signal kills the CLI, so none can start after teardown begins.
 *
 * @returns what the service printed and how it exited.
 */
async function runService({
  args,
  onStderr,
  service,
  timeoutMs,
}: ServiceRunInput): Promise<CommandResult> {
  if (TEARDOWN.signal.aborted) {
    return {
      exitCode: 1,
      stderr: "not started: the databases are being removed",
      stdout: "",
    };
  }

  const containerName = `safe-fns-research-${service.name}-${RUN_ID}`;

  // Not `compose()`, which takes no abort signal.
  const run = runCommand({
    args: [
      "compose",
      "--file",
      COMPOSE_FILE,
      ...profileArgs(service.profiles),
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "--label",
      `${RUNNER_LABEL}=${RUN_ID}`,
      "--name",
      containerName,
      service.name,
      ...args,
    ],
    command: "docker",
    onStderr,
    signal: TEARDOWN.signal,
    timeoutMs,
  });

  ADAPTER_RUNS.add(run);

  const result = await run.finally(() => {
    ADAPTER_RUNS.delete(run);
  });

  if (result.exitCode !== 0) {
    await runCommand({
      args: ["rm", "--force", containerName],
      command: "docker",
    });
  }

  return result;
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
 * Run a task while the databases it queries are up.
 *
 * - Adapters run with `--no-deps`, so their `depends_on` never starts a
 *   database; this starts each once, waiting on its healthcheck.
 *
 * - The databases are removed with their networks whether the task succeeds
 *   or not, by name, so nothing else in the Compose project is touched.
 *
 * - An interrupt (Ctrl+C) or a `SIGTERM` skips `finally`, so either one
 *   removes them first and then re-raises, rather than leaving them running.
 *
 * @returns what the task returns.
 */
async function withDatabases<T>({
  databases,
  task,
}: WithDatabasesInput<T>): Promise<T> {
  if (databases.length === 0) {
    return task();
  }

  const names = databases.map(({ name }) => name);
  let removal: Promise<void> | undefined;

  // Once only: a signal and the `finally` it unwinds can both ask.
  const removeOnce = (isInterrupted: boolean): Promise<void> => {
    removal ??= removeDatabases({ databases, isInterrupted });

    return removal;
  };

  const onSignal = (signal: NodeJS.Signals): void => {
    void removeOnce(true).finally(() => {
      process.kill(process.pid, signal);
    });
  };

  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    log(`starting ${names.join(", ")}`);

    const started = await compose(toDatabaseArgs({ command: "up", databases }));

    if (started.exitCode !== 0) {
      throw new Error(`docker compose up failed:\n${started.stderr}`);
    }

    return await task();
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await removeOnce(false);
  }
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
}: WriteResultsInput): void {
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
    const json = stringifyStable(merged);

    writeFileSync(path.join(RESULTS_DIR, `${stem}.json`), json);

    // Render from the sorted JSON, not the in-memory result, so an object an
    // adapter returned with unsorted keys reads the same whether this run
    // produced its column or kept it from the committed results.
    writeFileSync(
      path.join(RESULTS_DIR, `${stem}.md`),
      renderResultMarkdown(
        parseFunctionResult(parseJson({ source: `${stem}.json`, text: json }))
      )
    );

    log(`wrote research/results/${stem}.{json,md}`);
  }
}

/** Run the harness, or its formatters, per the command-line flags. */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      check: { type: "boolean" },
      "check-inputs": { type: "boolean" },
      concurrency: { type: "string" },
      format: { type: "boolean" },
      function: { multiple: true, type: "string" },
      profile: { multiple: true, type: "string" },
    },
  });

  const services = await loadServices();

  if (values["check-inputs"] === true) {
    const otherFlags = Object.keys(values).filter(
      (flag) => flag !== "check-inputs"
    );

    if (otherFlags.length > 0) {
      throw new Error(
        `--check-inputs takes no other flags, got --${otherFlags.join(", --")}`
      );
    }

    process.exitCode = checkInputs(services) ? 0 : 1;

    return;
  }

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

  const databases = services.filter(
    (service) =>
      service.labels[ROLE_LABEL] === ROLES.database &&
      service.profiles.some((profile) => activeProfiles.includes(profile))
  );

  const serviceColumns = await withDatabases({
    databases,
    task: () =>
      runPool({
        concurrency,
        tasks: adapters.map(
          (service) => () => runAdapter({ caseFiles, service })
        ),
      }),
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
  logError(describeError(error));
  process.exitCode = 1;
}
