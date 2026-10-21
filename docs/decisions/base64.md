---
type: Decision
title: How decodeBase64 and encodeBase64 read and write Base64
description: UTF-8 text and bytes, not atob's Latin-1 strings, by the grammar `atob` and `Uint8Array.fromBase64` share, built on `atob` / `btoa` with portable UTF-8 and no feature check; `decodeBase64ToBytes` returns bytes, `urlSafe` picks base64url, and bad input, invalid UTF-8, and lone surrogates return the fallback unless `replaceInvalidWith` is set.
status: stable
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-21T04:44:23Z }
verified: { by: human:jjloneman, at: 2026-10-21T15:51:53Z }
---

# How decodeBase64 and encodeBase64 read and write Base64

Base64 for the text and bytes JavaScript actually holds, the same on every runtime, never throwing.

## Decision

- **Signatures:**

  ```ts
  decodeBase64(value: unknown, options?: { fallback?: F; replaceInvalidWith?: string; urlSafe?: boolean }): string | F
  decodeBase64ToBytes(value: unknown, options?: { fallback?: F; urlSafe?: boolean }): Uint8Array | F
  encodeBase64(value: unknown, options?: { fallback?: F; omitPadding?: boolean; replaceInvalidWith?: string; urlSafe?: boolean }): string | F
  ```

- **Names** are plain, per [When a name starts with `safe`](safe-prefix-naming.md): no one native call does this, since `atob` and `btoa` handle Latin-1 rather than UTF-8, and `Uint8Array.fromBase64` handles bytes rather than text.
  - Decoding to text and decoding to bytes are two functions, because an option that switched the return type between `string` and `Uint8Array` would be easy to mistype, as with `safeParseInt` and `safeParseBigInt`.
- **Text is UTF-8 both ways:** `decodeBase64("4oKs")` is `"€"`, where `atob` returns the Latin-1 bytes `"â\u{82}¬"`, and `encodeBase64("€")` is `"4oKs"`, where `btoa` throws.
- **Decoding follows the "forgiving-base64" grammar of `atob`, which is also the default ("loose") grammar of `Uint8Array.fromBase64`,** so moving to the native method later would change no result:
  - ASCII whitespace (space, tab, line feed, form feed, carriage return) is skipped anywhere, so MIME-wrapped text (`"aGVs\r\nbG8="`) decodes; other whitespace (`"\u{A0}"`) returns the fallback;
  - padding may be left off (`"aGVsbG8"` → `"hello"`), but padding that's present must be complete and last: `"aGVsbA="`, `"aGVsbG8=="`, `"="`, and `"aGVsbG8=aGVsbG8="` return the fallback;
  - leftover bits in the last character are ignored (`"aGVsbG9="` → `"hello"`), as `fromBase64` ignores them by default;
  - any other character, or a length that leaves one dangling character (`"a"`), returns the fallback;
  - `""` decodes to `""`: it's valid Base64 for no bytes, not a blank to reject.
- **`urlSafe: true` switches from the standard alphabet (RFC 4648 §4) to the URL- and filename-safe one (§5),** which spells the 63rd and 64th characters `-` and `_` instead of `+` and `/`, since `/` separates URL paths and `+` means a space in a query string; JWTs and URL tokens use it.
  - Each alphabet rejects the other's characters: `"PDw_Pz4-"` returns the fallback by default and decodes to `"<<??>>"` with `urlSafe: true`.
- **`decodeBase64` returns the fallback when the bytes aren't UTF-8** (`"/w=="` is the lone byte 0xFF), unless `replaceInvalidWith` is set, which replaces each invalid sequence as [`safeDecodeUriComponent`](safe-decode-uri-component.md) does.
  - `decodeBase64ToBytes` has no such failure, since every byte sequence is valid bytes.
- **`encodeBase64` takes text or bytes:**
  - a string is encoded as UTF-8; a lone surrogate returns the fallback, unless `replaceInvalidWith` is set, which replaces it before encoding, as `toWellFormed` does;
  - a `Uint8Array`, an `ArrayBuffer`, or any other `ArrayBuffer` view encodes the bytes it holds or views;
  - `omitPadding: true` drops the trailing `=`, which only rounds the length up to a multiple of four (`"hell"` → `"aGVsbA"` rather than `"aGVsbA=="`), as `toBase64`'s option of the same name does.
