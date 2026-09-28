import type { ViteUserConfig } from "vitest/config";

import { defineConfig } from "vitest/config";

const testFiles = ["{src,test}/**/*.test.ts"];

const config: ViteUserConfig = defineConfig({
  test: {
    /*
     * Coverage is configured once at the root, so one report aggregates both
     * projects; a per-project `coverage` block is ignored.
     *
     * - An explicit `include` counts untested files against coverage instead of
     *   leaving them out of the report.
     *
     * - A re-export-only file has no statements, so `src/index.ts` needs no
     *   exclusion once it holds nothing but re-exports.
     */
    coverage: {
      exclude: ["src/**/*.test.ts", "src/**/*.test-d.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["html", "json", "json-summary", "text"],
      thresholds: { 100: true },
    },
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: testFiles,
          name: "node",

          // Type tests run once; they don't depend on the runtime environment.
          typecheck: {
            enabled: true,
            include: ["{src,test}/**/*.test-d.ts"],
          },
        },
      },
      {
        extends: true,
        test: {
          environment: "jsdom",

          // `*.node.test.ts` files need Node built-ins that no browser has.
          exclude: ["**/*.node.test.ts"],
          include: testFiles,
          name: "jsdom",
        },
      },
    ],
  },
});

export default config;
