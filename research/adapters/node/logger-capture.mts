import { format } from "node:util";

/** The `console` methods the recording console has. */
export const CONSOLE_METHODS = [
  "debug",
  "error",
  "info",
  "log",
  "trace",
  "warn",
] as const;

/** One of the `console` methods `createLogger` exposes. */
export type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

/** `CONSOLE_METHODS` as a set, for narrowing a case's method. */
const CONSOLE_METHOD_SET: ReadonlySet<unknown> = new Set(CONSOLE_METHODS);

/** One `createLogger` case, decoded from its arguments. */
type LoggerCase = {
  /**
   * The arguments passed to the logging method.
   *
   * @example `["hello", { a: 1 }]`
   */
  logArgs: readonly unknown[];

  /**
   * The logging method called.
   *
   * @example "info"
   */
  method: ConsoleMethod;

  /**
   * How `console` is changed for the case, if at all.
   *
   * @example "without console.debug"
   */
  scenario: string | undefined;

  /**
   * The scope the logger is created with.
   *
   * @example "app"
   */
  scope: unknown;
};

/** What a probe does with one case: create a logger, then call it. */
type LoggerProbe = {
  /**
   * The case's arguments, as the case file holds them.
   *
   * @example `["app", "info", ["hello"]]`
   */
  args: readonly unknown[];

  /**
   * Creates the tool's logger for a scope and returns how to call one method.
   *
   * @example `(name) => (method, logArgs) => log.getLogger(name)[method](...logArgs)`
   */
  create: (
    scope: unknown
  ) => (method: ConsoleMethod, logArgs: readonly unknown[]) => void;
};

/** The stream `process.stdout` and `process.stderr` both are. */
type Stream = typeof process.stdout;

/** One text written by a tool, stored for `captureLogging` to return. */
const SINK: string[] = [];

/**
 * The recording `console` every case installs.
 *
 * - It is one object, so a logger a tool cached in an earlier case (loglevel
 *   keeps one per name) still writes into the current case's `SINK`.
 */
const RECORDER: Record<string, unknown> = Object.fromEntries(
  CONSOLE_METHODS.map((method) => [method, recorderMethod(method)])
);

/**
 * Run a `createLogger` probe with a recording `console` and captured
 * `process.stdout` and `process.stderr`.
 *
 * - Each text is `<channel>: <text>`, with `util.format` applied to what a
 *   `console` method received, as Node's own `console` does.
 *
 * @returns every text the tool wrote, in order.
 */
export function captureLogging({ args, create }: LoggerProbe): string[] {
  const { logArgs, method, scenario, scope } = toLoggerCase(args);
  const consoleDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "console"
  );
  const debugNamespaces = process.env.DEBUG;
  const stderrWrite = Reflect.get(process.stderr, "write");
  const stdoutWrite = Reflect.get(process.stdout, "write");

  SINK.length = 0;
  installConsole(scenario);
  process.stderr.write = streamRecorder("stderr");
  process.stdout.write = streamRecorder("stdout");

  try {
    const write = create(scope);

    if (scenario === "console.info replaced after creation") {
      RECORDER.info = (...values: unknown[]) => {
        SINK.push(`console.info (replaced): ${format(...values)}`);
      };
    }

    write(method, logArgs);

    return [...SINK];
  } finally {
    restoreDebugNamespaces(debugNamespaces);
    process.stderr.write = stderrWrite;
    process.stdout.write = stdoutWrite;
    resetRecorder();

    if (consoleDescriptor) {
      Object.defineProperty(globalThis, "console", consoleDescriptor);
    }
  }
}

/**
 * Whether a case's arguments are a `createLogger` case without options.
 *
 * - A fifth argument is `createLogger`'s options, which only the planned
 *   column takes, so every tool reports such a case `n/a`.
 */
export function isLoggerCase(args: readonly unknown[]): boolean {
  const [, method, logArgs, scenario] = args;

  return (
    (args.length === 3 || args.length === 4) &&
    CONSOLE_METHOD_SET.has(method) &&
    Array.isArray(logArgs) &&
    (scenario === undefined || typeof scenario === "string")
  );
}

/** Put the recording console in place, changed as the scenario says. */
function installConsole(scenario: LoggerCase["scenario"]): void {
  resetRecorder();

  if (scenario === "without console.debug") {
    delete RECORDER.debug;
  }

  if (scenario === "console.info is a throwing getter") {
    Object.defineProperty(RECORDER, "info", {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error("console.info getter");
      },
    });
  }

  Object.defineProperty(globalThis, "console", {
    configurable: true,
    value: scenario === "without console" ? undefined : RECORDER,
    writable: true,
  });
}

/** Build the recording console's method for one `console` method name. */
function recorderMethod(method: ConsoleMethod): (...values: unknown[]) => void {
  return (...values) => {
    SINK.push(`console.${method}: ${format(...values)}`);
  };
}

/** Give the recording console back its six plain methods. */
function resetRecorder(): void {
  for (const method of CONSOLE_METHODS) {
    Object.defineProperty(RECORDER, method, {
      configurable: true,
      enumerable: true,
      value: recorderMethod(method),
      writable: true,
    });
  }
}

/**
 * Put `process.env.DEBUG` back as it was, since debug's `enable` and `disable`
 * save to it, and it is shared by the whole adapter process.
 */
function restoreDebugNamespaces(namespaces: string | undefined): void {
  if (namespaces === undefined) {
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/** Build a stream `write` that records each chunk without its newline. */
function streamRecorder(channel: "stderr" | "stdout"): Stream["write"] {
  return (chunk: unknown) => {
    SINK.push(`${channel}: ${String(chunk).replace(/\n$/u, "")}`);

    return true;
  };
}

/** Read a case's arguments, already checked by `isLoggerCase`. */
function toLoggerCase(args: readonly unknown[]): LoggerCase {
  const [scope, method, logArgs, scenario] = args;

  return {
    logArgs: logArgs as readonly unknown[],
    method: method as ConsoleMethod,
    scenario: scenario as string | undefined,
    scope,
  };
}
