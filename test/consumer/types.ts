/*
 * Imports the packed package the way a consumer would, typechecked by
 * `pnpm test:consumer` against every supported TypeScript version and module
 * resolution mode.
 *
 * - Must stay parseable by TypeScript 4.9: no `const` type parameters, no
 *   `NoInfer`, no `satisfies`.
 *
 * - Each annotation fails to compile if a published declaration is missing or
 *   loses its type.
 */
import { isPlaceholder } from "safe-fns";
import { isPlaceholder as isPlaceholderFromSubpath } from "safe-fns/is-placeholder";

export const isRootPlaceholder: true = isPlaceholder;
export const isSubpathPlaceholder: true = isPlaceholderFromSubpath;
