/*
 * The type-level cases `pnpm research:types` checks: each planned type helper,
 * the libraries compared with it, and the assertions every one is held to.
 */

/** One assertion, written against the helper under test as `H`. */
export type TypeCheckCase = {
  /**
   * A type that must resolve to `true`, using `Equal`, `Assignable`, the
   * fixtures in `TYPE_CHECK_FIXTURES`, and `H`, the helper under test.
   *
   * @example `"Equal<H<{ when: Date }>, { when?: Date }>"`
   */
  assertion: string;

  /**
   * What the case checks, as the table's first column shows it.
   *
   * @example "a `Date` stays whole"
   */
  description: string;
};

/** A type helper, its cases, and the libraries compared with it. */
export type TypeCheckFunction = {
  /**
   * The cases, in table order.
   *
   * @example `[{ assertion: "Equal<H<any>, any>", description: "any" }]`
   */
  cases: readonly TypeCheckCase[];

  /**
   * The helper's name, which names its table file in kebab case.
   *
   * @example "PartialDeep"
   */
  name: string;

  /**
   * Every column, the planned helper first.
   *
   * @example `[{ exportName: "PartialDeep", module: "type-fest", name: "type-fest" }]`
   */
  tools: readonly TypeCheckTool[];
};

/** One library's version of a helper, imported as `H`. */
export type TypeCheckTool = {
  /**
   * The exported type's name.
   *
   * @example "DeepPartial"
   */
  exportName: string;

  /**
   * The module specifier it is imported from; one starting `./` is a planned
   * helper's file under `research/types/`, copied beside the checks.
   *
   * @example "ts-essentials"
   */
  module: string;

  /**
   * The column's name, and the package whose version the table reports,
   * except for the planned helper.
   *
   * @example "ts-essentials"
   */
  name: string;

  /**
   * The files, beside the checks, whose errors count against this tool: a
   * planned helper's own file and what it imports. A library's errors are
   * matched by its package directory instead.
   *
   * @example `["partial-deep.ts", "leaf.ts"]`
   */
  sourceFiles?: readonly string[];
};

/** The column name of the planned helper, which has no package version. */
export const PLANNED_TOOL_NAME = "safe-fns (planned)";

/**
 * Declarations every check file starts with: the equality and assignability
 * tests, and the fixture types the assertions use.
 */
export const TYPE_CHECK_FIXTURES = `
type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false;
type Assignable<A, B> = [A] extends [B] ? true : false;
type Expect<T extends true> = T;
type Address = { city: string; zip: string };
type PartialAddress = { city?: string; zip?: string };
type Tree = { children: Tree[]; name: string };
enum Day {
  Monday = "Monday",
  Tuesday = "Tuesday",
}
enum Level {
  Low,
  High,
}
`;

/** Every planned type helper, in the order its table is written. */
export const TYPE_CHECK_FUNCTIONS: readonly TypeCheckFunction[] = [
  {
    cases: [
      {
        assertion: "Equal<H<{ day: Day }>, { day: `${Day}` }>",
        description: "a string enum becomes its values",
      },
      {
        assertion: 'Assignable<{ day: "Monday" }, H<{ day: Day }>>',
        description: "a string literal is accepted for a string enum",
      },
      {
        assertion: "Equal<H<{ days: Day[] }>, { days: `${Day}`[] }>",
        description: "an array of a string enum",
      },
      {
        assertion:
          "Equal<H<{ at: { day: Day | null } }>, { at: { day: `${Day}` | null } }>",
        description: "a nested string enum in a union with `null`",
      },
      {
        assertion: "Equal<H<{ day?: Day }>, { day?: `${Day}` }>",
        description: "an optional property stays optional",
      },
      {
        assertion: "Equal<H<{ level: Level }>, { level: Level }>",
        description: "a numeric enum stays an enum",
      },
      {
        assertion: "Equal<H<{ name: string }>, { name: string }>",
        description: "`string` stays `string`",
      },
      {
        assertion:
          "Equal<H<{ fn: (day: Day) => Day; when: Date }>, { fn: (day: Day) => Day; when: Date }>",
        description: "a function and a `Date` stay whole",
      },
      {
        assertion: "Equal<H<any>, any>",
        description: "`any` stays `any`",
      },
      {
        assertion: "Equal<H<unknown>, unknown>",
        description: "`unknown` stays `unknown`",
      },
    ],
    name: "EnumLiteralsDeep",
    tools: [
      {
        exportName: "EnumLiteralsDeep",
        module: "./enum-literals-deep",
        name: PLANNED_TOOL_NAME,
        sourceFiles: ["enum-literals-deep.ts", "leaf.ts"],
      },
    ],
  },
  {
    cases: [
      {
        assertion: "Equal<H<{ a: { b: number } }>, { a?: { b?: number } }>",
        description: "a nested object becomes partial",
      },
      {
        assertion:
          'Equal<H<{ address: Address | null }>["address"], PartialAddress | null | undefined>',
        description: "a union with `null` is made partial too",
      },
      {
        assertion:
          'Equal<H<{ fn: (x: number) => string }>["fn"], ((x: number) => string) | undefined>',
        description: "a function stays whole",
      },
      {
        assertion: 'Equal<H<{ when: Date }>["when"], Date | undefined>',
        description: "a `Date` stays whole",
      },
      {
        assertion:
          'Equal<H<{ byId: Map<string, Address> }>["byId"], Map<string, Address> | undefined>',
        description: "a `Map` stays whole",
      },
      {
        assertion:
          'Equal<H<{ ready: Promise<Address> }>["ready"], Promise<Address> | undefined>',
        description: "a `Promise` stays whole",
      },
      {
        assertion:
          'Equal<H<{ bytes: Uint8Array }>["bytes"], Uint8Array | undefined>',
        description: "a typed array stays whole",
      },
      {
        assertion:
          'Equal<H<{ list: Address[] }>["list"], PartialAddress[] | undefined>',
        description: "an array's items become partial; it stays mutable",
      },
      {
        assertion:
          'Equal<H<{ list: readonly Address[] }>["list"], readonly PartialAddress[] | undefined>',
        description: "a `readonly` array stays `readonly`",
      },
      {
        assertion:
          'Equal<H<{ pair: [number, Address] }>["pair"], [number, PartialAddress] | undefined>',
        description: "a tuple keeps its length",
      },
      {
        assertion:
          'Assignable<{ children: [{ children: [{ name: "leaf" }] }] }, H<Tree>>',
        description: "a recursive type",
      },
      {
        assertion: "Equal<H<any>, any>",
        description: "`any` stays `any`",
      },
      {
        assertion: "Equal<H<unknown>, unknown>",
        description: "`unknown` stays `unknown`",
      },
      {
        assertion: "Equal<H<{ at: Address }, Address>, { at?: Address }>",
        description: "a caller's stop type stays whole",
      },
    ],
    name: "PartialDeep",
    tools: [
      {
        exportName: "PartialDeep",
        module: "./partial-deep",
        name: PLANNED_TOOL_NAME,
        sourceFiles: ["partial-deep.ts", "leaf.ts"],
      },
      {
        exportName: "DeepPartial",
        module: "ts-essentials",
        name: "ts-essentials",
      },
      { exportName: "PartialDeep", module: "type-fest", name: "type-fest" },
      {
        exportName: "DeepPartial",
        module: "utility-types",
        name: "utility-types",
      },
    ],
  },
];
