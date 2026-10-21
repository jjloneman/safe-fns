import JSON5 from "json5";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** The research harness's directory, which holds `compose.yaml`. */
const RESEARCH_ROOT = path.resolve(import.meta.dirname, "../../research");

/** Matches a regex `allowedVersions`, as Renovate writes one: `/…/`. */
const ALLOWED_VERSIONS_REGEX = /^\/(?<source>.+)\/$/u;

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

/** Renovate's config, which groups and holds the research bumps. */
const RENOVATE_CONFIG = path.join(RESEARCH_ROOT, "../.github/renovate.json5");

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

/** The fields of a Renovate `packageRules` entry these tests read. */
type PackageRule = {
  /**
   * The versions a matched dependency may move to, as a `/…/` regex.
   *
   * @example `"/^3\\.11\\.\\d+-/"`
   */
  allowedVersions?: string;

  /**
   * The group whose one PR the matched updates share.
   *
   * @example "research"
   */
  groupName?: string;

  /**
   * The datasources a rule applies to.
   *
   * @example ["docker"]
   */
  matchDatasources?: string[];

  /**
   * The dependencies a rule applies to, by name.
   *
   * @example ["python"]
   */
  matchDepNames?: string[];

  /**
   * The files a rule applies to, as globs from the repo root.
   *
   * @example ["research/**"]
   */
  matchFileNames?: string[];

  /**
   * The managers a rule applies to.
   *
   * @example ["github-actions"]
   */
  matchManagers?: string[];

  /**
   * The packages a rule applies to, by name.
   *
   * @example ["python"]
   */
  matchPackageNames?: string[];
};

/** What `findPythonRule` looks up. */
type PythonRuleQuery = {
  /**
   * The directory under `research/docker/` whose Dockerfile pins `python`.
   *
   * @example "python311"
   */
  directory: string;

  /**
   * Renovate's rules, in the order it applies them.
   *
   * @example `[{ allowedVersions: "/^3\\.11\\./", matchDepNames: ["python"] }]`
   */
  rules: PackageRule[];
};

/** What `isResearchRule` checks. */
type ResearchRuleQuery = {
  /**
   * Files under `research/` that a rule's globs are tried against.
   *
   * @example ["research/docker/node/Dockerfile"]
   */
  researchFiles: string[];

  /**
   * The rule to check.
   *
   * @example `{ groupName: "research", matchFileNames: ["research/**"] }`
   */
  rule: PackageRule;
};

/**
 * The rule that sets which versions `python` may move to in one Dockerfile.
 *
 * - Renovate applies its rules in order, so the last match wins.
 */
function findPythonRule({
  directory,
  rules,
}: PythonRuleQuery): PackageRule | undefined {
  const dockerfile = `research/docker/${directory}/Dockerfile`;

  return [...rules]
    .reverse()
    .find(
      (rule) =>
        rule.allowedVersions !== undefined &&
        isPythonRule(rule) &&
        (rule.matchFileNames?.some((glob) =>
          path.matchesGlob(dockerfile, glob)
        ) ??
          true)
    );
}

