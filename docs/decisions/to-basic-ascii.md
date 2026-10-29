---
type: Decision
title: How toBasicAscii folds text to ASCII
description: NFKD, then combining marks removed, then a small table for the Latin letters and punctuation that don't decompose; whatever is still outside ASCII is dropped unless `replaceUnknownWith` names a replacement, so the result is always ASCII, and a non-string returns the `fallback` option, `""` by default.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-28T05:04:12Z }
---

# How toBasicAscii folds text to ASCII

`toBasicAscii(value)` turns Latin-script text into its closest plain-ASCII spelling (`"Crème Brûlée"` → `"Creme Brulee"`), replacing the owner's `lodash.deburr` helper.

## Decision

- **Three steps, in order:**
  1. NFKD normalization, which splits accented letters (`é` → `e` plus a mark) and replaces compatibility forms with their plain ones: ligatures (`ﬁ` → `fi`, `Ĳ` → `IJ`), full-width letters (`Ａ` → `A`), superscripts (`²` → `2`), `…` → `...`, `™` → `TM`, `½` → `1⁄2`, and the no-break and thin spaces → a space;
  2. every combining mark (`\p{M}`) is removed, not `\p{Diacritic}`, which would also delete ASCII `^` and `` ` ``;
  3. a fixed table maps what doesn't decompose.
- **The letter table** (owner, 2026-10-29, from the [fold audit](../../research/audits/to-basic-ascii.md)) maps the Latin letters NFKD leaves whole:
  - Western and Central European: `ß` → `ss`, `æ` → `ae`, `œ` → `oe`, `ø` → `o`, `ł` → `l`, `đ` and `ð` → `d`, `þ` → `th`, `ħ` → `h`, `ŧ` → `t`, and `ı` → `i`, with their capitals;
  - Azerbaijani `Ə ə` → `E e`, the form slug tools use (BGN/PCGN's own fallback is `ä`);
  - Hausa and Fula hooked letters drop the hook: `ɓ ɗ ƙ ƴ` → `b d k y`;
  - Akan, Ewe, and Lingala `ɛ ɔ` → `e o`, and Ewe `ƒ ɣ ʋ ɖ` → `f g v d`;
  - `ŋ` → `ng`; Bambara `ɲ` → `ny`, its own pre-1982 spelling; Skolt Sámi `ʒ` → `dz`, the sound its alphabet gives it, where any-ascii writes IPA's `zh`; Skolt Sámi `ǥ` → `g`; and Greenlandic kra `ĸ` → `q`, as its 1973 reform spells it;
  - the other letters of African orthographies take their base letter (`ǝ` → `e`, `ɨ` → `i`, `ʉ ʊ` → `u`, `ɯ` → `w`, `ƭ ʈ` → `t`), and `ʃ` → `sh`;
  - small capitals (`ᴀ ʙ ᴄ`…) → lowercase letters, since Unicode classifies them as lowercase and "fancy text" makes them from lowercase input: `"Tʜɪꜱ ɪꜱ"` → `"This is"`.
  - A capital that folds to two letters (`ẞ`, `Æ`, `Œ`, `Þ`, `Ŋ`, `Ɲ`, `Ʒ`, `Ʃ`) takes its title form before a lowercase letter and stays all caps otherwise: `"Þór"` → `"Thor"`, `"Ærøskøbing"` → `"Aeroskobing"`, but `"ẞ"` → `"SS"`, `"STRAẞE"` → `"STRASSE"`, and `"ÆRØ"` → `"AERO"`.
- **Letters that stay dropped:** scholarly and phonetic Latin (medievalist and Africanist letters in Latin Extended-C to G, IPA such as `ɐ ɑ ɒ`, phonetic modifiers, and Gothic and Old English `ƕ ƿ ȝ`), where a guessed spelling would mislead.
- **The punctuation table** (owner, 2026-10-29, from the [fold audit](../../research/audits/to-basic-ascii.md)) keys each entry by its NFKD form, so vertical, small, and half-width variants follow their base character:
  - curly and prime quotes (`‘ ’ ‚ ‛ ′ ʼ ‵`) → `'`, and double ones (`“ ” „ ‟ ″ ‶`) → `"`;
  - guillemets `« »` → `"` and `‹ ›` → `'`; CJK quotes `「」『』〝〞〟` → `"`;
  - CJK book-title marks `《》` → `"`, and the inner title marks `〈〉` → `'`, the nested-quote convention;
  - hyphens, dashes, and the minus sign (`‐ ‑ ‒ – — ― ⁃ −`) → `-`, and the fraction slash `⁄` → `/`, so `½` ends as `1/2`;
  - the two- and three-em dashes keep their length, one hyphen per em: `⸺` → `--` and `⸻` → `---` (owner, 2026-10-29), since the length carries the meaning (omitted letters, a repeated author in a bibliography);
  - the interrobang `‽` → `?!`, the order people type, and the one `⁈` already folds to;
  - brackets by shape: ornamental (`❨❩ ❪❫ ❲❳ ❴❵ ﴾﴿`), CJK (`【】 〔〕 〖〗 〘〙 〚〛`), angle (`⟨⟩ ❬❭ ❮❯ ❰❱ ⦉⦊ ⧼⧽`), and text brackets (`⁅⁆ ⸦⸧ ⹕`–`⹜`) → `( ) [ ] { } < >`, the double parentheses `⸨⸩` → `(( ))`, and Z notation's chevrons `⟪⟫` → `<< >>`;
  - the Ogham space mark `U+1680` → a space, the one space NFKD leaves alone.
