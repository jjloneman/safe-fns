import type { Probe } from "./tool.mts";

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

/** The key every case's storage holds before the call. */
const SEEDED_KEY = "present";

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
