import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";

import { parseJson, readJsonFile } from "./json.ts";

/** A scratch directory for the files `readJsonFile` reads. */
const SCRATCH_DIR = mkdtempSync(path.join(tmpdir(), "research-json-"));

afterAll(() => {
  rmSync(SCRATCH_DIR, { force: true, recursive: true });
});

describe("parseJson", () => {
  test("returns the parsed value", () => {
    // When - parsing valid JSON
    const parsed = parseJson({ source: "a test", text: '{ "a": [1] }' });

    // Then - it is the value the text spells
    expect(parsed).toStrictEqual({ a: [1] });
  });

  test("names the source when the text isn't JSON", () => {
    // When - parsing text that isn't JSON
    const parse = (): unknown =>
      parseJson({ source: "the node adapter", text: "{" });

    // Then - the error names the source, with the SyntaxError as its cause
    expect(parse).toThrow(
      expect.objectContaining({
        cause: expect.any(SyntaxError) as unknown,
        message: "the node adapter isn't valid JSON",
      })
    );
  });
});

describe("readJsonFile", () => {
  test("reads and parses a file", () => {
    // Given - a file holding JSON
    const file = path.join(SCRATCH_DIR, "valid.json");
    writeFileSync(file, '{ "function": "codec" }');

    // When - reading it
    const parsed = readJsonFile(file);

    // Then - it is the file's value
    expect(parsed).toStrictEqual({ function: "codec" });
  });

  test("names the file when it isn't JSON", () => {
    // Given - a file that isn't JSON
    const file = path.join(SCRATCH_DIR, "broken.json");
    writeFileSync(file, "not json");

    // When - reading it
    const read = (): unknown => readJsonFile(file);

    // Then - the error names the file
    expect(read).toThrow(`${file} isn't valid JSON`);
  });
});
