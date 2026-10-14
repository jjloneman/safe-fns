import { describe, expect, test } from "vitest";

import type { ReadInput, ServiceInputs } from "./inputs.ts";
import type { FunctionResult, ResultColumn } from "./results.ts";

import {
  describeStaleInputs,
  findStaleInputs,
  INPUTS_LABEL,
  toServiceInputs,
} from "./inputs.ts";

/** The SHA-256 of no bytes at all, which an empty manifest hashes to. */
const EMPTY_SHA256 =
  "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const RESEARCH_DIR = "/repo/research";

const RUBY_INPUTS: ServiceInputs = {
  files: ["docker/ruby/Dockerfile", "docker/ruby/Gemfile.lock"],
  fingerprint: "sha256:now",
};

/** A built service whose Dockerfile sits in its own context. */
function builtService(
  labels?: Record<string, string>
): Record<string, unknown> {
  return {
    build: {
      context: `${RESEARCH_DIR}/docker/ruby`,
      dockerfile: "Dockerfile",
    },
    labels,
  };
}

/** A ruby column, overriding its image, inputs, or service. */
function column({
  image = "ruby:4@sha256:r",
  inputs,
  service = "ruby",
}: Partial<Pick<ResultColumn, "image" | "inputs" | "service">>): ResultColumn {
  return {
    call: "f(value)",
    image,
    ...(inputs === undefined ? {} : { inputs }),
    locale: "-",
    name: "Tool",
    outcomes: [],
    service,
    tier: 4,
    version: "1",
  };
}

/** An input reader that serves fixed files and fails on any other path. */
function filesAt(files: Record<string, string>): ReadInput {
  return (requested) => {
    const text = files[requested];

    if (text === undefined) {
      throw new Error(`ENOENT: ${requested}`);
    }

    return new TextEncoder().encode(text);
  };
}

/** A `safeParseBoolean` result holding the given columns. */
function result(columns: ResultColumn[]): FunctionResult {
  return { cases: [], columns, function: "safeParseBoolean" };
}

describe("toServiceInputs", () => {
  test("adds a built service's Dockerfile to its declared inputs, sorted", () => {
    // Given - a loosely spaced label naming the Dockerfile again, as `./…`
    const service = builtService({
      [INPUTS_LABEL]: " docker/ruby/Gemfile.lock \n  ./docker/ruby/Dockerfile ",
    });

    // When - fingerprinting it
    const inputs = toServiceInputs({
      name: "ruby",
      readInput: filesAt({
        [`${RESEARCH_DIR}/docker/ruby/Dockerfile`]: "FROM ruby",
        [`${RESEARCH_DIR}/docker/ruby/Gemfile.lock`]: "json (2.0)",
      }),
      researchDir: RESEARCH_DIR,
      service,
    });

    // Then - each file once, relative to research/, with a SHA-256
    expect(inputs.files).toStrictEqual(RUBY_INPUTS.files);
    expect(inputs.fingerprint).toMatch(/^sha256:[\da-f]{64}$/u);
  });

  test("changes its fingerprint when one input changes", () => {
    // Given - the same service, read before and after a lockfile bump
    const service = builtService({
      [INPUTS_LABEL]: "docker/ruby/Gemfile.lock",
    });
    const fingerprintWith = (lockfile: string): string =>
      toServiceInputs({
        name: "ruby",
        readInput: filesAt({
          [`${RESEARCH_DIR}/docker/ruby/Dockerfile`]: "FROM ruby",
          [`${RESEARCH_DIR}/docker/ruby/Gemfile.lock`]: lockfile,
        }),
        researchDir: RESEARCH_DIR,
        service,
      }).fingerprint;

    // When - fingerprinting each version
    const before = fingerprintWith("json (2.0)");
    const after = fingerprintWith("json (2.1)");

    // Then - only the bumped lockfile tells them apart
    expect(after).not.toBe(before);
    expect(fingerprintWith("json (2.0)")).toBe(before);
  });

  test("hashes paths relative to research/, so checkouts agree", () => {
    // Given - one service checked out in two places
    const fingerprintIn = (researchDir: string): string =>
      toServiceInputs({
        name: "ruby",
        readInput: filesAt({ [`${researchDir}/docker/ruby/Dockerfile`]: "x" }),
        researchDir,
        service: {
          build: { context: `${researchDir}/docker/ruby` },
        },
      }).fingerprint;

    // When - fingerprinting both checkouts
    const onMac = fingerprintIn("/Users/owner/safe-fns/research");
    const onCi = fingerprintIn("/home/runner/work/safe-fns/research");

    // Then - the fingerprints match
    expect(onMac).toBe(onCi);
  });

  test("fingerprints a pulled service without inputs as an empty manifest", () => {
    // Given - a service that pins an image and declares nothing
    const service = { image: "php:8@sha256:p" };

    // When - fingerprinting it
    const inputs = toServiceInputs({
      name: "php",
      readInput: filesAt({}),
      researchDir: RESEARCH_DIR,
      service,
    });

    // Then - no files, and the hash of nothing
    expect(inputs).toStrictEqual({ files: [], fingerprint: EMPTY_SHA256 });
  });

  test("names the service and file when an input can't be read", () => {
    // Given - a service declaring a lockfile that doesn't exist
    const service = builtService({
      [INPUTS_LABEL]: "docker/ruby/Gemfile.lock",
    });

    // When - fingerprinting it
    const fingerprint = (): ServiceInputs =>
      toServiceInputs({
        name: "ruby",
        readInput: filesAt({ [`${RESEARCH_DIR}/docker/ruby/Dockerfile`]: "x" }),
        researchDir: RESEARCH_DIR,
        service,
      });

    // Then - it throws, naming both
    expect(fingerprint).toThrow(
      "the ruby service can't read its input docker/ruby/Gemfile.lock"
    );
  });
});

