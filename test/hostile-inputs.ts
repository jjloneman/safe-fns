/** A value built to throw when a helper inspects it without guarding. */
export type HostileInput = {
  /** Names the test, so a failing case never prints the value itself. */
  description: string;

  /** The value to pass to the function under test. */
  value: unknown;
};

const throwTrap = (): never => {
  throw new Error("hostile input trap");
};

const { proxy: revokedProxy, revoke } = Proxy.revocable({}, {});
revoke();

/**
 * Values that trap on inspection, for asserting an export never throws.
 *
 * - Pass each through the function under test and assert on its return value;
 *   never hand the value itself to `expect`, whose diffing and printing would
 *   trip the same traps.
 *
 * - Environment-neutral, so it runs in every test project; cross-realm values
 *   live in `cross-realm-inputs.ts` because they need `node:vm`.
 */
export const hostileInputs: readonly HostileInput[] = [
  {
    description: "a null-prototype object",
    value: Object.create(null),
  },
  {
    description: "a proxy whose get trap throws",
    value: new Proxy({}, { get: throwTrap }),
  },
  {
    description: "a proxy whose has trap throws",
    value: new Proxy({}, { has: throwTrap }),
  },
  {
    description: "a proxy whose ownKeys trap throws",
    value: new Proxy({}, { ownKeys: throwTrap }),
  },
  {
    description: "a revoked proxy",
    value: revokedProxy,
  },
  {
    description: "a symbol",
    value: Symbol("hostile"),
  },
  {
    description: "an object with a throwing getter",
    value: {
      get trap(): never {
        return throwTrap();
      },
    },
  },
  {
    description: "an object with a throwing Symbol.toPrimitive",
    value: { [Symbol.toPrimitive]: throwTrap },
  },
  {
    description: "an object with a throwing toString",
    value: { toString: throwTrap },
  },
  {
    description: "an object with a throwing valueOf",
    value: { valueOf: throwTrap },
  },
];
