import path from "node:path";
import { describe, expect, test } from "vitest";

import type { ReadDockerfile } from "./images.ts";
import type { FunctionResult, ResultColumn } from "./results.ts";

import {
  describeStaleImage,
  findStaleImages,
  ROLE_LABEL,
  ROLES,
  toReportedImage,
} from "./images.ts";

const GO_IMAGE = "golang:1.27.1-bookworm@sha256:new";

const NODE_IMAGE = "node:26.10.0-bookworm-slim@sha256:node";

const POSTGRES_IMAGE = "postgres:18.6-bookworm@sha256:pg";

function column({
  image,
  service,
}: Pick<ResultColumn, "image" | "service">): ResultColumn {
  return {
    call: "f(value)",
    image,
    locale: "-",
    name: "Tool",
    outcomes: [],
    service,
    tier: 2,
    version: "1",
  };
}

/** A Dockerfile reader that serves one file and fails on any other path. */
function dockerfileAt({
  file,
  text,
}: {
  file: string;
  text: string;
}): ReadDockerfile {
  return (requested) => {
    if (requested !== file) {
      throw new Error(`unexpected read of ${requested}`);
    }

    return text;
  };
}

function result({
  columns,
  function: functionName,
}: Pick<FunctionResult, "columns" | "function">): FunctionResult {
  return {
    cases: [],
    columns,
    function: functionName,
  };
}

function unreadable(file: Parameters<ReadDockerfile>[0]): never {
  throw new Error(`unexpected read of ${file}`);
}

describe("toReportedImage", () => {
  test("reports a pulled service's own image", () => {
    // Given - a service that pins an image
    const service = { image: GO_IMAGE };

    // When - naming its image
    const image = toReportedImage({
      readDockerfile: unreadable,
      service,
      services: { go: service },
    });

    // Then - it's the pin
    expect(image).toBe(GO_IMAGE);
  });

  test("reports a built service's first FROM, resolved from its context", () => {
    // Given - a build whose Dockerfile sits outside its context
    const service = {
      build: { context: "/repo/research/adapters/go", dockerfile: "../../d" },
    };

    const readDockerfile = dockerfileAt({
      file: path.resolve("/repo/research/d"),
      text: `# comment\nFROM ${GO_IMAGE} AS build\nFROM scratch\n`,
    });

    // When - naming its image
    const image = toReportedImage({
      readDockerfile,
      service,
      services: { go: service },
    });

    // Then - it's the first FROM
    expect(image).toBe(GO_IMAGE);
  });

  test("defaults a build to the current directory's Dockerfile", () => {
    // Given - a build with neither a context nor a dockerfile
    const readDockerfile = dockerfileAt({
      file: path.resolve(".", "Dockerfile"),
      text: `FROM ${NODE_IMAGE}\n`,
    });

    // When - naming its image
    const image = toReportedImage({
      readDockerfile,
      service: { build: {} },
      services: {},
    });

    // Then - the default Dockerfile's FROM is used
    expect(image).toBe(NODE_IMAGE);
  });

  test.each([
    { description: "a Dockerfile without FROM", service: { build: {} } },
    { description: "a service with neither image nor build", service: {} },
  ])("reports unknown for $description", ({ service }) => {
    // When - naming its image
    const image = toReportedImage({
      readDockerfile: () => "RUN true\n",
      service,
      services: {},
    });

    // Then - nothing is guessed
    expect(image).toBe("unknown");
  });

  test("reports a database adapter's database image", () => {
    // Given - an adapter that depends on a cache and a database
    const service = {
      build: { context: "." },
      depends_on: { cache: {}, missing: {}, postgres: {} },
    };

    const services = {
      cache: { image: "redis:8", labels: { [ROLE_LABEL]: ROLES.adapter } },
      postgres: {
        image: POSTGRES_IMAGE,
        labels: { [ROLE_LABEL]: ROLES.database },
      },
      "postgres-adapter": service,
    };

    // When - naming its image
    const image = toReportedImage({
      readDockerfile: unreadable,
      service,
      services,
    });

    // Then - it's the database's, and its own Dockerfile is never read
    expect(image).toBe(POSTGRES_IMAGE);
  });

  test("reports its own image when no dependency is a database", () => {
    // Given - a dependency without labels
    const service = { depends_on: { cache: {} }, image: GO_IMAGE };

    // When - naming its image
    const image = toReportedImage({
      readDockerfile: unreadable,
      service,
      services: { cache: { image: "redis:8" }, go: service },
    });

    // Then - it's its own
    expect(image).toBe(GO_IMAGE);
  });
});

describe("findStaleImages", () => {
  test("passes columns that match their service's image", () => {
    // Given - results recorded on today's images, plus image-less columns
    const results = [
      result({
        columns: [
          column({ image: "-", service: "-" }),
          column({ image: "-", service: "sources" }),
          column({ image: GO_IMAGE, service: "go" }),
        ],
        function: "safeParseBoolean",
      }),
    ];

    // When - checking them
    const staleImages = findStaleImages({
      reportedImages: new Map([["go", GO_IMAGE]]),
      results,
    });

    // Then - nothing is stale
    expect(staleImages).toStrictEqual([]);
  });

  test("names each stale function and service once", () => {
    // Given - two columns on an old digest, and one on another old one
    const oldImage = "golang:1.27.1-bookworm@sha256:old";

    const results = [
      result({
        columns: [
          column({ image: oldImage, service: "go" }),
          column({ image: oldImage, service: "go" }),
        ],
        function: "safeParseBoolean",
      }),
      result({
        columns: [
          column({ image: GO_IMAGE, service: "go" }),
          column({ image: "golang:1.26@sha256:older", service: "go" }),
        ],
        function: "safeParseNumber",
      }),
    ];

    // When - checking them
    const staleImages = findStaleImages({
      reportedImages: new Map([["go", GO_IMAGE]]),
      results,
    });

    // Then - one entry per function, service, and recorded image
    expect(staleImages).toStrictEqual([
      {
        function: "safeParseBoolean",
        recorded: oldImage,
        reported: GO_IMAGE,
        service: "go",
      },
      {
        function: "safeParseNumber",
        recorded: "golang:1.26@sha256:older",
        reported: GO_IMAGE,
        service: "go",
      },
    ]);
  });

  test("flags a column whose service is gone", () => {
    // Given - a column from a service Compose no longer has
    const results = [
      result({
        columns: [column({ image: GO_IMAGE, service: "go" })],
        function: "safeParseBoolean",
      }),
    ];

    // When - checking it
    const staleImages = findStaleImages({ reportedImages: new Map(), results });

    // Then - it's stale, with no reported image
    expect(staleImages).toStrictEqual([
      {
        function: "safeParseBoolean",
        recorded: GO_IMAGE,
        reported: undefined,
        service: "go",
      },
    ]);
  });
});

describe("describeStaleImage", () => {
  test("names the service and both images", () => {
    // When - describing a stale service
    const line = describeStaleImage({
      function: "safeParseBoolean",
      recorded: "golang:old",
      reported: GO_IMAGE,
      service: "go",
    });

    // Then - every part is in the line
    expect(line).toBe(
      `safeParseBoolean: "go" reports ${GO_IMAGE}, but its results record golang:old`
    );
  });

  test("says when the service is gone", () => {
    // When - describing a column whose service was removed
    const line = describeStaleImage({
      function: "safeParseBoolean",
      recorded: GO_IMAGE,
      reported: undefined,
      service: "go",
    });

    // Then - it says so, with the recorded image
    expect(line).toBe(
      `safeParseBoolean: "go" isn't a Compose service any more (results record ${GO_IMAGE})`
    );
  });
});
