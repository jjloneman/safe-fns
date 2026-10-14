import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** The research harness's directory, which holds `compose.yaml`. */
const RESEARCH_ROOT = path.resolve(import.meta.dirname, "../../research");

/** Matches a `research/` directory an `updates` entry lists. */
const DEPENDABOT_DIRECTORY =
  /^\s+(?:- |directory: )"\/research(?<directory>[^"]*)"$/gmu;

/** Matches the first group an `updates` entry names. */
const DEPENDABOT_GROUP = /^ {4}groups:\n\s+(?<group>[\w-]+):$/mu;

/** Where each `updates` entry in `dependabot.yml` starts. */
const DEPENDABOT_ENTRY_START = /^ {2}- package-ecosystem: /mu;

/** Matches a Compose service's `image:` reference. */
const COMPOSE_IMAGE = /^\s*image:\s*(?<reference>\S+)\s*$/gmu;

/** Matches a Dockerfile's `FROM` reference, past any `--flag=…`. */
const DOCKERFILE_FROM = /^FROM\s+(?:--\S+\s+)*(?<reference>\S+)/gmu;

/** Matches a Dockerfile stage's name, from `FROM … AS <stage>`. */
const DOCKERFILE_STAGE = /^FROM\s.*\sAS\s+(?<stage>\S+)\s*$/gimu;

/**
 * Matches a pre-release tag.
 *
 * - PEP 440's `3.15.0a2`, `3.15.0b1`, and `3.15.0rc3`, which Python's images
 *   use.
 *
 * - A separated word: `1.0.0-beta.1`, `27.0.0-rc.1`, `26-ea-7`, `9.0-preview`.
 */
const PRE_RELEASE_TAG =
  /\d(?:a|b|rc)\d+|(?:^|[-._])(?:alpha|beta|canary|dev|ea|nightly|preview|rc|snapshot)\d*(?:$|[-._])/iu;

/** Matches the `versions` list of an `ignore` rule on the `python` image. */
const PYTHON_HOLD =
  /- dependency-name: "python"\n\s+versions:\n(?<versions>(?:\s+- ".*"\n)+)/gu;

/** Tags the pre-release pattern must flag, and ones it must not. */
const TAG_CASES = [
  {
    description: "a Python release candidate",
    isPreRelease: true,
    tag: "3.15.0rc3-slim-bookworm",
  },
  {
    description: "a Python alpha",
    isPreRelease: true,
    tag: "3.15.0a2-slim-bookworm",
  },
  { description: "a dotted beta", isPreRelease: true, tag: "1.0.0-beta.1" },
  {
    description: "a dotted release candidate",
    isPreRelease: true,
    tag: "27.0.0-rc.1",
  },
  {
    description: "a JDK early-access build",
    isPreRelease: true,
    tag: "26-ea-7",
  },
  {
    description: "a preview",
    isPreRelease: true,
    tag: "11.0.100-preview.7-noble",
  },
  {
    description: "a stable Python",
    isPreRelease: false,
    tag: "3.14.8-slim-bookworm",
  },
  {
    description: "a JDK flavor",
    isPreRelease: false,
    tag: "9.8.0-jdk25-noble",
  },
  {
    description: "a dated Debian",
    isPreRelease: false,
    tag: "trixie-20261005-slim",
  },
  {
    description: "a SQL Server CU",
    isPreRelease: false,
    tag: "2025-CU9-ubuntu-24.04",
  },
];

/** Compose's `image:` references. */
function readComposePins(): string[] {
  const compose = readFileSync(
    path.join(RESEARCH_ROOT, "compose.yaml"),
    "utf8"
  );

  return [...compose.matchAll(COMPOSE_IMAGE)].flatMap(
    (match) => match.groups?.reference ?? []
  );
}

/** Every `FROM` reference in one directory's Dockerfile, bar its own stages. */
function readDockerfilePins(directory: string): string[] {
  const dockerfile = readFileSync(path.join(directory, "Dockerfile"), "utf8");

  const stages = new Set(
    [...dockerfile.matchAll(DOCKERFILE_STAGE)].flatMap(
      (match) => match.groups?.stage ?? []
    )
  );

  return [...dockerfile.matchAll(DOCKERFILE_FROM)]
    .flatMap((match) => match.groups?.reference ?? [])
    .filter((reference) => !stages.has(reference));
}

/** The images one Dependabot `updates` entry bumps; none for other ecosystems. */
function readEntryPins(entry: string): string[] {
  if (entry.startsWith('"docker-compose"')) {
    return readComposePins();
  }

  if (!entry.startsWith('"docker"')) {
    return [];
  }

  return [...entry.matchAll(DEPENDABOT_DIRECTORY)].flatMap((match) =>
    readDockerfilePins(path.join(RESEARCH_ROOT, match.groups?.directory ?? ""))
  );
}

