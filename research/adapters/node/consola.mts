import { createConsola } from "consola/basic";

import type { Tool } from "./tool.mts";

import { captureLogging, isLoggerCase } from "./logger-capture.mts";
import { packageVersion } from "./tool.mts";

/**
 * consola's tagged loggers from `consola/basic`, its basic reporter, which
 * writes to `process.stdout` and `process.stderr`; level 5 lets `debug` and
 * `trace` write too (its default, 3, drops both), and dates are off, so a
 * rerun writes the same text.
 */
export const CONSOLA: Tool = {
  functions: {
    createLogger: [
      {
        accepts: isLoggerCase,
        call: "createConsola({ formatOptions: { date: false }, level: 5 }).withTag(scope)[method](...args)",
        run: (args) =>
          captureLogging({
            args,
            create: (scope) => {
              const logger = createConsola({
                formatOptions: { date: false },
                level: 5,
              }).withTag(scope as string);

              return (method, logArgs) => {
                Reflect.apply(
                  Reflect.get(logger, method) as (...values: unknown[]) => void,
                  logger,
                  logArgs
                );
              };
            },
          }),
      },
    ],
  },
  name: "consola",
  tier: 1,
  version: packageVersion("consola"),
};
