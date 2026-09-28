import { describe, expect, test } from "vitest";

import { hostileInputs } from "#test/hostile-inputs";

/**
 * Inspect a value the way an unguarded helper would: list its entries, probe a
 * key, and coerce it to a string and a number.
 *
 * - Every hostile input must break at least one of these steps, or it isn't
 *   testing anything.
 */
function inspectWithoutGuards(value: unknown): void {
  Object.entries(value as object);
  Reflect.has(value as object, "then");
  "".concat(value as string);
  Number(value);
}

describe("hostile inputs", () => {
  test.each(hostileInputs)(
    "$description throws when inspected",
    ({ value }) => {
      // When
      const inspect = (): void => {
        inspectWithoutGuards(value);
      };

      // Then
      expect(inspect).toThrow();
    }
  );
});
