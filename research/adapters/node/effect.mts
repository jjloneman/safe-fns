import { hasProperty } from "effect/Predicate";
import {
  BigIntFromString,
  decodeUnknownSync,
  isInt,
  NumberFromString,
} from "effect/Schema";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";

/** Effect's `Schema` decoders and `Predicate` guards. */
export const EFFECT: Tool = {
  functions: {
    safeObjectHasOwn: [
      {
        call: "Predicate.hasProperty(object, key)",
        run: ([object, key]) => hasProperty(object, key as string),
      },
    ],
    safeParseBigInt: [
      {
        call: "Schema.decodeUnknownSync(Schema.BigIntFromString)(value)",
        run: ([value]) => decodeUnknownSync(BigIntFromString)(value),
      },
    ],
    safeParseInt: [
      {
        call: "Schema.decodeUnknownSync(Schema.NumberFromString.check(Schema.isInt()))(value)",
        run: ([value]) =>
          decodeUnknownSync(NumberFromString.check(isInt()))(value),
      },
    ],
    safeParseNumber: [
      {
        call: "Schema.decodeUnknownSync(Schema.NumberFromString)(value)",
        run: ([value]) => decodeUnknownSync(NumberFromString)(value),
      },
    ],
  },
  name: "Effect",
  tier: 1,
  version: packageVersion("effect"),
};
