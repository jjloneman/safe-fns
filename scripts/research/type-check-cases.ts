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
        assertion: 'Equal<H<"fooBarBaz">, "fooBarBaz">',
        description: '`"fooBarBaz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"FooBarBaz">, "fooBarBaz">',
        description: '`"FooBarBaz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"foo_bar_baz">, "fooBarBaz">',
        description: '`"foo_bar_baz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"foo-bar-baz">, "fooBarBaz">',
        description: '`"foo-bar-baz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"foo bar baz">, "fooBarBaz">',
        description: '`"foo bar baz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"FOO_BAR_BAZ">, "fooBarBaz">',
        description: '`"FOO_BAR_BAZ"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"Foo Bar Baz">, "fooBarBaz">',
        description: '`"Foo Bar Baz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"foo.bar/baz">, "fooBarBaz">',
        description: '`"foo.bar/baz"` is `"fooBarBaz"`',
      },
      {
        assertion: 'Equal<H<"XMLHttpRequest">, "xmlHttpRequest">',
        description: '`"XMLHttpRequest"` is `"xmlHttpRequest"`',
      },
      {
        assertion: 'Equal<H<"IOError">, "ioError">',
        description: '`"IOError"` is `"ioError"`',
      },
      {
        assertion: 'Equal<H<"userID">, "userId">',
        description: '`"userID"` is `"userId"`',
      },
      {
        assertion: 'Equal<H<"iPhone">, "iPhone">',
        description: '`"iPhone"` is `"iPhone"`',
      },
      {
        assertion: 'Equal<H<"ABC">, "abc">',
        description: '`"ABC"` is `"abc"`',
      },
      {
        assertion: 'Equal<H<"version2Beta">, "version2Beta">',
        description: '`"version2Beta"` is `"version2Beta"`',
      },
      {
        assertion: 'Equal<H<"base64Encode">, "base64Encode">',
        description: '`"base64Encode"` is `"base64Encode"`',
      },
      {
        assertion: 'Equal<H<"HTML5Parser">, "html5Parser">',
        description: '`"HTML5Parser"` is `"html5Parser"`',
      },
      {
        assertion: 'Equal<H<"ABC123Def">, "abc123Def">',
        description: '`"ABC123Def"` is `"abc123Def"`',
      },
      {
        assertion: 'Equal<H<"v1.2.3">, "v123">',
        description: '`"v1.2.3"` is `"v123"`',
      },
      {
        assertion: 'Equal<H<"don\'t stop">, "dontStop">',
        description: '`"don\'t stop"` is `"dontStop"`',
      },
      {
        assertion: 'Equal<H<"the lord of the rings">, "theLordOfTheRings">',
        description: '`"the lord of the rings"` is `"theLordOfTheRings"`',
      },
      {
        assertion: 'Equal<H<"foo__bar">, "fooBar">',
        description: '`"foo__bar"` is `"fooBar"`',
      },
      {
        assertion: 'Equal<H<"_private">, "private">',
        description: '`"_private"` is `"private"`',
      },
      {
        assertion: 'Equal<H<"  padded  ">, "padded">',
        description: '`"  padded  "` is `"padded"`',
      },
      {
        assertion: 'Equal<H<"c++ code">, "c++Code">',
        description: '`"c++ code"` is `"c++Code"`',
      },
      {
        assertion: 'Equal<H<"a+b">, "a+B">',
        description: '`"a+b"` is `"a+B"`',
      },
      {
        assertion: 'Equal<H<"price$">, "price$">',
        description: '`"price$"` is `"price$"`',
      },
      {
        assertion: 'Equal<H<"20\\u00b0C">, string>',
        description: '`"20\u00b0C"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"userIDs">, "userIDs">',
        description: '`"userIDs"` is `"userIDs"`',
      },
      {
        assertion: 'Equal<H<"iOSApp">, "iOsApp">',
        description: '`"iOSApp"` is `"iOsApp"`',
      },
      {
        assertion: 'Equal<H<"version2beta">, "version2beta">',
        description: '`"version2beta"` is `"version2beta"`',
      },
      {
        assertion: 'Equal<H<"2fast4you">, "2fast4you">',
        description: '`"2fast4you"` is `"2fast4you"`',
      },
      {
        assertion: 'Equal<H<"\\u00c9coleNormale">, string>',
        description: '`"\u00c9coleNormale"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"e\\u0301coleNormale">, string>',
        description:
          '`"e\u0301coleNormale"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"stra\\u00dfe">, string>',
        description: '`"stra\u00dfe"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\u0130stanbul">, string>',
        description: '`"\u0130stanbul"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\u01c5emal">, string>',
        description: '`"\u01c5emal"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\u65e5\\u672c\\u8a9eText">, string>',
        description:
          '`"\u65e5\u672c\u8a9eText"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"emoji\\ud83d\\ude00Face">, string>',
        description:
          '`"emoji\ud83d\ude00Face"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\ud83d\\udc69\\u200d\\ud83d\\udcbbdev">, string>',
        description:
          '`"\ud83d\udc69\u200d\ud83d\udcbbdev"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"a">, "a">',
        description: '`"a"` is `"a"`',
      },
      {
        assertion: 'Equal<H<"">, "">',
        description: '`""` is `""`',
      },
      {
        assertion: "Equal<H<string>, string>",
        description: "`string` stays `string`",
      },
      {
        assertion: 'Equal<H<"user_id" | "first_name">, "userId" | "firstName">',
        description: "a union converts each member",
      },
      {
        assertion:
          'Equal<H<"key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">, "keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">',
        description: "a 60-word key (239 characters)",
      },
      {
        assertion:
          'Equal<H<"key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">, "keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">',
        description: "a 240-word key (959 characters)",
      },
    ],
    name: "CamelCase",
    tools: [
      {
        exportName: "CamelCase",
        module: "./camel-case",
        name: PLANNED_TOOL_NAME,
        sourceFiles: ["camel-case.ts", "words.ts"],
      },
      { exportName: "CamelCase", module: "scule", name: "scule" },
      { exportName: "CamelCase", module: "string-ts", name: "string-ts" },
      { exportName: "CamelCase", module: "type-fest", name: "type-fest" },
    ],
  },
  {
    cases: [
      {
        assertion:
          "Equal<H<{ first_name: string; user_id: number }>, { firstName: string; userId: number }>",
        description: "top-level keys convert",
      },
      {
        assertion:
          "Equal<H<{ home_address: { zip_code: string } }>, { homeAddress: { zipCode: string } }>",
        description: "nested keys convert",
      },
      {
        assertion:
          "Equal<H<{ line_items: { unit_price: number }[] }>, { lineItems: { unitPrice: number }[] }>",
        description: "keys inside an array of objects convert",
      },
      {
        assertion:
          "Equal<H<readonly [{ user_id: number }]>, readonly [{ userId: number }]>",
        description: "a tuple keeps its length and `readonly`",
      },
      {
        assertion:
          "Equal<H<{ readonly user_id?: number }>, { readonly userId?: number }>",
        description: "`?` and `readonly` are kept",
      },
      {
        assertion:
          "Equal<H<{ address: Address | null }>, { address: { city: string; zip: string } | null }>",
        description: "a union with `null` distributes",
      },
      {
        assertion:
          "Equal<H<{ created_at: Date; on_change: () => void }>, { createdAt: Date; onChange: () => void }>",
        description: "a `Date` and a function stay whole",
      },
      {
        assertion:
          "Equal<H<{ by_id: Map<string, { user_id: number }> }>, { byId: Map<string, { user_id: number }> }>",
        description: "a `Map` stays whole",
      },
      {
        assertion:
          "Equal<H<Record<string, { user_id: number }>>, Record<string, { userId: number }>>",
        description: "an index signature keeps its values converted",
      },
      {
        assertion:
          "Equal<H<{ 1: string; item_2: string }>, { 1: string; item2: string }>",
        description: "a numeric key stays",
      },
      {
        assertion:
          "Equal<H<{ _id: number; __typename: string }>, { id: number; typename: string }>",
        description: "outer underscores are dropped",
      },
      {
        assertion: 'Equal<H<{ fooBar: 2; foo_bar: 1 }>["fooBar"], 1 | 2>',
        description: "two keys that collide merge their values",
      },
      {
        assertion: 'Equal<H<{ "\\u00e9cole_name": 1 }>, { [key: string]: 1 }>',
        description: "a key outside ASCII becomes an index signature",
      },
      {
        assertion:
          'Equal<H<{ __typename: string; _id: number; user_id: number }, never, "_id" | "__typename">, { __typename: string; _id: number; userId: number }>',
        description: "an excluded key keeps its name",
      },
      {
        assertion:
          'Equal<H<{ meta_data: { _id: number; inner_key: number } }, never, "_id">, { metaData: { _id: number; innerKey: number } }>',
        description: "a key is excluded at any depth",
      },
      {
        assertion:
          'Equal<H<{ raw_data: { inner_key: number } }, never, "raw_data">, { raw_data: { innerKey: number } }>',
        description: "an excluded key's value is still converted",
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
    name: "CamelCaseKeys",
    tools: [
      {
        exportName: "CamelCaseKeys",
        module: "./camel-case-keys",
        name: PLANNED_TOOL_NAME,
        sourceFiles: [
          "camel-case-keys.ts",
          "camel-case.ts",
          "leaf.ts",
          "words.ts",
        ],
      },
      { exportName: "DeepCamelKeys", module: "string-ts", name: "string-ts" },
      {
        exportName: "CamelCasedPropertiesDeep",
        module: "type-fest",
        name: "type-fest",
      },
    ],
  },
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
  {
    cases: [
      {
        assertion: 'Equal<H<"fooBarBaz">, "foo_bar_baz">',
        description: '`"fooBarBaz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"FooBarBaz">, "foo_bar_baz">',
        description: '`"FooBarBaz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"foo_bar_baz">, "foo_bar_baz">',
        description: '`"foo_bar_baz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"foo-bar-baz">, "foo_bar_baz">',
        description: '`"foo-bar-baz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"foo bar baz">, "foo_bar_baz">',
        description: '`"foo bar baz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"FOO_BAR_BAZ">, "foo_bar_baz">',
        description: '`"FOO_BAR_BAZ"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"Foo Bar Baz">, "foo_bar_baz">',
        description: '`"Foo Bar Baz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"foo.bar/baz">, "foo_bar_baz">',
        description: '`"foo.bar/baz"` is `"foo_bar_baz"`',
      },
      {
        assertion: 'Equal<H<"XMLHttpRequest">, "xml_http_request">',
        description: '`"XMLHttpRequest"` is `"xml_http_request"`',
      },
      {
        assertion: 'Equal<H<"IOError">, "io_error">',
        description: '`"IOError"` is `"io_error"`',
      },
      {
        assertion: 'Equal<H<"userID">, "user_id">',
        description: '`"userID"` is `"user_id"`',
      },
      {
        assertion: 'Equal<H<"iPhone">, "i_phone">',
        description: '`"iPhone"` is `"i_phone"`',
      },
      {
        assertion: 'Equal<H<"ABC">, "abc">',
        description: '`"ABC"` is `"abc"`',
      },
      {
        assertion: 'Equal<H<"version2Beta">, "version2_beta">',
        description: '`"version2Beta"` is `"version2_beta"`',
      },
      {
        assertion: 'Equal<H<"base64Encode">, "base64_encode">',
        description: '`"base64Encode"` is `"base64_encode"`',
      },
      {
        assertion: 'Equal<H<"HTML5Parser">, "html5_parser">',
        description: '`"HTML5Parser"` is `"html5_parser"`',
      },
      {
        assertion: 'Equal<H<"ABC123Def">, "abc123_def">',
        description: '`"ABC123Def"` is `"abc123_def"`',
      },
      {
        assertion: 'Equal<H<"v1.2.3">, "v1_2_3">',
        description: '`"v1.2.3"` is `"v1_2_3"`',
      },
      {
        assertion: 'Equal<H<"don\'t stop">, "dont_stop">',
        description: '`"don\'t stop"` is `"dont_stop"`',
      },
      {
        assertion: 'Equal<H<"the lord of the rings">, "the_lord_of_the_rings">',
        description: '`"the lord of the rings"` is `"the_lord_of_the_rings"`',
      },
      {
        assertion: 'Equal<H<"foo__bar">, "foo_bar">',
        description: '`"foo__bar"` is `"foo_bar"`',
      },
      {
        assertion: 'Equal<H<"_private">, "private">',
        description: '`"_private"` is `"private"`',
      },
      {
        assertion: 'Equal<H<"  padded  ">, "padded">',
        description: '`"  padded  "` is `"padded"`',
      },
      {
        assertion: 'Equal<H<"c++ code">, "c_++_code">',
        description: '`"c++ code"` is `"c_++_code"`',
      },
      {
        assertion: 'Equal<H<"a+b">, "a_+_b">',
        description: '`"a+b"` is `"a_+_b"`',
      },
      {
        assertion: 'Equal<H<"price$">, "price_$">',
        description: '`"price$"` is `"price_$"`',
      },
      {
        assertion: 'Equal<H<"20\\u00b0C">, string>',
        description: '`"20\u00b0C"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"userIDs">, "user_i_ds">',
        description: '`"userIDs"` is `"user_i_ds"`',
      },
      {
        assertion: 'Equal<H<"iOSApp">, "i_os_app">',
        description: '`"iOSApp"` is `"i_os_app"`',
      },
      {
        assertion: 'Equal<H<"version2beta">, "version2beta">',
        description: '`"version2beta"` is `"version2beta"`',
      },
      {
        assertion: 'Equal<H<"2fast4you">, "2fast4you">',
        description: '`"2fast4you"` is `"2fast4you"`',
      },
      {
        assertion: 'Equal<H<"\\u00c9coleNormale">, string>',
        description: '`"\u00c9coleNormale"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"e\\u0301coleNormale">, string>',
        description:
          '`"e\u0301coleNormale"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"stra\\u00dfe">, string>',
        description: '`"stra\u00dfe"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\u0130stanbul">, string>',
        description: '`"\u0130stanbul"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\u01c5emal">, string>',
        description: '`"\u01c5emal"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\u65e5\\u672c\\u8a9eText">, string>',
        description:
          '`"\u65e5\u672c\u8a9eText"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"emoji\\ud83d\\ude00Face">, string>',
        description:
          '`"emoji\ud83d\ude00Face"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"\\ud83d\\udc69\\u200d\\ud83d\\udcbbdev">, string>',
        description:
          '`"\ud83d\udc69\u200d\ud83d\udcbbdev"`, outside ASCII, widens to `string`',
      },
      {
        assertion: 'Equal<H<"a">, "a">',
        description: '`"a"` is `"a"`',
      },
      {
        assertion: 'Equal<H<"">, "">',
        description: '`""` is `""`',
      },
      {
        assertion: "Equal<H<string>, string>",
        description: "`string` stays `string`",
      },
      {
        assertion: 'Equal<H<"userId" | "firstName">, "user_id" | "first_name">',
        description: "a union converts each member",
      },
      {
        assertion:
          'Equal<H<"keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">, "key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">',
        description: "a 60-word key (180 characters)",
      },
      {
        assertion:
          'Equal<H<"keyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKeyKey">, "key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key_key">',
        description: "a 240-word key (720 characters)",
      },
    ],
    name: "SnakeCase",
    tools: [
      {
        exportName: "SnakeCase",
        module: "./snake-case",
        name: PLANNED_TOOL_NAME,
        sourceFiles: ["snake-case.ts", "words.ts"],
      },
      { exportName: "SnakeCase", module: "scule", name: "scule" },
      { exportName: "SnakeCase", module: "string-ts", name: "string-ts" },
      { exportName: "SnakeCase", module: "type-fest", name: "type-fest" },
    ],
  },
];
