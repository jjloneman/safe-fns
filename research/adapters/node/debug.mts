import createDebug from "debug";

import type { Tool } from "./tool.mts";

import { captureLogging, isLoggerCase } from "./logger-capture.mts";
import { packageVersion } from "./tool.mts";

/**
 * debug, which has one level and writes to `process.stderr` in Node, so every
 * method name reaches the same call; dates and colors are off, so a rerun
 * writes the same text, and each case disables what it enabled, so no case's
 * namespaces reach the next.
 */
export const DEBUG: Tool = {
  functions: {
    createLogger: [
      {
        accepts: isLoggerCase,
        call: "createDebug.enable(scope); createDebug(scope)(...args)",
        run: (args) =>
          captureLogging({
            args,
            create: (scope) => {
              const { inspectOpts } = createDebug;

              if (inspectOpts) {
                inspectOpts.colors = false;
                inspectOpts.hideDate = true;
              }

              createDebug.enable(scope as string);
              const logger = createDebug(scope as string);

              return (_method, logArgs) => {
                try {
                  logger(...(logArgs as [unknown, ...unknown[]]));
                } finally {
                  createDebug.disable();
                }
              };
            },
          }),
      },
    ],
  },
  name: "debug",
  tier: 1,
  version: packageVersion("debug"),
};