/**
 * The Dependabot group that bumps each research image, by image name.
 *
 * - The `docker-compose` entry bumps `compose.yaml`'s `image:` lines, and each
 *   `docker` entry its directories' `FROM`s.
 *
 * @returns every group that bumps an image, keyed by its name without a tag.
 */
function readGroupsByImage(): Map<string, Set<string>> {
  const dependabot = readFileSync(
    path.join(RESEARCH_ROOT, "../.github/dependabot.yml"),
    "utf8"
  );

  return dependabot
    .split(DEPENDABOT_ENTRY_START)
    .flatMap((entry, index) => {
      // An ungrouped entry opens its own PRs, so it counts as its own group.
      const group =
        DEPENDABOT_GROUP.exec(entry)?.groups?.group ?? `entry ${index}`;

      return readEntryPins(entry).map((pin) => ({ group, name: toName(pin) }));
    })
    .reduce((groupsByImage, { group, name }) => {
      groupsByImage.set(
        name,
        (groupsByImage.get(name) ?? new Set<string>()).add(group)
      );

      return groupsByImage;
    }, new Map<string, Set<string>>());
}

/** Every image the harness pins: Compose's `image:` lines and each `FROM`. */
function readImagePins(): string[] {
  const dockerfilePins = readdirSync(path.join(RESEARCH_ROOT, "docker"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) =>
      readDockerfilePins(path.join(RESEARCH_ROOT, "docker", entry.name))
    );

  return [...readComposePins(), ...dockerfilePins];
}

/** The `versions` of every `ignore` rule on `python` in `dependabot.yml`. */
function readPythonHolds(): string[] {
  const dependabot = readFileSync(
    path.join(RESEARCH_ROOT, "../.github/dependabot.yml"),
    "utf8"
  );

  return [...dependabot.matchAll(PYTHON_HOLD)].flatMap(
    (match) => match.groups?.versions?.replaceAll(/\s+/gu, " ").trim() ?? []
  );
}

/** The name of an image reference, without its tag or digest. */
function toName(reference: string): string {
  const [nameAndTag = ""] = reference.split("@");
  const tagStart = nameAndTag.lastIndexOf(":");

  return tagStart > nameAndTag.lastIndexOf("/")
    ? nameAndTag.slice(0, tagStart)
    : nameAndTag;
}

/** The tag of an image reference, between its name and its digest. */
function toTag(reference: string): string {
  const [nameAndTag = ""] = reference.split("@");

  return nameAndTag.slice(nameAndTag.lastIndexOf(":") + 1);
}

describe("research image pins", () => {
  test.each(TAG_CASES)(
    "the pre-release pattern classifies $description",
    ({ isPreRelease, tag }) => {
      // Given/When/Then - the tag is flagged only when it's a pre-release
      expect(PRE_RELEASE_TAG.test(tag)).toBe(isPreRelease);
    }
  );

  test("finds every Compose and Dockerfile pin", () => {
    // Given/When - every pin in the harness
    const pins = readImagePins();

    // Then - at least the Compose services and the Dockerfiles were read
    expect(pins.length).toBeGreaterThan(20);
  });

  test("never pins a pre-release, so a Dependabot miss fails CI", () => {
    // Given - every pin in the harness
    const pins = readImagePins();

    // When - keeping those whose tag is a pre-release
    const preReleases = pins.filter((pin) => PRE_RELEASE_TAG.test(toTag(pin)));

    // Then - there are none
    expect(preReleases).toEqual([]);
  });

  test("holds Python's pre-releases in the one entry that bumps 3.x", () => {
    // Given - every `ignore` on `python`, minus `python311`'s 3.11 hold
    const holds = readPythonHolds().filter(
      (versions) => versions !== '- ">= 3.12.0.a"'
    );

    // When - finding the groups that bump `python`
    const pythonGroups = readGroupsByImage().get("python");

    // Then - one hold, in the group beside `python311`'s own
    expect(holds).toHaveLength(1);
    expect(pythonGroups).toEqual(
      new Set(["research-dockerfiles", "research-python311"])
    );
  });

  test("bumps each shared image in one Dependabot group", () => {
    // Given - the groups that bump each image
    const groupsByImage = readGroupsByImage();

    // When - keeping images split across groups, bar `python311`'s hold
    const splitImages = [...groupsByImage]
      .filter(
        ([name, groups]) =>
          [...groups].filter(
            (group) => !(name === "python" && group === "research-python311")
          ).length > 1
      )
      .map(([name, groups]) => `${name}: ${[...groups].join(", ")}`);

    // Then - every shared image moves in one PR, so its results do too
    expect(groupsByImage.size).toBeGreaterThan(10);
    expect(splitImages).toEqual([]);
  });
});