describe("findStaleInputs", () => {
  test("passes columns that record their service's fingerprint", () => {
    // Given - a column recording the current fingerprint
    const results = [result([column({ inputs: RUBY_INPUTS.fingerprint })])];

    // When - checking it
    const staleInputs = findStaleInputs({
      results,
      serviceInputs: new Map([["ruby", RUBY_INPUTS]]),
    });

    // Then - nothing is stale
    expect(staleInputs).toStrictEqual([]);
  });

  test("reports a changed or missing fingerprint once per service", () => {
    // Given - two columns from an old run, and two that predate fingerprints
    const results = [
      result([
        column({ inputs: "sha256:old" }),
        column({ inputs: "sha256:old" }),
      ]),
      { ...result([column({}), column({})]), function: "safeParseInteger" },
    ];

    // When - checking them
    const staleInputs = findStaleInputs({
      results,
      serviceInputs: new Map([["ruby", RUBY_INPUTS]]),
    });

    // Then - one entry per function, naming what each records
    expect(staleInputs).toStrictEqual([
      {
        files: RUBY_INPUTS.files,
        function: "safeParseBoolean",
        recorded: "sha256:old",
        service: "ruby",
      },
      {
        files: RUBY_INPUTS.files,
        function: "safeParseInteger",
        recorded: undefined,
        service: "ruby",
      },
    ]);
  });

  test("skips the planned column and a removed service", () => {
    // Given - the planned column, and a column from a service that's gone
    const results = [
      result([
        column({ image: "-", service: "-" }),
        column({ inputs: "sha256:old", service: "perl" }),
      ]),
    ];

    // When - checking them
    const staleInputs = findStaleInputs({
      results,
      serviceInputs: new Map([["ruby", RUBY_INPUTS]]),
    });

    // Then - neither is reported here
    expect(staleInputs).toStrictEqual([]);
  });
});

describe("describeStaleInputs", () => {
  test.each([
    {
      description: "a changed input",
      expected: `safeParseBoolean: "ruby" results don't match its inputs (docker/ruby/Dockerfile, docker/ruby/Gemfile.lock)`,
      files: RUBY_INPUTS.files,
      recorded: "sha256:old",
    },
    {
      description: "a missing fingerprint",
      expected: `safeParseBoolean: "ruby" columns record no input fingerprint`,
      files: RUBY_INPUTS.files,
      recorded: undefined,
    },
    {
      description: "inputs no longer declared",
      expected: `safeParseBoolean: "ruby" declares no inputs, but its results record some`,
      files: [],
      recorded: "sha256:old",
    },
  ])("describes $description", ({ expected, files, recorded }) => {
    // When - describing the stale service
    const description = describeStaleInputs({
      files,
      function: "safeParseBoolean",
      recorded,
      service: "ruby",
    });

    // Then - one line naming what changed
    expect(description).toBe(expected);
  });
});
