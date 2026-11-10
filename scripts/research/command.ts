/*
 * Runs a command from the repo root and collects what it prints, for the
 * research scripts.
 */
import type { ChildProcess } from "node:child_process";

import { Duration } from "luxon";
import { spawn } from "node:child_process";
import path from "node:path";

/** A command to run from the repo root. */
export type CommandInput = {
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
export type CommandResult = {
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

/**
 * How long any one command may run before it's killed.
 *
 * - Generous enough for a cold image pull or build; a stuck adapter fails the
 *   run instead of hanging it, locally and in CI.
 */
const COMMAND_TIMEOUT_MS = Duration.fromObject({ minutes: 15 }).toMillis();

/** The repo root, where every command runs. */
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

/** Run a command from the repo root, collecting its output. */
export function runCommand({
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
