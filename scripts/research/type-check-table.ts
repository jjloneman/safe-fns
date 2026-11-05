import type { TypeCheckFunction, TypeCheckTool } from "./type-check-cases.ts";

/*
 * The pure half of `pnpm research:types`: reading `tsc`'s errors and writing
 * each helper's table.
 */

/** The file a check of one tool and one case is written to. */
export type CheckFileInput = {
  /**
   * The case's position in its helper's cases.
   *
   * @example 3
   */
  caseIndex: number;

  /**
   * The helper's name.
   *
   * @example "PartialDeep"
   */
  functionName: string;

  /**
   * The tool's position in its helper's tools.
   *
   * @example 1
   */
  toolIndex: number;
};

/** A committed audit file, and its text. */
export type CommittedTable = {
  /**
   * The file name in `research/audits/`.
   *
   * @example "partial-deep.md"
   */
  file: string;

  /**
   * The file's text.
   *
   * @example `"# PartialDeep type checks\n"`
   */
  text: string;
};

/** One compiler's run over every check file. */
export type CompilerRun = {
  /**
   * Every error the compiler printed.
   *
   * @example `[{ code: "TS2344", file: "PartialDeep/1-3.ts" }]`
   */
  errors: readonly TscError[];

  /**
   * The compiler's version.
   *
   * @example "4.9.5"
   */
  version: string;
};

/** What `findOrphanTables` compares. */
export type FindOrphanTablesInput = {
  /**
   * Every file in `research/audits/`, with its text.
   *
   * @example `[{ file: "partial-deep.md", text: "# PartialDeep type checks" }]`
   */
  committed: readonly CommittedTable[];

  /**
   * The table files the current helpers write.
   *
   * @example `["partial-deep.md"]`
   */
  expectedFiles: readonly string[];
};

/** What `renderTypeChecks` needs for one helper's table. */
export type RenderTypeChecksInput = {
  /**
   * The helper, its cases, and its tools.
   *
   * @example `TYPE_CHECK_FUNCTIONS[0]`
   */
  checkedFunction: TypeCheckFunction;

  /**
   * One run per compiler, oldest first.
   *
   * @example `[{ errors: [], version: "4.9.5" }]`
   */
  runs: readonly CompilerRun[];

  /**
   * Each library's installed version, by package name.
   *
   * @example `new Map([["type-fest", "5.10.0"]])`
   */
  toolVersions: ReadonlyMap<string, string>;
};

/** One error `tsc` printed, and the file it named, if any. */
export type TscError = {
  /**
   * The error code.
   *
   * @example "TS2344"
   */
  code: string;

  /**
   * The file, relative to the directory `tsc` ran in; `""` for an error that
   * names none, such as a config error.
   *
   * @example "PartialDeep/1-3.ts"
   */
  file: string;

  /**
   * The module whose program reported it; an error in a shared file, or in
   * none, counts only for that module's tool. Absent counts for every tool.
   *
   * @example "./camel-case"
   */
  program?: string;
};

/** The first line of a table `renderTypeChecks` writes. */
const TABLE_HEADING = /^# \S+ type checks(?:\n|$)/u;

