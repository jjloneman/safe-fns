import store from "store2";

import type { Tool } from "./tool.mts";

import { packageVersion } from "./tool.mts";
import { clearArea, seedJson } from "./web-storage.mts";

/** Node's `sessionStorage`, the area store2's `store.session` wraps. */
function readSessionStorage(): Storage {
  return globalThis.sessionStorage;
}

/**
 * store2, a JSON layer over Web Storage, run on its `session` area; a read
 * starts from the same seeds as the native column, and a write is read back
 * with `sessionStorage.getItem`.
 */
export const STORE2: Tool = {
  functions: {
    safeStorageGetJson: [
      {
        accepts: (args) => args.length === 1,
        call: "store.session.get(key)",
        run: ([key]) => {
          seedJson(readSessionStorage);

          return store.session.get(key) as unknown;
        },
      },
    ],
    safeStorageSetJson: [
      {
        accepts: (args) => args.length === 2,
        call: "store.session.set(key, value); sessionStorage.getItem(key)",
        run: ([key, value]) => {
          clearArea(readSessionStorage);
          store.session.set(key, value);

          return sessionStorage.getItem(key as string);
        },
      },
    ],
  },
  name: "store2",
  tier: 1,
  version: packageVersion("store2"),
};