- **Punctuation that stays dropped:** Spanish `¡ ¿` (the closing mark already carries the meaning, so `"¡Hola!"` → `"Hola!"`), other scripts' marks (Arabic `، ؛ ؟`, Devanagari `। ॥`, CJK `、。`), symbols filed as punctuation (`§ ¶ † ‡ • ※ ‰`), the middle dot (`"col·lecció"` → `"colleccio"`), and math and editorial brackets (`⌈⌉ ⌊⌋ ⟦⟧ ⸢⸣ ⸤⸥`, and `｟｠`, whose NFKD form is math's `⦅⦆`), where a shape would change the meaning.
- **Whatever is still outside ASCII is dropped by default:** `€`, `£`, `©`, `°`, emoji, and letters of other scripts (`"日本語"` → `""`), as are invisible characters such as the soft hyphen and zero-width space.
  - `replaceUnknownWith` replaces each leftover code point instead: `toBasicAscii("€5", { replaceUnknownWith: "?" })` is `"?5"`.
  - The result is always ASCII, which is what the name promises; a replacement outside ASCII is folded and dropped by the same rules.
  - Symbols aren't spelled out (`€` isn't `EUR`), so the table stays letters and punctuation.
- **ASCII passes through unchanged,** control characters included (`"tab\tnew\nline"`).
- **A non-string returns the `fallback` option, `""` by default,** as [trimBlank](trim-blank.md) does, and a boxed string is unwrapped first.
- **A lone surrogate is outside ASCII,** so it's dropped.

## Comparison

The tiers 0–2 summary from [research/results/to-basic-ascii.md](../../research/results/to-basic-ascii.md), generated by `pnpm research`; the full table there adds PHP's `iconv`, Rails' `transliterate`, and Swift's `folding`.