/** Whether a parsed `packageRules` entry has the shape these tests read. */
function isPackageRule(value: unknown): value is PackageRule {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether a rule targets the `python` image, by dependency or package name. */
function isPythonRule(rule: PackageRule): boolean {
  const names = [
    ...(rule.matchDepNames ?? []),
    ...(rule.matchPackageNames ?? []),
  ];

  return (
    names.includes("python") &&
    (rule.matchDatasources?.includes("docker") ?? true)
  );
}

/**
 * Whether a rule can match a dependency under `research/`.
 *
 * - A glob counts when it names `research/`, or matches one of its files, so
 *   `**\/Dockerfile` does too.
 */
function isResearchRule({ researchFiles, rule }: ResearchRuleQuery): boolean {
  const isActionsOnly =
    rule.matchManagers?.every((manager) => manager === "github-actions") ??
    false;

  const canReachResearch =
    rule.matchFileNames?.some(
      (glob) =>
        glob.startsWith("research/") ||
        researchFiles.some((file) => path.matchesGlob(file, glob))
    ) ?? true;

  return !isActionsOnly && canReachResearch;
}

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

/** The name of each directory under `research/docker/`, one per Dockerfile. */
function readDockerfileDirectories(): string[] {
  return readdirSync(path.join(RESEARCH_ROOT, "docker"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Every `FROM` reference in one directory's Dockerfile, bar its own stages. */
function readDockerfilePins(directory: string): string[] {
  const dockerfile = readFileSync(
    path.join(RESEARCH_ROOT, "docker", directory, "Dockerfile"),
    "utf8"
  );

  const stages = new Set(
    [...dockerfile.matchAll(DOCKERFILE_STAGE)].flatMap(
      (match) => match.groups?.stage ?? []
    )
  );

  return [...dockerfile.matchAll(DOCKERFILE_FROM)]
    .flatMap((match) => match.groups?.reference ?? [])
    .filter((reference) => !stages.has(reference));
}

/** Every image the harness pins: Compose's `image:` lines and each `FROM`. */
function readImagePins(): string[] {
  return [
    ...readComposePins(),
    ...readDockerfileDirectories().flatMap((directory) =>
      readDockerfilePins(directory)
    ),
  ];
}

/** Renovate's `packageRules`, in the order it applies them. */
function readPackageRules(): PackageRule[] {
  const config: unknown = JSON5.parse(readFileSync(RENOVATE_CONFIG, "utf8"));

  const rules =
    typeof config === "object" && config !== null && "packageRules" in config
      ? config.packageRules
      : [];

  return Array.isArray(rules) ? rules.filter(isPackageRule) : [];
}

/** Each research Dockerfile's `python` tag, keyed by its directory's name. */
function readPythonPins(): Map<string, string> {
  return new Map(
    readDockerfileDirectories().flatMap((directory) =>
      readDockerfilePins(directory)
        .filter((pin) => toName(pin) === "python")
        .map((pin) => [directory, toTag(pin)] as const)
    )
  );
}

/** A rule's `/…/` `allowedVersions` as a regex, or one matching nothing. */
function toAllowedVersions(rule: PackageRule | undefined): RegExp {
  const source = ALLOWED_VERSIONS_REGEX.exec(rule?.allowedVersions ?? "")
    ?.groups?.source;

  return new RegExp(source ?? "(?!)", "u");
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

  test("never pins a pre-release, so a missed bot proposal fails CI", () => {
    // Given - every pin in the harness
    const pins = readImagePins();

    // When - keeping those whose tag is a pre-release
    const preReleases = pins.filter((pin) => PRE_RELEASE_TAG.test(toTag(pin)));

    // Then - there are none
    expect(preReleases).toEqual([]);
  });

  test("holds every Python image to final releases", () => {
    // Given - the hold on each Dockerfile that pins `python`, bar `python311`
    const rules = readPackageRules();

    const allowedVersions = [...readPythonPins().keys()]
      .filter((directory) => directory !== "python311")
      .map((directory) =>
        toAllowedVersions(findPythonRule({ directory, rules }))
      );

    // When - testing a final release and each kind of pre-release
    const verdicts = allowedVersions.map((allowed) =>
      [
        "3.14.8-slim-bookworm",
        "3.15.0a2-slim-bookworm",
        "3.15.0b1-slim-bookworm",
        "3.15.0rc3-slim-bookworm",
      ].map((tag) => allowed.test(tag))
    );

    // Then - only the final release is allowed, for every Dockerfile
    expect(allowedVersions.length).toBeGreaterThan(2);
    expect(new Set(verdicts.map((verdict) => verdict.join()))).toEqual(
      new Set(["true,false,false,false"])
    );
  });

  test("holds python311 on 3.11", () => {
    // Given - the hold on `python311`'s Dockerfile
    const allowed = toAllowedVersions(
      findPythonRule({ directory: "python311", rules: readPackageRules() })
    );

    // When - testing its own pin and the next minor
    const pin = readPythonPins().get("python311") ?? "";

    // Then - it keeps 3.11 and refuses 3.12
    expect(allowed.test(pin)).toBe(true);
    expect(allowed.test("3.12.0-slim-bookworm")).toBe(false);
  });

  test("keeps every Python pin inside its hold", () => {
    // Given - each Dockerfile's `python` tag, and Renovate's rules
    const pins = [...readPythonPins()];
    const rules = readPackageRules();

    // When - keeping those its own hold would refuse
    const refused = pins.filter(
      ([directory, tag]) =>
        !toAllowedVersions(findPythonRule({ directory, rules })).test(tag)
    );

    // Then - there are none
    expect(refused).toEqual([]);
  });

  test("bumps every research dependency in one group", () => {
    // Given - every rule that names a group, and each research Dockerfile
    const groupRules = readPackageRules().filter(
      (rule) => rule.groupName !== undefined
    );

    const researchFiles = readDockerfileDirectories().map(
      (directory) => `research/docker/${directory}/Dockerfile`
    );

    // When - keeping those that can reach `research/`
    const researchGroups = groupRules
      .filter((rule) => isResearchRule({ researchFiles, rule }))
      .map((rule) => ({
        groupName: rule.groupName,
        matchFileNames: rule.matchFileNames,
      }));

    // Then - one group covers all of it, so a shared image moves in one PR
    expect(researchGroups).toEqual([
      { groupName: "research", matchFileNames: ["research/**"] },
    ]);
  });
});
