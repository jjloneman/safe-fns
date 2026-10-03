<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/jjloneman/safe-fns/main/assets/logo-wordmark-dark.svg">
    <img src="https://raw.githubusercontent.com/jjloneman/safe-fns/main/assets/logo-wordmark-light.svg" alt="safe-fns" width="377" height="64">
  </picture>
</h1>

Zero-dependency, strongly typed helpers that never throw — bad input returns a fallback you choose, or a documented neutral result. (Not to be confused with [`safe-fn`](https://www.npmjs.com/package/safe-fn), an unrelated server-action builder.)

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
  - [🫙 Is it empty?](#-is-it-empty)
  - [🧱 Is it a plain object?](#-is-it-a-plain-object)
  - [🔢 Parse a number](#-parse-a-number)
  - [🔤 Turn a value into a string](#-turn-a-value-into-a-string)
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

- **The popular libraries disagree on the basics**, and each has a sharp edge.
- **The built-in coercers throw or return junk** on real input.
- **safe-fns gives one documented definition per check**, and every export is total:
  - it never throws, even on getters, proxies, or `toString` traps;
  - bad input returns the fallback you pass in;
  - it returns the same result in Node, every browser, and any other JS runtime.

The tables below show where today's options disagree. ✅ is `true`, ❌ is `false`, and 💥 means the call throws.

### 🫙 Is it empty?

| Value                      | lodash [`isEmpty`][lodash-isEmpty] | ramda [`isEmpty`][ramda-isEmpty] | remeda [`isEmptyish`][remeda-isEmptyish] | safe-fns `isSafeEmpty` (planned) |
| -------------------------- | :--------------------------------: | :------------------------------: | :--------------------------------------: | :------------------------------: |
| `0`                        |                 ✅                 |                ❌                |                    ❌                    |                ❌                |
| `false`                    |                 ✅                 |                ❌                |                    ❌                    |                ❌                |
| `NaN`                      |                 ✅                 |                ❌                |                    ❌                    |                ❌                |
| `null`                     |                 ✅                 |                ❌                |                    ✅                    |                —                 |
| `''`                       |                 ✅                 |                ✅                |                    ✅                    |                ✅                |
| `'   '`                    |                 ❌                 |                ❌                |                    ❌                    |                ✅                |
| `{}`                       |                 ✅                 |                ✅                |                    ✅                    |                ✅                |
| `{ length: 0, name: 'x' }` |                 ❌                 |                ❌                |                    ✅                    |                ❌                |
| `new Map()`                |                 ✅                 |                ✅                |                    ✅                    |                ✅                |
| `new Date()`               |                 ✅                 |                ❌                |                    ✅                    |                ❌                |

- — marks a case the planned semantics haven't settled yet.
- es-toolkit's [`compat/isEmpty`][es-toolkit-compat-isEmpty] matches lodash on every row.

### 🧱 Is it a plain object?

| Value                           | lodash [`isPlainObject`][lodash-isPlainObject] | remeda [`isPlainObject`][remeda-isPlainObject] | es-toolkit [`isPlainObject`][es-toolkit-isPlainObject] |
| ------------------------------- | :--------------------------------------------: | :--------------------------------------------: | :----------------------------------------------------: |
| `{}`                            |                       ✅                       |                       ✅                       |                           ✅                           |
| `Object.create(null)`           |                       ✅                       |                       ✅                       |                           ✅                           |
| `new (class Foo {})()`          |                       ❌                       |                       ❌                       |                           ❌                           |
| `Math`                          |                       ❌                       |                       ✅                       |                           ❌                           |
| `{ [Symbol.toStringTag]: 'X' }` |                       ✅                       |                       ✅                       |                           ❌                           |

### 🔢 Parse a number

| Value                 | [`Number()`][mdn-Number] | [`parseFloat()`][mdn-parseFloat] | lodash [`toNumber`][lodash-toNumber] | lodash [`toFinite`][lodash-toFinite] |
| --------------------- | :----------------------: | :------------------------------: | :----------------------------------: | :----------------------------------: |
| `''`                  |           `0`            |              `NaN`               |                 `0`                  |                 `0`                  |
| `'   '`               |           `0`            |              `NaN`               |                 `0`                  |                 `0`                  |
| `null`                |           `0`            |              `NaN`               |                 `0`                  |                 `0`                  |
| `true`                |           `1`            |              `NaN`               |                 `1`                  |                 `1`                  |
| `[5]`                 |           `5`            |               `5`                |                 `5`                  |                 `5`                  |
| `'12px'`              |          `NaN`           |               `12`               |                `NaN`                 |                 `0`                  |
| `'0x1f'`              |           `31`           |               `0`                |                 `31`                 |                 `31`                 |
| `Symbol()`            |            💥            |                💥                |                `NaN`                 |                 `0`                  |
| `Object.create(null)` |            💥            |                💥                |                  💥                  |                  💥                  |

- es-toolkit's [`compat/toNumber`][es-toolkit-compat-toNumber] matches lodash's `toNumber` on every row.

### 🔤 Turn a value into a string

| Value                 | [`String()`][mdn-String] | lodash [`toString`][lodash-toString] |
| --------------------- | :----------------------: | :----------------------------------: |
| `null`                |         `'null'`         |                 `''`                 |
| `undefined`           |      `'undefined'`       |                 `''`                 |
| `-0`                  |          `'0'`           |                `'-0'`                |
| `{}`                  |   `'[object Object]'`    |         `'[object Object]'`          |
| `[1, [2, 3]]`         |        `'1,2,3'`         |              `'1,2,3'`               |
| `Object.create(null)` |            💥            |                  💥                  |

- es-toolkit's [`compat/toString`][es-toolkit-compat-toString] matches lodash's `toString` on every row.

<sub>Measured with lodash 4.18.1, ramda 0.32.0, remeda 2.50.0, es-toolkit 1.52.0, and Node 26.</sub>

[es-toolkit-compat-isEmpty]: https://es-toolkit.dev/reference/compat/predicate/isEmpty.html
[es-toolkit-compat-toNumber]: https://es-toolkit.dev/reference/compat/util/toNumber.html
[es-toolkit-compat-toString]: https://es-toolkit.dev/reference/compat/util/toString.html
[es-toolkit-isPlainObject]: https://es-toolkit.dev/reference/predicate/isPlainObject.html
[lodash-isEmpty]: https://lodash.com/docs/#isEmpty
[lodash-isPlainObject]: https://lodash.com/docs/#isPlainObject
[lodash-toFinite]: https://lodash.com/docs/#toFinite
[lodash-toNumber]: https://lodash.com/docs/#toNumber
[lodash-toString]: https://lodash.com/docs/#toString
[mdn-Number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number
[mdn-parseFloat]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat
[mdn-String]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String
[ramda-isEmpty]: https://ramdajs.com/docs/#isEmpty
[remeda-isEmptyish]: https://remedajs.com/docs/#isEmptyish
[remeda-isPlainObject]: https://remedajs.com/docs/#isPlainObject

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

| Family  | Functions                                                                                     |
| :------ | :-------------------------------------------------------------------------------------------- |
| Guards  | `isSafeEmpty`, `isSafePopulated`, `isPlainObject`                                             |
| Parsers | `safeParseBoolean`, `safeParseNumber`, `safeParseInteger`, `safeParseString`, `safeJsonParse` |
| Errors  | `getErrorMessage`, `toError`                                                                  |
| Sort    | `deepSortObject`                                                                              |

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
| `value.trim() !== ""` on a string                           | `isSafePopulated(value)`                     |
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
| `pnpm okf:verify`    | Interactively signs off decision records and commits them            |

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