<!-- prettier-ignore-start -->
| Case | safe-fns (planned)<br>`toBasicAscii` | @sindresorhus/transliterate<br>`transliterate(value)` | any-ascii<br>`anyAscii(value)` | es-toolkit<br>`deburr(value)` | Hermes<br>`value.normalize("NFD").replace(/\p{M}/gu, "")` | Hermes<br>`value.normalize("NFKD").replace(/\p{M}/gu, "")` | JS built-ins<br>`value.normalize("NFD").replace(/\p{M}/gu, "")` | JS built-ins<br>`value.normalize("NFKD").replace(/\p{M}/gu, "")` | lodash<br>`_.deburr(value)` | transliteration<br>`transliterate(value)` | Voca<br>`v.latinise(value)` | .NET<br>`Encoding.ASCII.GetString(Encoding.ASCII.GetBytes(value))` | .NET<br>`string.Concat(value.Normalize(FormD).Where(c => GetUnicodeCategory(c) != NonSpacingMark))` | Commons Lang<br>`StringUtils.stripAccents(value)` | Java<br>`Normalizer.normalize(value, NFD).replaceAll("\\p{M}", "")` | Python<br>`normalize("NFKD", value).encode("ascii", "ignore").decode()` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` | `"hello"` |
| `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` | `""` |
| `"café"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"caf?"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` |
| `"Crème Brûlée"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Cr?me Br?l?e"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` | `"Creme Brulee"` |
| `"naïve"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` | `"na?ve"` | `"naive"` | `"naive"` | `"naive"` | `"naive"` |
| `"café"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe?"` | `"cafe"` | `"cafe"` | `"cafe"` | `"cafe"` |
| `"Ångström"` | `"Angstrom"` | `"Angstroem"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"?ngstr?m"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` | `"Angstrom"` |
| `"Å"` | `"A"` | `"A"` | `"A"` | `"A"` | `"A"` | `"A"` | `"A"` | `"A"` | `"Å"` | `""` | `"Å"` | `"?"` | `"A"` | `"A"` | `"A"` | `"A"` |
| `"Straße"` | `"Strasse"` | `"Strasse"` | `"Strasse"` | `"Strasse"` | `"Straße"` | `"Straße"` | `"Straße"` | `"Straße"` | `"Strasse"` | `"Strasse"` | `"Strase"` | `"Stra?e"` | `"Straße"` | `"Straße"` | `"Straße"` | `"Strae"` |
| `"ẞ"` | `"SS"` | `"Ss"` | `"Ss"` | `"ẞ"` | `"ẞ"` | `"ẞ"` | `"ẞ"` | `"ẞ"` | `"ẞ"` | `""` | `"ẞ"` | `"?"` | `"ẞ"` | `"ẞ"` | `"ẞ"` | `""` |
| `"STRAẞE"` | `"STRASSE"` | `"STRASsE"` | `"STRASsE"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAE"` | `"STRAẞE"` | `"STRA?E"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAẞE"` | `"STRAE"` |
| `"ÆRØ"` | `"AERO"` | `"AERO"` | `"AeRO"` | `"AeRO"` | `"ÆRØ"` | `"ÆRØ"` | `"ÆRØ"` | `"ÆRØ"` | `"AeRO"` | `"AERO"` | `"AERO"` | `"?R?"` | `"ÆRØ"` | `"ÆRØ"` | `"ÆRØ"` | `"R"` |
| `"Œuvre"` | `"Oeuvre"` | `"OEuvre"` | `"Oeuvre"` | `"Oeuvre"` | `"Œuvre"` | `"Œuvre"` | `"Œuvre"` | `"Œuvre"` | `"Oeuvre"` | `"OEuvre"` | `"OEuvre"` | `"?uvre"` | `"Œuvre"` | `"Œuvre"` | `"Œuvre"` | `"uvre"` |
| `"Ærøskøbing"` | `"Aeroskobing"` | `"AEroskobing"` | `"Aeroskobing"` | `"Aeroskobing"` | `"Ærøskøbing"` | `"Ærøskøbing"` | `"Ærøskøbing"` | `"Ærøskøbing"` | `"Aeroskobing"` | `"AEroskobing"` | `"AEroskobing"` | `"?r?sk?bing"` | `"Ærøskøbing"` | `"Ærøskøbing"` | `"Ærøskøbing"` | `"rskbing"` |
| `"Łódź"` | `"Lodz"` | `"Lodz"` | `"Lodz"` | `"Lodz"` | `"Łodz"` | `"Łodz"` | `"Łodz"` | `"Łodz"` | `"Lodz"` | `"Lodz"` | `"Lodz"` | `"??d?"` | `"Łodz"` | `"Lodz"` | `"Łodz"` | `"odz"` |
| `"Đorđe"` | `"Dorde"` | `"Dorde"` | `"Dorde"` | `"Dorde"` | `"Đorđe"` | `"Đorđe"` | `"Đorđe"` | `"Đorđe"` | `"Dorde"` | `"Dorde"` | `"Dorde"` | `"?or?e"` | `"Đorđe"` | `"Dorde"` | `"Đorđe"` | `"ore"` |
| `"œuvre"` | `"oeuvre"` | `"oeuvre"` | `"oeuvre"` | `"oeuvre"` | `"œuvre"` | `"œuvre"` | `"œuvre"` | `"œuvre"` | `"oeuvre"` | `"oeuvre"` | `"oeuvre"` | `"?uvre"` | `"œuvre"` | `"œuvre"` | `"œuvre"` | `"uvre"` |
| `"Þór"` | `"Thor"` | `"THor"` | `"Thor"` | `"Thor"` | `"Þor"` | `"Þor"` | `"Þor"` | `"Þor"` | `"Thor"` | `"Thor"` | `"THor"` | `"??r"` | `"Þor"` | `"Þor"` | `"Þor"` | `"or"` |
| `"Iğdır"` | `"Igdir"` | `"Igdir"` | `"Igdir"` | `"Igdir"` | `"Igdır"` | `"Igdır"` | `"Igdır"` | `"Igdır"` | `"Igdir"` | `"Igdir"` | `"Igdir"` | `"I?d?r"` | `"Igdır"` | `"Igdır"` | `"Igdır"` | `"Igdr"` |
| `"ð"` | `"d"` | `"d"` | `"d"` | `"d"` | `"ð"` | `"ð"` | `"ð"` | `"ð"` | `"d"` | `"d"` | `"d"` | `"?"` | `"ð"` | `"ð"` | `"ð"` | `""` |
| `"ħ"` | `"h"` | `"h"` | `"h"` | `"h"` | `"ħ"` | `"ħ"` | `"ħ"` | `"ħ"` | `"h"` | `"h"` | `"h"` | `"?"` | `"ħ"` | `"ħ"` | `"ħ"` | `""` |
| `"Ĳ"` | `"IJ"` | `"IJ"` | `"IJ"` | `"IJ"` | `"Ĳ"` | `"IJ"` | `"Ĳ"` | `"IJ"` | `"IJ"` | `"IJ"` | `"Ĳ"` | `"?"` | `"Ĳ"` | `"IJ"` | `"Ĳ"` | `"IJ"` |
| `"ſ"` | `"s"` | `"ſ"` | `"s"` | `"s"` | `"ſ"` | `"s"` | `"ſ"` | `"s"` | `"s"` | `"s"` | `"l"` | `"?"` | `"ſ"` | `"s"` | `"ſ"` | `"s"` |
| `"ŉ"` | `"'n"` | `"ŉ"` | `"'n"` | `"'n"` | `"ŉ"` | `"ʼn"` | `"ŉ"` | `"ʼn"` | `"'n"` | `"'n"` | `"n"` | `"?"` | `"ŉ"` | `"ʼn"` | `"ŉ"` | `"n"` |
| `"ﬁle"` | `"file"` | `"ﬁle"` | `"file"` | `"ﬁle"` | `"ﬁle"` | `"file"` | `"ﬁle"` | `"file"` | `"ﬁle"` | `"file"` | `"ﬁle"` | `"?le"` | `"ﬁle"` | `"file"` | `"ﬁle"` | `"file"` |
| `"Ａｂｃ"` | `"Abc"` | `"Ａｂｃ"` | `"Abc"` | `"Ａｂｃ"` | `"Ａｂｃ"` | `"Abc"` | `"Ａｂｃ"` | `"Abc"` | `"Ａｂｃ"` | `"Abc"` | `"Ａｂｃ"` | `"???"` | `"Ａｂｃ"` | `"Abc"` | `"Ａｂｃ"` | `"Abc"` |
| `"x²"` | `"x2"` | `"x²"` | `"x2"` | `"x²"` | `"x²"` | `"x2"` | `"x²"` | `"x2"` | `"x²"` | `"x2"` | `"x²"` | `"x?"` | `"x²"` | `"x2"` | `"x²"` | `"x2"` |
| `"½"` | `"1/2"` | `"½"` | `"1/2"` | `"½"` | `"½"` | `"1⁄2"` | `"½"` | `"1⁄2"` | `"½"` | `"1/2"` | `"½"` | `"?"` | `"½"` | `"1⁄2"` | `"½"` | `"12"` |
| `"™"` | `"TM"` | `"™"` | `"TM"` | `"™"` | `"™"` | `"TM"` | `"™"` | `"TM"` | `"™"` | `"(tm)"` | `"™"` | `"?"` | `"™"` | `"TM"` | `"™"` | `"TM"` |
| `"℃"` | `"C"` | `"℃"` | `"C"` | `"℃"` | `"℃"` | `"°C"` | `"℃"` | `"°C"` | `"℃"` | `""` | `"℃"` | `"?"` | `"℃"` | `"°C"` | `"℃"` | `"C"` |
| `"“hi” ‘yo’"` | `"\"hi\" 'yo'"` | `"“hi” ‘yo’"` | `"\"hi\" 'yo'"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"\"hi\" 'yo'"` | `"“hi” ‘yo’"` | `"?hi? ?yo?"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"“hi” ‘yo’"` | `"hi yo"` |
| `"a–b—c"` | `"a-b-c"` | `"a-b-c"` | `"a-b-c"` | `"a–b—c"` | `"a–b—c"` | `"a–b—c"` | `"a–b—c"` | `"a–b—c"` | `"a–b—c"` | `"a-b--c"` | `"a–b—c"` | `"a?b?c"` | `"a–b—c"` | `"a–b—c"` | `"a–b—c"` | `"abc"` |
| `"…"` | `"..."` | `"…"` | `"..."` | `"…"` | `"…"` | `"..."` | `"…"` | `"..."` | `"…"` | `"..."` | `"…"` | `"?"` | `"…"` | `"..."` | `"…"` | `"..."` |
| `"−5"` | `"-5"` | `"-5"` | `"-5"` | `"−5"` | `"−5"` | `"−5"` | `"−5"` | `"−5"` | `"−5"` | `"5"` | `"−5"` | `"?5"` | `"−5"` | `"−5"` | `"−5"` | `"5"` |
| `"a\u{A0}b"` | `"a b"` | `"a\u{A0}b"` | `"a b"` | `"a\u{A0}b"` | `"a\u{A0}b"` | `"a b"` | `"a\u{A0}b"` | `"a b"` | `"a\u{A0}b"` | `"a b"` | `"a\u{A0}b"` | `"a?b"` | `"a\u{A0}b"` | `"a b"` | `"a\u{A0}b"` | `"a b"` |
| `"a\u{2009}b"` | `"a b"` | `"a\u{2009}b"` | `"a b"` | `"a\u{2009}b"` | `"a\u{2009}b"` | `"a b"` | `"a\u{2009}b"` | `"a b"` | `"a\u{2009}b"` | `"a b"` | `"a\u{2009}b"` | `"a?b"` | `"a\u{2009}b"` | `"a b"` | `"a\u{2009}b"` | `"a b"` |
| `"soft\u{AD}hyphen"` | `"softhyphen"` | `"soft\u{AD}hyphen"` | `"softhyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"softhyphen"` | `"soft\u{AD}hyphen"` | `"soft?hyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"soft\u{AD}hyphen"` | `"softhyphen"` |
| `"zero\u{200B}width"` | `"zerowidth"` | `"zero\u{200B}width"` | `"zerowidth"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zero width"` | `"zero\u{200B}width"` | `"zero?width"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zero\u{200B}width"` | `"zerowidth"` |
| `"€5"` | `"5"` | `"E5"` | `"EUR5"` | `"€5"` | `"€5"` | `"€5"` | `"€5"` | `"€5"` | `"€5"` | `"EU5"` | `"€5"` | `"?5"` | `"€5"` | `"€5"` | `"€5"` | `"5"` |
| `"£5"` | `"5"` | `"£5"` | `"GBP5"` | `"£5"` | `"£5"` | `"£5"` | `"£5"` | `"£5"` | `"£5"` | `"PS5"` | `"£5"` | `"?5"` | `"£5"` | `"£5"` | `"£5"` | `"5"` |
| `"© 2026"` | `" 2026"` | `"© 2026"` | `"(C) 2026"` | `"© 2026"` | `"© 2026"` | `"© 2026"` | `"© 2026"` | `"© 2026"` | `"© 2026"` | `"(c) 2026"` | `"© 2026"` | `"? 2026"` | `"© 2026"` | `"© 2026"` | `"© 2026"` | `" 2026"` |
| `"°"` | `""` | `"°"` | `"deg"` | `"°"` | `"°"` | `"°"` | `"°"` | `"°"` | `"°"` | `"deg"` | `"°"` | `"?"` | `"°"` | `"°"` | `"°"` | `""` |
| `"日本語"` | `""` | `"日本語"` | `"RiBenYu"` | `"日本語"` | `"日本語"` | `"日本語"` | `"日本語"` | `"日本語"` | `"日本語"` | `"Ri Ben Yu"` | `"日本語"` | `"???"` | `"日本語"` | `"日本語"` | `"日本語"` | `""` |
| `"Привет"` | `""` | `"Privet"` | `"Privet"` | `"Привет"` | `"Привет"` | `"Привет"` | `"Привет"` | `"Привет"` | `"Привет"` | `"Privet"` | `"Privet"` | `"??????"` | `"Привет"` | `"Привет"` | `"Привет"` | `""` |
| `"Ελλάδα"` | `""` | `"Ellada"` | `"Ellada"` | `"Ελλαδα"` | `"Ελλαδα"` | `"Ελλαδα"` | `"Ελλαδα"` | `"Ελλαδα"` | `"Ελλάδα"` | `"Ellada"` | `"Ellada"` | `"??????"` | `"Ελλαδα"` | `"Ελλαδα"` | `"Ελλαδα"` | `""` |
| `"😀"` | `""` | `"😀"` | `":grinning:"` | `"😀"` | `"😀"` | `"😀"` | `"😀"` | `"😀"` | `"😀"` | `""` | `"😀"` | `"??"` | `"😀"` | `"😀"` | `"😀"` | `""` |
| `"ǅ"` | `"Dz"` | `"ǅ"` | `"Dz"` | `"ǅ"` | `"ǅ"` | `"Dz"` | `"ǅ"` | `"Dz"` | `"ǅ"` | `"Dz"` | `"Dz"` | `"?"` | `"ǅ"` | `"Dz"` | `"ǅ"` | `"Dz"` |
| `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` | `"tab\u{9}new\u{A}line"` |
| `"á̀"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"a"` | `"??"` | `"a"` | `"a"` | `"a"` | `"a"` |
| `"«quoted»"` | `"\"quoted\""` | `"«quoted»"` | `"<<quoted>>"` | `"«quoted»"` | `"«quoted»"` | `"«quoted»"` | `"«quoted»"` | `"«quoted»"` | `"«quoted»"` | `"<<quoted>>"` | `"«quoted»"` | `"?quoted?"` | `"«quoted»"` | `"«quoted»"` | `"«quoted»"` | `"quoted"` |
| `"‹single›"` | `"'single'"` | `"‹single›"` | `"<single>"` | `"‹single›"` | `"‹single›"` | `"‹single›"` | `"‹single›"` | `"‹single›"` | `"‹single›"` | `"<single>"` | `"‹single›"` | `"?single?"` | `"‹single›"` | `"‹single›"` | `"‹single›"` | `"single"` |
| `"「日本」"` | `"\"\""` | `"「日本」"` | `"[RiBen]"` | `"「日本」"` | `"「日本」"` | `"「日本」"` | `"「日本」"` | `"「日本」"` | `"「日本」"` | `"[Ri Ben] "` | `"「日本」"` | `"????"` | `"「日本」"` | `"「日本」"` | `"「日本」"` | `""` |
| `"《書》"` | `"\"\""` | `"《書》"` | `"<<Shu>>"` | `"《書》"` | `"《書》"` | `"《書》"` | `"《書》"` | `"《書》"` | `"《書》"` | `"<<Shu>> "` | `"《書》"` | `"???"` | `"《書》"` | `"《書》"` | `"《書》"` | `""` |
| `"⟪a⟫"` | `"<<a>>"` | `"⟪a⟫"` | `"<<a>>"` | `"⟪a⟫"` | `"⟪a⟫"` | `"⟪a⟫"` | `"⟪a⟫"` | `"⟪a⟫"` | `"⟪a⟫"` | `"a"` | `"⟪a⟫"` | `"?a?"` | `"⟪a⟫"` | `"⟪a⟫"` | `"⟪a⟫"` | `"a"` |
| `"¡Hola!"` | `"Hola!"` | `"¡Hola!"` | `"!Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"!Hola!"` | `"¡Hola!"` | `"?Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"¡Hola!"` | `"Hola!"` |
| `"¿Qué?"` | `"Que?"` | `"¿Que?"` | `"?Que?"` | `"¿Que?"` | `"¿Que?"` | `"¿Que?"` | `"¿Que?"` | `"¿Que?"` | `"¿Que?"` | `"?Que?"` | `"¿Que?"` | `"?Qu??"` | `"¿Que?"` | `"¿Que?"` | `"¿Que?"` | `"Que?"` |
| `"‽"` | `"?!"` | `"?!"` | `"!?"` | `"‽"` | `"‽"` | `"‽"` | `"‽"` | `"‽"` | `"‽"` | `"!?"` | `"‽"` | `"?"` | `"‽"` | `"‽"` | `"‽"` | `""` |
| `"a⸺b"` | `"a--b"` | `"a-b"` | `"a--b"` | `"a⸺b"` | `"a⸺b"` | `"a⸺b"` | `"a⸺b"` | `"a⸺b"` | `"a⸺b"` | `"ab"` | `"a⸺b"` | `"a?b"` | `"a⸺b"` | `"a⸺b"` | `"a⸺b"` | `"ab"` |
| `"a\u{1680}b"` | `"a b"` | `"a\u{1680}b"` | `"a b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"a b"` | `"a\u{1680}b"` | `"a?b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"a\u{1680}b"` | `"ab"` |
| `"❨x❩"` | `"(x)"` | `"❨x❩"` | `"(x)"` | `"❨x❩"` | `"❨x❩"` | `"❨x❩"` | `"❨x❩"` | `"❨x❩"` | `"❨x❩"` | `"x"` | `"❨x❩"` | `"?x?"` | `"❨x❩"` | `"❨x❩"` | `"❨x❩"` | `"x"` |
| `"【注】"` | `"[]"` | `"【注】"` | `"[(Zhu)]"` | `"【注】"` | `"【注】"` | `"【注】"` | `"【注】"` | `"【注】"` | `"【注】"` | `"[(Zhu)] "` | `"【注】"` | `"???"` | `"【注】"` | `"【注】"` | `"【注】"` | `""` |
| `"⌊x⌋"` | `"x"` | `"⌊x⌋"` | `"[x]"` | `"⌊x⌋"` | `"⌊x⌋"` | `"⌊x⌋"` | `"⌊x⌋"` | `"⌊x⌋"` | `"⌊x⌋"` | `"x"` | `"⌊x⌋"` | `"?x?"` | `"⌊x⌋"` | `"⌊x⌋"` | `"⌊x⌋"` | `"x"` |
| `"⸢x⸣"` | `"x"` | `"⸢x⸣"` | `"[x]"` | `"⸢x⸣"` | `"⸢x⸣"` | `"⸢x⸣"` | `"⸢x⸣"` | `"⸢x⸣"` | `"⸢x⸣"` | `"x"` | `"⸢x⸣"` | `"?x?"` | `"⸢x⸣"` | `"⸢x⸣"` | `"⸢x⸣"` | `"x"` |
| `"§1"` | `"1"` | `"§1"` | `"S1"` | `"§1"` | `"§1"` | `"§1"` | `"§1"` | `"§1"` | `"§1"` | `"SS1"` | `"§1"` | `"?1"` | `"§1"` | `"§1"` | `"§1"` | `"1"` |
| `"col·lecció"` | `"colleccio"` | `"colleccio"` | `"col-leccio"` | `"col·leccio"` | `"col·leccio"` | `"col·leccio"` | `"col·leccio"` | `"col·leccio"` | `"col·leccio"` | `"col*leccio"` | `"col·leccio"` | `"col?lecci?"` | `"col·leccio"` | `"col·leccio"` | `"col·leccio"` | `"colleccio"` |
| `"｟x｠"` | `"x"` | `"｟x｠"` | `"(x)"` | `"｟x｠"` | `"｟x｠"` | `"⦅x⦆"` | `"｟x｠"` | `"⦅x⦆"` | `"｟x｠"` | `"x"` | `"｟x｠"` | `"?x?"` | `"｟x｠"` | `"⦅x⦆"` | `"｟x｠"` | `"x"` |
| `"Azərbaycan"` | `"Azerbaycan"` | `"Azarbaycan"` | `"Azerbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Az@rbaycan"` | `"Azərbaycan"` | `"Az?rbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Azərbaycan"` | `"Azrbaycan"` |
| `"ɗaya"` | `"daya"` | `"ɗaya"` | `"daya"` | `"ɗaya"` | `"ɗaya"` | `"ɗaya"` | `"ɗaya"` | `"ɗaya"` | `"ɗaya"` | `"daya"` | `"daya"` | `"?aya"` | `"ɗaya"` | `"ɗaya"` | `"ɗaya"` | `"aya"` |
| `"Ɔkɔm"` | `"Okom"` | `"Ɔkɔm"` | `"Okom"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"Okom"` | `"Okom"` | `"?k?m"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"Ɔkɔm"` | `"km"` |
| `"Ŋaa"` | `"Ngaa"` | `"Ŋaa"` | `"Ngaa"` | `"Naa"` | `"Ŋaa"` | `"Ŋaa"` | `"Ŋaa"` | `"Ŋaa"` | `"Naa"` | `"NGaa"` | `"Ŋaa"` | `"?aa"` | `"Ŋaa"` | `"Ŋaa"` | `"Ŋaa"` | `"aa"` |
| `"ŊAA"` | `"NGAA"` | `"ŊAA"` | `"NgAA"` | `"NAA"` | `"ŊAA"` | `"ŊAA"` | `"ŊAA"` | `"ŊAA"` | `"NAA"` | `"NGAA"` | `"ŊAA"` | `"?AA"` | `"ŊAA"` | `"ŊAA"` | `"ŊAA"` | `"AA"` |
| `"ɲɔgɔn"` | `"nyogon"` | `"ɲɔgɔn"` | `"nogon"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"nogon"` | `"nogon"` | `"??g?n"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"ɲɔgɔn"` | `"gn"` |
| `"Ʒuõʒ"` | `"Dzuodz"` | `"Ʒuoʒ"` | `"Zhuozh"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"ZHuoZ"` | `"Ʒuoʒ"` | `"?u??"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"Ʒuoʒ"` | `"uo"` |
| `"Tʜɪꜱ ɪꜱ"` | `"This is"` | `"Tʜɪꜱ ɪꜱ"` | `"This is"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"THIS IS"` | `"Tʜɪꜱ ɪꜱ"` | `"T??? ??"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"Tʜɪꜱ ɪꜱ"` | `"T "` |
| `"ĸ"` | `"q"` | `"ĸ"` | `"q"` | `"k"` | `"ĸ"` | `"ĸ"` | `"ĸ"` | `"ĸ"` | `"k"` | `"k"` | `"ĸ"` | `"?"` | `"ĸ"` | `"ĸ"` | `"ĸ"` | `""` |
| `"ɐ"` | `""` | `"ɐ"` | `"a"` | `"ɐ"` | `"ɐ"` | `"ɐ"` | `"ɐ"` | `"ɐ"` | `"ɐ"` | `"a"` | `"a"` | `"?"` | `"ɐ"` | `"ɐ"` | `"ɐ"` | `""` |
| `"Ꜣ"` | `""` | `"Ꜣ"` | `"'"` | `"Ꜣ"` | `"Ꜣ"` | `"Ꜣ"` | `"Ꜣ"` | `"Ꜣ"` | `"Ꜣ"` | `"A"` | `"Ꜣ"` | `"?"` | `"Ꜣ"` | `"Ꜣ"` | `"Ꜣ"` | `""` |
| `"5″"` | `"5\""` | `"5″"` | `"5''"` | `"5″"` | `"5″"` | `"5′′"` | `"5″"` | `"5′′"` | `"5″"` | `"5''"` | `"5″"` | `"5?"` | `"5″"` | `"5′′"` | `"5″"` | `"5"` |
| `"‶x″"` | `"\"x\""` | `"‶x″"` | `` "``x''" `` | `"‶x″"` | `"‶x″"` | `"‵‵x′′"` | `"‶x″"` | `"‵‵x′′"` | `"‶x″"` | `` "``x''" `` | `"‶x″"` | `"?x?"` | `"‶x″"` | `"‵‵x′′"` | `"‶x″"` | `"x"` |
| `"x‴"` | `"x'''"` | `"x‴"` | `"x'''"` | `"x‴"` | `"x‴"` | `"x′′′"` | `"x‴"` | `"x′′′"` | `"x‴"` | `"x'''"` | `"x‴"` | `"x?"` | `"x‴"` | `"x′′′"` | `"x‴"` | `"x"` |
| `"Mr. B⸺"` | `"Mr. B--"` | `"Mr. B-"` | `"Mr. B--"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B"` | `"Mr. B⸺"` | `"Mr. B?"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B⸺"` | `"Mr. B"` |
| `"⸻. Title"` | `"---. Title"` | `"-. Title"` | `"---. Title"` | `"⸻. Title"` | `"⸻. Title"` | `"⸻. Title"` | `"⸻. Title"` | `"⸻. Title"` | `"⸻. Title"` | `". Title"` | `"⸻. Title"` | `"?. Title"` | `"⸻. Title"` | `"⸻. Title"` | `"⸻. Title"` | `". Title"` |
| `undefined` | `""` | — | — | 💥 `TypeError` | — | — | — | — | `""` | — | — | — | — | — | — | — |
| `null` | `""` | — | — | 💥 `TypeError` | — | — | — | — | `""` | — | — | — | — | `null` | — | — |
| `42` | `""` | — | — | 💥 `TypeError` | — | — | — | — | `"42"` | — | — | — | — | — | — | — |
| `["a"]` | `""` | — | — | 💥 `TypeError` | — | — | — | — | `"a"` | — | — | — | — | — | — | — |
| `{}` | `""` | — | — | 💥 `TypeError` | — | — | — | — | `"[object Object]"` | — | — | — | — | — | — | — |
| `‹a lone surrogate›` | `""` | `"\u{D800}"` | `""` | `"\u{D800}"` | — | — | `"\u{D800}"` | `"\u{D800}"` | `"\u{D800}"` | `""` | `"\u{D800}"` | — | — | — | — | — |
| `‹a boxed string›` | `"hi"` | — | — | `"hi"` | — | — | — | — | `"hi"` | — | — | — | — | — | — | — |
| `‹a symbol›` | `""` | — | — | 💥 `TypeError` | — | — | — | — | `"Symbol(hostile)"` | — | — | — | — | — | — | — |
<!-- prettier-ignore-end -->

