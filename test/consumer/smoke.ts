/*
 * Loads every public entry of the installed package through both `import` and
 * `require`, run by `pnpm test:consumer` from a scratch project.
 *
 * - Each entry must load in both formats with the same export names.
 *
 * - The root entry must re-export everything a subpath does.
 */
import { createRequire } from "node:module";

type PackageJson = { exports: Record<string, unknown>; name: string };

const require = createRequire(import.meta.url);
const packageJson = require("safe-fns/package.json") as PackageJson;

const loadExportNames = async (specifier: string): Promise<string[]> => {
  const esmModule = (await import(specifier)) as Record<string, unknown>;
  const cjsModule = require(specifier) as Record<string, unknown>;
  const esmNames = Object.keys(esmModule).sort();
  const cjsNames = Object.keys(cjsModule).sort();

  if (esmNames.length === 0 || esmNames.join() !== cjsNames.join()) {
    throw new Error(
      `[smoke] ${specifier}: import gave [${esmNames.join()}], require gave [${cjsNames.join()}]`
    );
  }

  return esmNames;
};

const rootNames = new Set(await loadExportNames(packageJson.name));

const subpaths = Object.keys(packageJson.exports).filter(
  (subpath) => subpath !== "." && subpath !== "./package.json"
);

for (const subpath of subpaths) {
  const specifier = `${packageJson.name}/${subpath.slice(2)}`;
  const missingFromRoot = (await loadExportNames(specifier)).filter(
    (name) => !rootNames.has(name)
  );

  if (missingFromRoot.length > 0) {
    throw new Error(
      `[smoke] ${specifier}: not re-exported from the root: ${missingFromRoot.join()}`
    );
  }
}

console.log(
  `[smoke] Loaded ${subpaths.length + 1} entries via import and require.`
);
