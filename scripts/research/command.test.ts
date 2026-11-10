import { describe, expect, test } from "vitest";

import { runCommand } from "./command.ts";

/** A Node script that runs until it's killed. */
const WAIT_FOREVER_SCRIPT = "setInterval(() => {}, 1000);";

/**
 * Build a Node script that writes U+2212 MINUS SIGN to `stream` in two writes.
 *
 * - The first write is the character's first two UTF-8 bytes and the second
 *   its last, with a pause between, so the reader gets separate chunks.
 *
 * - The pause makes a split read likely, not certain: under heavy load both
 *   writes can arrive as one chunk, and the test passes without exercising
 *   the split. It can miss a regression on such a run, never fail falsely.
 *
 * @returns the script, for `node -e`.
 */
function splitMinusScript(stream: "stderr" | "stdout"): string {
  return [
    `process.${stream}.write(Buffer.from([0xe2, 0x88]));`,
    `setTimeout(() => process.${stream}.write(Buffer.from([0x92])), 100);`,
  ].join("\n");
}

describe("runCommand", () => {
  test("keeps a character split across stdout chunks whole", async () => {
    // When - a command writes a multi-byte character split across two writes
    const result = await runCommand({
      args: ["-e", splitMinusScript("stdout")],
      command: process.execPath,
    });

    // Then - stdout holds the character, not replacement characters
    expect(result).toStrictEqual({ exitCode: 0, stderr: "", stdout: "−" });
  });

  test("keeps a character split across stderr chunks whole", async () => {
    // Given - a listener collecting stderr as it arrives
    const chunks: string[] = [];

    // When - a command writes a multi-byte character to stderr in two parts
    const result = await runCommand({
      args: ["-e", splitMinusScript("stderr")],
      command: process.execPath,
      onStderr: (chunk) => {
        chunks.push(chunk);
      },
    });

    // Then - both the result and the listener see the character whole
    expect(result.stderr).toBe("−");
    expect(chunks.join("")).toBe("−");
    expect(chunks).not.toContainEqual(expect.stringContaining("�"));
  });

  test("reports a failing command's exit code", async () => {
    // When - a command exits non-zero
    const result = await runCommand({
      args: ["-e", "process.exit(3)"],
      command: process.execPath,
    });

    // Then - its code comes through
    expect(result.exitCode).toBe(3);
  });

  test("notes a command killed for running too long", async () => {
    // When - a command outlives its timeout
    const result = await runCommand({
      args: ["-e", WAIT_FOREVER_SCRIPT],
      command: process.execPath,
      timeoutMs: 200,
    });

    // Then - it counts as failed, and stderr says why it stopped
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe(
      "\nkilled by SIGKILL (interrupted, or still running after 0m)"
    );
  });

  test("kills a command when its signal aborts", async () => {
    // Given - a running command and its abort controller
    const controller = new AbortController();

    const running = runCommand({
      args: ["-e", WAIT_FOREVER_SCRIPT],
      command: process.execPath,
      signal: controller.signal,
    });

    // When - the signal aborts
    controller.abort();

    // Then - the command stops, noted as killed
    const result = await running;

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("killed by SIGTERM");
  });

  test("rejects when the command can't start", async () => {
    // When - the executable doesn't exist
    const running = runCommand({
      args: [],
      command: "safe-fns-research-no-such-command",
    });

    // Then - the spawn error comes through
    await expect(running).rejects.toThrow("ENOENT");
  });
});
