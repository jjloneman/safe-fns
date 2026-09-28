import { describe, expect, test } from "vitest";

import { crossRealmInputs } from "#test/cross-realm-inputs";

describe("cross-realm inputs", () => {
  test.each(crossRealmInputs)(
    "$description is not an instance of this realm's Object",
    ({ value }) => {
      // Given/When/Then
      expect(value instanceof Object).toBe(false);
    }
  );
});
