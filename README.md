# 🛟 safe-fns

Zero-dependency, strongly typed helpers that take an `unknown` value and never throw — bad input returns a fallback you choose. (Not to be confused with [`safe-fn`](https://www.npmjs.com/package/safe-fn), an unrelated server-action builder.)

[![npm version](https://img.shields.io/npm/v/safe-fns)](https://www.npmjs.com/package/safe-fns)
[![npm downloads](https://img.shields.io/npm/dw/safe-fns)](https://www.npmjs.com/package/safe-fns)
[![CI](https://img.shields.io/github/actions/workflow/status/jjloneman/safe-fns/ci.yml?branch=main&label=CI)](https://github.com/jjloneman/safe-fns/actions/workflows/ci.yml)
[![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](#-contributing)
[![bundle size](https://img.shields.io/bundlephobia/minzip/safe-fns)](https://bundlephobia.com/package/safe-fns)
[![types](https://img.shields.io/npm/types/safe-fns)](https://www.npmjs.com/package/safe-fns)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](package.json)
[![node](https://img.shields.io/node/v/safe-fns)](https://www.npmjs.com/package/safe-fns)
[![license](https://img.shields.io/github/license/jjloneman/safe-fns)](LICENSE)

> [!NOTE]
> 🚧 **Pre-release.** The package isn't on npm yet, and the function catalog is still being designed. The names below may change before `0.1.0`.

---

## 📚 Table of Contents

- [📚 Table of Contents](#-table-of-contents)
- [🤔 Why](#-why)
- [📦 Install](#-install)
- [🚀 Usage](#-usage)
- [📖 API](#-api)
- [🎯 Support matrix](#-support-matrix)
- [🔄 Migrating from copy-pasted helpers](#-migrating-from-copy-pasted-helpers)
- [📋 Scripts](#-scripts)
- [🤝 Contributing](#-contributing)
  - [🏷️ Labels](#️-labels)
- [📄 License](#-license)

---

## 🤔 Why

- **Popular "is empty" checks disagree, and each has a sharp edge.**
  - lodash calls `0`, `false`, and `NaN` empty.
  - None of them trim, so `'   '` counts as populated.
  - remeda duck-types anything with a `length`, so `{ length: 0, name: 'x' }` counts as empty.
- **The built-in coercers throw or return junk on real input.**
  - `String(Object.create(null))` and `Number(Symbol())` throw.
  - `String({})` is `'[object Object]'`, and `Number([5])` is `5`.
- **safe-fns gives one documented definition per check**, and every export is total:
  - it never throws, even on getters, proxies, or `toString` traps;
  - bad input returns the fallback you pass in;
  - it returns the same result in Node, every browser, and any other JS runtime.

Is the value empty?

| Value                      | lodash `isEmpty` | ramda `isEmpty` | remeda `isEmptyish` | safe-fns `isSafeEmpty` (planned) |
| -------------------------- | :--------------: | :-------------: | :-----------------: | :------------------------------: |
| `0`                        |        ✅        |       ❌        |         ❌          |                ❌                |
| `false`                    |        ✅        |       ❌        |         ❌          |                ❌                |
| `NaN`                      |        ✅        |       ❌        |         ❌          |                ❌                |
| `''`                       |        ✅        |       ✅        |         ✅          |                ✅                |
| `'   '`                    |        ❌        |       ❌        |         ❌          |                ✅                |
| `{}`                       |        ✅        |       ✅        |         ✅          |                ✅                |
| `{ length: 0, name: 'x' }` |        ❌        |       ❌        |         ✅          |                ❌                |
| `new Map()`                |        ✅        |       ✅        |         ✅          |                ✅                |

<sub>Measured with lodash 4.18.1, ramda 0.32.0, and remeda 2.50.0.</sub>

---

## 📦 Install

```sh
pnpm add safe-fns
# or
npm install safe-fns
```

---

## 🚀 Usage

Every function is available from the root, or from its own subpath:

```ts
// From the root
import { isSafeEmpty } from "safe-fns";

// From a subpath, which loads only that one function
import { isSafeEmpty } from "safe-fns/is-safe-empty";
```

- Both styles ship ESM and CommonJS, with types for each.
- The package is `sideEffects: false`, so a bundler tree-shakes the root import just as well.

---

## 📖 API

_No functions have shipped yet._ The planned families are:

| Family  | Functions                                                                                                      |
| :------ | :------------------------------------------------------------------------------------------------------------- |
| Guards  | `isSafeEmpty`, `isSafePopulated`, `isNonBlankString`, `isNonEmptyArray`, `isPlainObject`                       |
| Parsers | `safeParseBoolean`, `safeParseNumber`, `safeParseInteger`, `safeParseString`, `safeParseJson`, `safeParseDate` |
| Errors  | `getErrorMessage`, `toError`                                                                                   |
| Sort    | `deepSortObject`                                                                                               |

Parsers share one shape:

```ts
safeParseNumber(value: unknown, options?: { fallback?: F }): number | F
```

---

## 🎯 Support matrix

- **Runtime**: Node 22 or newer (`engines.node`), and every modern browser.
  - CI tests Node 22, 24, and 26.
  - Output targets ES2022.
- **Consumer TypeScript**: 4.9 or newer.

  | TypeScript    | `node10` | `node16` (CJS + ESM) | `bundler` |
  | ------------- | :------: | :------------------: | :-------: |
  | 4.9           |    ✅    |          ✅          |     —     |
  | 5.0, 5.4, 5.9 |    ✅    |          ✅          |    ✅     |
  | 6.0           |    ✅    |          ✅          |    ✅     |
  | 7.0           |    —     |          ✅          |    ✅     |

- **Engine-defined behavior** is documented per function rather than papered over.
  - This covers things like non-ISO date parsing and ICU-dependent string comparison.

---

## 🔄 Migrating from copy-pasted helpers

safe-fns replaces helpers that were copy-pasted between projects and had drifted apart. Once the functions ship, the usual swaps are:

| Copy-pasted pattern                                         | safe-fns                                     |
| :---------------------------------------------------------- | :------------------------------------------- |
| `error instanceof Error ? error.message : String(error)`    | `getErrorMessage(error)`                     |
| `typeof value === "string" && value.trim() !== ""`          | `isNonBlankString(value)`                    |
| Hand-rolled number parsing that returns `null` on bad input | `safeParseNumber(value, { fallback: null })` |
| A local `sortKeysRecursively`                               | `deepSortObject(value)`                      |

- Check each old helper's edge cases against the new function's docs before you swap.
  - Copies that drifted may disagree on details such as case-sensitive key sorting.

---

## 📋 Scripts

| Script               | What it does                                                         |
| :------------------- | :------------------------------------------------------------------- |
| `pnpm build`         | Builds ESM and CJS output, with types, into `dist/`                  |
| `pnpm check`         | Fixes lint, formats, then typechecks — run it before committing      |
| `pnpm lint`          | ESLint, read-only                                                    |
| `pnpm format:check`  | Prettier, read-only                                                  |
| `pnpm typecheck`     | `tsc` over the whole project                                         |
| `pnpm test`          | Runs the suite once, in the `node` and `jsdom` projects              |
| `pnpm test:watch`    | Reruns the suite on change                                           |
| `pnpm test:coverage` | Runs the suite and fails below 100% coverage                         |
| `pnpm lint:package`  | Builds, then checks the package with publint and Are the Types Wrong |
| `pnpm size`          | Builds, then checks every entry against its size budget              |
| `pnpm test:consumer` | Packs the tarball and typechecks and loads it as a consumer would    |

---

## 🤝 Contributing

- See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev loop and how to add a function.
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security issues privately, as described in [SECURITY.md](SECURITY.md).

### 🏷️ Labels

Every issue gets a type label (`✨ feature`, `🐞 bug`, `📝 documentation`, …) and, where one fits, an area label:

| Label              | Covers                                                        |
| :----------------- | :------------------------------------------------------------ |
| `area: 🛡️ guards`  | Type guards and emptiness checks (`isSafeEmpty`, …)           |
| `area: 🔍 parse`   | Parsers that turn `unknown` into a typed value (`safeParse*`) |
| `area: 🚨 errors`  | Error helpers (`getErrorMessage`, `toError`)                  |
| `area: 🔀 sort`    | Sorting helpers (`deepSortObject`)                            |
| `area: 📝 docs`    | The README, community files, and the docs site                |
| `area: 🛠️ tooling` | Build, lint, test, CI, and release tooling                    |

New issues start as `📥 needs-triage` until the maintainer has looked at them.

---

## 📄 License

[MIT](LICENSE) © JJ Loneman
