import log from "loglevel";

import type { Tool } from "./tool.mts";

import { captureLogging, isLoggerCase } from "./logger-capture.mts";
import { packageVersion } from "./tool.mts";

/**
 * loglevel's named loggers, set to show every level; at its default level,
 * `warn`, the `debug`, `info`, and `log` calls write nothing.
 */
export const LOGLEVEL: Tool = {
  functions: {
    createLogger: [
      {
        accepts: isLoggerCase,
        call: 'log.getLogger(scope).setLevel("trace"); log.getLogger(scope)[method](...args)',
        run: (args) =>
          captureLogging({
            args,
            create: (scope) => {
              const logger = log.getLogger(scope as string);
              logger.setLevel("trace");

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
  name: "loglevel",
  tier: 1,
  version: packageVersion("loglevel"),
};
