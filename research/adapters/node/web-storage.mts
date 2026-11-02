import type { Probe } from "./tool.mts";

import { callJsonParse } from "./tool.mts";

/** The JSON helpers' case-file functions, each with its probes. */
type JsonStorageProbes = Record<
  "safeStorageGetJson" | "safeStorageSetJson",
  readonly Probe[]
>;

/** One storage area a column reads, and how its header names it. */
type StorageArea = {
  /**
   * Reads the area, which may throw or be missing.
   *
   * @example `() => window.localStorage`
   */
  read: () => unknown;

  /**
   * The area's global, as the header spells it.
   *
   * @example "localStorage"
   */
  receiver: StorageReceiver;

  /**
   * What sets this column apart, appended to its header.
   *
   * @example " (opaque origin)"
   */
  suffix: string;
};

/** The storage wrappers' case-file functions, each with its probes. */
type StorageProbes = Record<
  "safeStorageGetItem" | "safeStorageRemoveItem" | "safeStorageSetItem",
  readonly Probe[]
>;

/** The storage areas the wrappers reach, by the global's name. */
type StorageReceiver = "localStorage" | "sessionStorage";

/**
 * What each key holds before a `safeStorageGetJson` case, as stored text: valid
 * JSON of every kind, then text a writer could leave that isn't JSON.
 */
const JSON_SEEDS: ReadonlyMap<string, string> = new Map([
  ["array", "[1,2]"],
  ["bare", "hi"],
  ["broken", "{"],
  ["empty", ""],
  ["null", "null"],
  ["number", "42"],
  ["object", '{"a":1}'],
  ["objectString", "[object Object]"],
  ["spaced", " 42 "],
  ["string", '"hi"'],
  ["undefined", "undefined"],
]);

/** The key every case's storage holds before the call. */
const SEEDED_KEY = "present";

/**
 * Empty an area before a write case; an area that can't be reached is left
 * for the call under test to fail on.
 */
export function clearArea(read: StorageArea["read"]): void {
  try {
    (read() as Storage).clear();
  } catch {
    // Unreachable storage; the probe's own call reports it.
  }
}

/**
 * Probes for the JSON storage helpers' native composition on one area.
 *
 * - A read case starts from `JSON_SEEDS`, so each key names the text the
 *   caller's `getItem` returns; a write case starts from an empty area.
 *
 * - A write is read back with `getItem`, so the cell shows the stored text,
 *   or `null` where nothing was written.
 *
 * @returns the probes, keyed by case-file function name.
 */
export function jsonStorageProbes({
  read,
  receiver,
  suffix,
}: StorageArea): JsonStorageProbes {
  return {
    safeStorageGetJson: [
      {
        accepts: (args) => args.length === 1,
        call: `JSON.parse(${receiver}.getItem(key))${suffix}`,
        run: ([key]) => {
          seedJson(read);

          // `JSON.parse` reads its argument with `String()`, so a missing
          // key's `null` parses as the text "null", exactly as natively.
          return callJsonParse(
            String((read() as Storage).getItem(key as string))
          );
        },
      },
    ],
    safeStorageSetJson: [
      {
        accepts: (args) => args.length === 2,
        call: `${receiver}.setItem(key, JSON.stringify(value)); ${receiver}.getItem(key)${suffix}`,
        run: ([key, value]) => {
          clearArea(read);
          const storage = read() as Storage;
          storage.setItem(key as string, JSON.stringify(value));

          return storage.getItem(key as string);
        },
      },
    ],
  };
}

/**
 * Reset an area to hold exactly `JSON_SEEDS`; an area that can't be reached
 * is left for the call under test to fail on.
 */
export function seedJson(read: StorageArea["read"]): void {
  try {
    const storage = read() as Storage;
    storage.clear();

    for (const [key, text] of JSON_SEEDS) {
      storage.setItem(key, text);
    }
  } catch {
    // Unreachable storage; the probe's own call reports it.
  }
}

/**
 * Probes for the storage wrappers' native calls on one storage area.
 *
 * - Before every case, the area is cleared and holds only `present` →
 *   `"value"`, so each case starts from the same state.
 *
 * - A write or a removal is read back with `getItem`, so the cell shows what
 *   the area holds afterward, coercion included, rather than `undefined`.
 *
 * @returns the probes, keyed by case-file function name.
 */
export function storageProbes({
  read,
  receiver,
  suffix,
}: StorageArea): StorageProbes {
  const area = (): Storage => {
    seed(read);

    return read() as Storage;
  };

  return {
    safeStorageGetItem: [
      {
        call: `${receiver}.getItem(key)${suffix}`,
        run: ([key]) => area().getItem(key as string),
      },
    ],
    safeStorageRemoveItem: [
      {
        call: `${receiver}.removeItem(key); ${receiver}.getItem(key)${suffix}`,
        run: ([key]) => {
          const storage = area();
          storage.removeItem(key as string);

          return storage.getItem(key as string);
        },
      },
    ],
    safeStorageSetItem: [
      {
        call: `${receiver}.setItem(key, value); ${receiver}.getItem(key)${suffix}`,
        run: ([key, value]) => {
          const storage = area();
          storage.setItem(key as string, value as string);

          return storage.getItem(key as string);
        },
      },
    ],
  };
}

/**
 * Reset an area to hold only the seeded key.
 *
 * - An area that can't be reached is left alone: the call under test then
 *   meets the same failure, and that is the outcome to record.
 */
function seed(read: StorageArea["read"]): void {
  try {
    const storage = read() as Storage;
    storage.clear();
    storage.setItem(SEEDED_KEY, "value");
  } catch {
    // Unreachable storage; the probe's own call reports it.
  }
}
