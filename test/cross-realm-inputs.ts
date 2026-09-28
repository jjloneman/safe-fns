import { runInNewContext } from "node:vm";

import type { HostileInput } from "#test/hostile-inputs";

const fromOtherRealm = (source: string): unknown => runInNewContext(source);

/**
 * Values created in another realm, whose prototypes aren't this realm's
 * intrinsics.
 *
 * - They defeat `instanceof`, so a check that relies on it misreads them; a
 *   brand check such as `Array.isArray` still works.
 *
 * - Node-only, because they come from `node:vm`; import this only from a
 *   `*.node.test.ts` file.
 */
export const crossRealmInputs: readonly HostileInput[] = [
  { description: "a cross-realm array", value: fromOtherRealm("[1, 2]") },
  { description: "a cross-realm Date", value: fromOtherRealm("new Date(0)") },
  { description: "a cross-realm Error", value: fromOtherRealm("new Error()") },
  { description: "a cross-realm Map", value: fromOtherRealm("new Map()") },
  { description: "a cross-realm object", value: fromOtherRealm("({ a: 1 })") },
  { description: "a cross-realm RegExp", value: fromOtherRealm("/a/") },
  { description: "a cross-realm Set", value: fromOtherRealm("new Set()") },
];