## Why

- **No tool measured folds all of it:**
  - NFD or NFKD alone, in every language, leaves `ß`, `ø`, `ł`, `đ`, `æ`, `œ`, `þ`, `ð`, `ħ`, and `ı` alone, since none of them decomposes;
  - lodash's and es-toolkit's `deburr` cover those letters but not compatibility forms (`ﬁ`, `Ａ`, `²`) or punctuation, and leave `ẞ`;
  - Python's common `normalize("NFKD", value).encode("ascii", "ignore")` deletes the letters that don't decompose, so `"Ærøskøbing"` becomes `"rskbing"`.
- **NFKD rather than NFD** folds ligatures, full-width letters, and superscripts too, which a plain-ASCII result needs; only the NFKD idioms (JavaScript, Hermes, and Python), Commons Lang's `stripAccents`, any-ascii, and transliteration get them.
- **A small table, not transliteration.**
  - any-ascii and transliteration romanize every script (`"Привет"` → `"Privet"`; `"日本語"` → `"RiBenYu"` and `"Ri Ben Yu"`), and Voca and `@sindresorhus/transliterate` romanize Cyrillic and Greek, all from tables far larger than the rest of the package.
  - The table covers only the Latin letters that don't decompose; a caller who needs romanization depends on a transliterator instead.