- **Anything else returns the fallback:** a boxed string is unwrapped by brand check, but numbers, booleans, `null`, arrays, and objects aren't text or bytes, where `btoa(42)` is `"NDI="` and `btoa(null)` is `"bnVsbA=="`.
- **The Base64 layer is `atob` and `btoa`; the UTF-8 layer is portable JavaScript.** There is one code path, with no feature check.
  - `atob` and `btoa` exist on every runtime the package supports (Node 16 and later, every browser, Deno, Bun, and Hermes), so calling them is no environment probe; their Latin-1 strings stay internal, one character per byte.
  - `urlSafe` and `omitPadding` are string steps around them: decoding rejects `+` and `/` and maps `-` and `_` to them first, and encoding maps the other way and strips `=` after.
  - `Uint8Array.fromBase64`, `toBase64`, `TextEncoder`, `TextDecoder`, and `Buffer` aren't used: checking whether they exist would be an environment probe, which [What every export promises](package-promise.md) rules out.
  - `fromBase64` and `toBase64` exist in Node 25 and later, Chrome 140, Firefox 133, Safari 18.2, and Deno 2.5, but not in Node 22 (the `engines` floor) or Node 24, and Hermes 0.13 (React Native's engine) has neither them nor `TextDecoder`, measured on 2026-10-21.

## Comparison

### `decodeBase64`

The tiers 0–2 summary from [research/results/decode-base64.md](../../research/results/decode-base64.md), generated by `pnpm research`; the full table there adds PHP. Every tool is called with the value alone, so neither table shows an option.

- A tool that returns bytes is shown decoding them as UTF-8, with the call text saying how; `atob` returns its Latin-1 string as-is.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`decodeBase64` | Hermes<br>`atob(value)` | JS built-ins<br>`atob(value)` | JS built-ins<br>`Buffer.from(value, "base64").toString("utf8")` | JS built-ins<br>`new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.fromBase64(value, { alphabet: "base64url" }))` | JS built-ins<br>`new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.fromBase64(value))` | js-base64<br>`Base64.decode(value)` | .NET<br>`Encoding.UTF8.GetString(Convert.FromBase64String(value))` | .NET<br>`new UTF8Encoding(false, true).GetString(Convert.FromBase64String(value))` | Go<br>`base64.RawStdEncoding.DecodeString(value)` | Go<br>`base64.StdEncoding.DecodeString(value)` | Go<br>`base64.URLEncoding.DecodeString(value)` | Java<br>`new String(Base64.getDecoder().decode(value), UTF_8)` | Java<br>`new String(Base64.getMimeDecoder().decode(value), UTF_8)` | Java<br>`new String(Base64.getUrlDecoder().decode(value), UTF_8)` | Python<br>`b64decode(value, validate=True).decode()` | Python<br>`b64decode(value).decode()` | Python<br>`urlsafe_b64decode(value).decode()` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"aGVsbG8="` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | 💥 `base64.CorruptInputError` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` |
| `"aGVsbG8"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | 💥 `FormatException` | 💥 `FormatException` | `"hello"` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | `"hello"` | `"hello"` | `"hello"` | 💥 `Error` | 💥 `Error` | 💥 `Error` |
| `"aGVsbA=="` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | 💥 `base64.CorruptInputError` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` |
| `"aGVsbA"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | `"hell"` | 💥 `FormatException` | 💥 `FormatException` | `"hell"` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | `"hell"` | `"hell"` | `"hell"` | 💥 `Error` | 💥 `Error` | 💥 `Error` |
| `"aGVsbA="` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `"hell"` | 💥 `SyntaxError` | 💥 `SyntaxError` | `"hell"` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `Error` | 💥 `Error` | 💥 `Error` |
| `"4oKs"` | `"€"` | `"â\u{82}¬"` | `"â\u{82}¬"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` | `"€"` |
| `"8J+YgA=="` | `"😀"` | `"ð\u{9F}\u{98}\u{80}"` | `"ð\u{9F}\u{98}\u{80}"` | `"😀"` | 💥 `SyntaxError` | `"😀"` | `"😀"` | `"😀"` | `"😀"` | 💥 `base64.CorruptInputError` | `"😀"` | 💥 `base64.CorruptInputError` | `"😀"` | `"😀"` | 💥 `IllegalArgumentException` | `"😀"` | `"😀"` | `"😀"` |
| `"w78="` | `"ÿ"` | `"Ã¿"` | `"Ã¿"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | 💥 `base64.CorruptInputError` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` | `"ÿ"` |
| `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` |
| `" aGVs bG8= "` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | `"hello"` | 💥 `IllegalArgumentException` | 💥 `Error` | `"hello"` | `"hello"` |
| `"aGVs\u{A}bG8="` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | 💥 `base64.CorruptInputError` | `"hello"` | `"hello"` | 💥 `IllegalArgumentException` | `"hello"` | 💥 `IllegalArgumentException` | 💥 `Error` | `"hello"` | `"hello"` |
| `"aGVs\u{D}\u{A}bG8="` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | 💥 `base64.CorruptInputError` | `"hello"` | `"hello"` | 💥 `IllegalArgumentException` | `"hello"` | 💥 `IllegalArgumentException` | 💥 `Error` | `"hello"` | `"hello"` |
| `"aGVs\u{A0}bG8="` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `"hello"` | 💥 `SyntaxError` | 💥 `SyntaxError` | `"hello"` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | `"hello"` | 💥 `IllegalArgumentException` | 💥 `ValueError` | 💥 `ValueError` | 💥 `ValueError` |
| `"aGVsbG9="` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | 💥 `base64.CorruptInputError` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` |
| `"PDw/Pz4+"` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` | 💥 `SyntaxError` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` | 💥 `base64.CorruptInputError` | `"<<??>>"` | `"<<??>>"` | 💥 `IllegalArgumentException` | `"<<??>>"` | `"<<??>>"` | `"<<??>>"` |
| `"PDw_Pz4-"` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `"<<??>>"` | `"<<??>>"` | 💥 `SyntaxError` | `"<<??>>"` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | `"<<??>>"` | 💥 `IllegalArgumentException` | `"<<\u{F}�"` | `"<<??>>"` | 💥 `Error` | 💥 `Error` | `"<<??>>"` |
| `"not base64!"` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `"��[jǺ"` | 💥 `SyntaxError` | 💥 `SyntaxError` | 💥 `SyntaxError` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `Error` | 💥 `Error` | 💥 `Error` |
| `"aGVsbG8=aGVsbG8="` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `"hello"` | 💥 `SyntaxError` | 💥 `SyntaxError` | `"hello\u{1A}\u{19}[\u{1B}\u{1B}"` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `Error` | 💥 `Error` | 💥 `Error` |
| `"a"` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `""` | 💥 `SyntaxError` | 💥 `SyntaxError` | 💥 `SyntaxError` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `Error` | 💥 `Error` | 💥 `Error` |
| `"aGVsbG8=="` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `"hello"` | 💥 `SyntaxError` | 💥 `SyntaxError` | `"hello"` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | `"hello"` | 💥 `IllegalArgumentException` | 💥 `Error` | `"hello"` | `"hello"` |
| `"="` | `undefined` | 💥 `Error` | 💥 `InvalidCharacterError` | `""` | 💥 `SyntaxError` | 💥 `SyntaxError` | `""` | 💥 `FormatException` | 💥 `FormatException` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `base64.CorruptInputError` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `IllegalArgumentException` | 💥 `Error` | `""` | `""` |
| `"/w=="` | `undefined` | `"ÿ"` | `"ÿ"` | `"�"` | 💥 `SyntaxError` | 💥 `TypeError` | `"�"` | `"�"` | 💥 `DecoderFallbackException` | 💥 `base64.CorruptInputError` | `‹main.invalidUTF8›` | 💥 `base64.CorruptInputError` | `"�"` | `"�"` | 💥 `IllegalArgumentException` | 💥 `UnicodeDecodeError` | 💥 `UnicodeDecodeError` | 💥 `UnicodeDecodeError` |
| `"wA=="` | `undefined` | `"À"` | `"À"` | `"�"` | 💥 `TypeError` | 💥 `TypeError` | `"�"` | `"�"` | 💥 `DecoderFallbackException` | 💥 `base64.CorruptInputError` | `‹main.invalidUTF8›` | `‹main.invalidUTF8›` | `"�"` | `"�"` | `"�"` | 💥 `UnicodeDecodeError` | 💥 `UnicodeDecodeError` | 💥 `UnicodeDecodeError` |
| `"7aCA"` | `undefined` | `"í\u{A0}\u{80}"` | `"í\u{A0}\u{80}"` | `"���"` | 💥 `TypeError` | 💥 `TypeError` | `"���"` | `"���"` | 💥 `DecoderFallbackException` | `‹main.invalidUTF8›` | `‹main.invalidUTF8›` | `‹main.invalidUTF8›` | `"�"` | `"�"` | `"�"` | 💥 `UnicodeDecodeError` | 💥 `UnicodeDecodeError` | 💥 `UnicodeDecodeError` |
| `42` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `true` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `null` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `undefined` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
| `["aGk="]` | `undefined` | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

### `encodeBase64`

The tiers 0–2 summary from [research/results/encode-base64.md](../../research/results/encode-base64.md), generated by `pnpm research`; the full table there adds PHP.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`encodeBase64` | Hermes<br>`btoa(value)` | JS built-ins<br>`btoa(value)` | JS built-ins<br>`Buffer.from(value).toString("base64")` | JS built-ins<br>`new TextEncoder().encode(value).toBase64()` | JS built-ins<br>`value.toBase64()` | js-base64<br>`Base64.encode(value)` | js-base64<br>`Base64.fromUint8Array(value)` | .NET<br>`Convert.ToBase64String(Encoding.UTF8.GetBytes(value))` | Go<br>`base64.StdEncoding.EncodeToString([]byte(value))` | Java<br>`Base64.getEncoder().encodeToString(value.getBytes(UTF_8))` | Python<br>`b64encode(value.encode()).decode()` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"hello"` | `"aGVsbG8="` | `"aGVsbG8="` | `"aGVsbG8="` | `"aGVsbG8="` | `"aGVsbG8="` | — | `"aGVsbG8="` | — | `"aGVsbG8="` | `"aGVsbG8="` | `"aGVsbG8="` | `"aGVsbG8="` |
| `"hell"` | `"aGVsbA=="` | `"aGVsbA=="` | `"aGVsbA=="` | `"aGVsbA=="` | `"aGVsbA=="` | — | `"aGVsbA=="` | — | `"aGVsbA=="` | `"aGVsbA=="` | `"aGVsbA=="` | `"aGVsbA=="` |
| `"€"` | `"4oKs"` | 💥 `Error` | 💥 `InvalidCharacterError` | `"4oKs"` | `"4oKs"` | — | `"4oKs"` | — | `"4oKs"` | `"4oKs"` | `"4oKs"` | `"4oKs"` |
| `"😀"` | `"8J+YgA=="` | 💥 `Error` | 💥 `InvalidCharacterError` | `"8J+YgA=="` | `"8J+YgA=="` | — | `"8J+YgA=="` | — | `"8J+YgA=="` | `"8J+YgA=="` | `"8J+YgA=="` | `"8J+YgA=="` |
| `"ÿ"` | `"w78="` | `"/w=="` | `"/w=="` | `"w78="` | `"w78="` | — | `"w78="` | — | `"w78="` | `"w78="` | `"w78="` | `"w78="` |
| `"<<??>>"` | `"PDw/Pz4+"` | `"PDw/Pz4+"` | `"PDw/Pz4+"` | `"PDw/Pz4+"` | `"PDw/Pz4+"` | — | `"PDw/Pz4+"` | — | `"PDw/Pz4+"` | `"PDw/Pz4+"` | `"PDw/Pz4+"` | `"PDw/Pz4+"` |
| `""` | `""` | `""` | `""` | `""` | `""` | — | `""` | — | `""` | `""` | `""` | `""` |
| `"\u{0}"` | `"AA=="` | `"AA=="` | `"AA=="` | `"AA=="` | `"AA=="` | — | `"AA=="` | — | `"AA=="` | `"AA=="` | `"AA=="` | `"AA=="` |
| `‹a lone surrogate›` | `undefined` | — | 💥 `InvalidCharacterError` | `"77+9"` | `"77+9"` | — | `"77+9"` | — | — | — | — | — |
| `‹UTF-8 bytes of JSON text›` | `"eyJhIjoxfQ=="` | — | `"MTIzLDM0LDk3LDM0LDU4LDQ5LDEyNQ=="` | `"eyJhIjoxfQ=="` | — | `"eyJhIjoxfQ=="` | — | `"eyJhIjoxfQ=="` | — | — | — | — |
| `‹an ArrayBuffer of JSON text›` | `"eyJhIjoxfQ=="` | — | `"W29iamVjdCBBcnJheUJ1ZmZlcl0="` | `"eyJhIjoxfQ=="` | — | — | — | — | — | — | — | — |
| `‹a DataView of JSON text›` | `"eyJhIjoxfQ=="` | — | `"W29iamVjdCBEYXRhVmlld10="` | `"eyJhIjoxfQ=="` | — | — | — | — | — | — | — | — |
| `42` | `undefined` | `"NDI="` | `"NDI="` | — | — | — | — | — | — | — | — | — |
| `true` | `undefined` | `"dHJ1ZQ=="` | `"dHJ1ZQ=="` | — | — | — | — | — | — | — | — | — |
| `null` | `undefined` | `"bnVsbA=="` | `"bnVsbA=="` | — | — | — | — | — | — | — | — | — |
| `undefined` | `undefined` | `"dW5kZWZpbmVk"` | `"dW5kZWZpbmVk"` | — | — | — | — | — | — | — | — | — |
| `["hi"]` | `undefined` | `"aGk="` | `"aGk="` | — | — | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- `atob` and `btoa` are the only Base64 functions every runtime has, and they're the wrong shape for text: they read and write one byte per UTF-16 code unit, so `btoa("€")` throws and `atob("4oKs")` is mojibake.
- `Uint8Array.fromBase64` and `toBase64` are the standard's answer, and their grammar is `atob`'s, so it's the one to match:
  - they settle each edge case the measured tools split on: missing padding (.NET, Go's `StdEncoding`, and Python reject it), embedded whitespace (Java's basic decoder and Python's strict mode reject it), and partial or extra padding (`Buffer` and js-base64 accept it);
  - a caller who later moves to the native methods sees the same results, passing `alphabet: "base64url"` for `urlSafe: true` and the same `omitPadding`.
- `atob` / `btoa` with portable UTF-8 was the fastest design with one code path, measured on 2026-10-21 on the pinned Node and Hermes images, in MB/s of input:
  - decoding 1 MB of mixed text ran at about 207 MB/s on Node 26, 177 on Node 22, and 4.9 on Hermes, against 146, 136, and 2.8 for Base64 written in JavaScript too;
  - encoding ran at about 142, 96, and 6.8, against 16, 15, and 3.0;
  - Node 26's native `fromBase64` / `toBase64` ran at about 1,460 and 1,540, five to ten times faster, but only where they exist; at 1 KB, about a JWT, the chosen design still takes around 10 µs on Node;
  - the [performance](performance.md) rule still applies to the real implementation, benchmarked against `Buffer` and the native methods.
- `urlSafe` is a boolean, as Python's `urlsafe_b64encode`, Java's `getUrlEncoder`, and js-base64 spell it, rather than the native methods' `alphabet` enum: there are only two alphabets, and the flag says which by the one property callers care about.
- Invalid UTF-8 and lone surrogates follow the URI functions, so every text conversion in the package fails the same way and takes the same `replaceInvalidWith`.
- GitHub code search, on 2026-10-21, found `decodeBase64` in about 103,000 TypeScript and JavaScript files and `encodeBase64` in about 69,000, against `base64Decode` in 57,000 and `base64Encode` in 117,000 (approximate).
  - `fromBase64` and `toBase64` are commoner still, but they're the native methods' names, with a different receiver and return type, so reusing them would mislead.
  - `decodeBase64` / `encodeBase64` put the verb first, as `decodeURIComponent` and `safeDecodeUriComponent` do.

## Consequences

- Code that relies on `atob`'s Latin-1 "binary strings" keeps calling `atob`; `decodeBase64ToBytes` is the replacement for the bytes such code was after.
- Base32, Base58, hex, and data URLs are out of scope; hex has `Uint8Array.fromHex` / `toHex` on the same native timeline.