/** A `tsc --pretty false` error line, with or without a file. */
const ERROR_LINE =
  /^(?:(?<file>[^\s(][^(]*)\(\d+,\d+\): )?error (?<code>TS\d+):/u;

/** The column of the case descriptions, before the tools'. */
const CASE_HEADER = "Case";

/**
 * Find committed type-check tables no current helper writes, such as one left
 * behind by a renamed or removed helper; other audits are never matched.
 *
 * @returns their file names, in the order given.
 */
export function findOrphanTables({
  committed,
  expectedFiles,
}: FindOrphanTablesInput): string[] {
  const expected = new Set(expectedFiles);

  return committed
    .filter(({ file, text }) => !expected.has(file) && TABLE_HEADING.test(text))
    .map(({ file }) => file);
}

/**
 * Read every error from `tsc --pretty false` output; other lines, such as a
 * message's continuation, are skipped.
 *
 * @returns the errors, in printed order.
 */
export function parseTscErrors(output: string): TscError[] {
  return output.split("\n").flatMap((line) => {
    const groups = ERROR_LINE.exec(line)?.groups;

    return groups?.code === undefined
      ? []
      : [{ code: groups.code, file: groups.file ?? "" }];
  });
}

/**
 * Write one helper's table: a row per case, a column per tool, and the
 * versions every column ran with.
 *
 * - A cell is ✅ when the check compiled on every compiler, and otherwise
 *   names the errors, followed by the compilers they came from when not every
 *   compiler failed alike.
 *
 * - An error in a tool's own package or source files, or one that names no
 *   file, counts against every check of that tool.
 *
 * @returns the Markdown file's text.
 */
export function renderTypeChecks({
  checkedFunction,
  runs,
  toolVersions,
}: RenderTypeChecksInput): string {
  const { cases, name: functionName, tools } = checkedFunction;
  const header = [
    CASE_HEADER,
    ...tools.map(({ exportName, name }) => `${name}<br>\`${exportName}\``),
  ];

  const rows = cases.map(({ assertion, description }, caseIndex) => [
    `${description}<br>${toCodeSpan(assertion)}`,
    ...tools.map((tool, toolIndex) =>
      toCell(
        runs.map(({ errors, version }) => ({
          codes: errors
            .filter(
              ({ file, program }) =>
                file === toCheckFile({ caseIndex, functionName, toolIndex }) ||
                ((file === "" || isToolFile({ file, tool })) &&
                  (program === undefined || program === tool.module))
            )
            .map(({ code }) => code),
          version,
        }))
      )
    ),
  ]);

  const libraryVersions = tools.flatMap(({ name }) => {
    const version = toolVersions.get(name);

    return version === undefined ? [] : [`${name} ${version}`];
  });

  return [
    `# ${functionName} type checks`,
    "",
    "Generated by `pnpm research:types`; never edit by hand.",
    "",
    '- Each case is compiled once per consumer TypeScript version, with `strict`, `lib: ["es2022"]`, no `types`, and `skipLibCheck`, importing the tool\'s type as `H`.',
    "- ✅ means it compiled on every version; ❌ names the errors, and the versions they came from when not every version failed alike.",
    "",
    "<!-- prettier-ignore-start -->",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => ":---").join(" | ")} |`,
    ...rows.map((cells) => `| ${cells.join(" | ")} |`),
    "<!-- prettier-ignore-end -->",
    "",
    "## Versions",
    "",
    `- TypeScript ${runs.map(({ version }) => version).join(", ")}`,
    ...libraryVersions.map((entry) => `- ${entry}`),
    "",
  ].join("\n");
}

/**
 * Name the file one check is written to, relative to the run's directory.
 *
 * @returns a path such as `PartialDeep/1-3.ts`.
 */
export function toCheckFile({
  caseIndex,
  functionName,
  toolIndex,
}: CheckFileInput): string {
  return `${functionName}/${toolIndex}-${caseIndex}.ts`;
}

/**
 * Name a helper's table in `research/audits/`, in kebab case, splitting a run
 * of capitals before its last letter.
 *
 * @returns a file name such as `partial-deep.md` or `json-value-deep.md`.
 */
export function toTableFile(functionName: string): string {
  return `${functionName
    .replaceAll(/(?<before>[a-z\d])(?<after>[A-Z])/gu, "$<before>-$<after>")
    .replaceAll(/(?<before>[A-Z])(?<after>[A-Z][a-z])/gu, "$<before>-$<after>")
    .toLowerCase()}.md`;
}

/** Check a pair of cells for the same codes, in order. */
function hasSameCodes({
  first,
  second,
}: {
  first: readonly string[];
  second: readonly string[];
}): boolean {
  return (
    first.length === second.length &&
    first.every((code, index) => code === second[index])
  );
}

/**
 * Whether an error's file belongs to a tool: one of its `sourceFiles`, or a
 * file in its own package, scoped (`@scope/name`) or not.
 */
function isToolFile({
  file,
  tool,
}: {
  file: string;
  tool: TypeCheckTool;
}): boolean {
  return tool.sourceFiles === undefined
    ? `/${file}/`.includes(`/${tool.module}/`)
    : tool.sourceFiles.includes(file);
}

/** Summarize one cell's errors across every compiler. */
function toCell(
  outcomes: readonly { codes: readonly string[]; version: string }[]
): string {
  const failures = outcomes.filter(({ codes }) => codes.length > 0);

  if (failures.length === 0) {
    return "✅";
  }

  const groups = failures.reduce<{ codes: string[]; versions: string[] }[]>(
    (groupsByCodes, { codes, version }) => {
      const uniqueCodes = [...new Set(codes)];
      const group = groupsByCodes.find(({ codes: groupCodes }) =>
        hasSameCodes({ first: groupCodes, second: uniqueCodes })
      );

      if (group === undefined) {
        groupsByCodes.push({ codes: uniqueCodes, versions: [version] });
      } else {
        group.versions.push(version);
      }

      return groupsByCodes;
    },
    []
  );

  const isUniform = groups.length === 1 && failures.length === outcomes.length;

  return `❌ ${groups
    .map(({ codes, versions }) => {
      const codeList = codes.map((code) => `\`${code}\``).join(", ");

      return isUniform ? codeList : `${codeList} (${versions.join(", ")})`;
    })
    .join("; ")}`;
}

/**
 * Write text as a code span inside a table cell: `|` is escaped, since GitHub
 * splits cells on it even inside code, and text holding a backtick gets a
 * double-backtick span.
 */
function toCodeSpan(text: string): string {
  const escaped = text.replaceAll("|", String.raw`\|`);

  return text.includes("`") ? `\`\` ${escaped} \`\`` : `\`${escaped}\``;
}