- **Dropping leftovers keeps the name's promise.** `toBasicAscii` is for slugs, file names, and identifiers, where a non-ASCII character is the problem.
  - Replacing with `?`, as .NET's ASCII encoding, `iconv`, and Rails do, puts a character in the result that the caller didn't write, so it's opt-in through `replaceUnknownWith`.
- **Context-aware capitals** match lodash, es-toolkit, any-ascii, transliteration, and Rails on a capitalized word (`"Thor"`), and keep an all-caps word all caps (`"STRASSE"`), where lodash, es-toolkit, and any-ascii always write the title form, turning `"ÆRØ"` into `"AeRO"`.
- **No symbol table** (owner, 2026-10-28): any-ascii's `EUR`, `(C)`, and `deg` are each a guess at a spelling, and the list would grow without end.

## Consequences

- The README says plainly that text in other scripts comes back empty, and points to a transliterator for it.
- The table is data the package ships; adding a letter changes results, so it's a `feat`, never a `fix`.
- Normalization follows each engine's Unicode version; the tests pin the characters above, not the whole table.
- [research/audits/to-basic-ascii.md](../../research/audits/to-basic-ascii.md), generated by `pnpm research:audit`, lists every Latin letter, punctuation mark, space, and currency or Latin-1 symbol the rules still drop, for the owner's review; a reviewed addition lands in `research/adapters/fold-audit/rules.mts` and in this record.
