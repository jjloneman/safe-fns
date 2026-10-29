/*
 * The folding rules planned for `toBasicAscii`, in one place, so its audit
 * and its case file's expected answers read the same tables.
 *
 * - See docs/decisions/to-basic-ascii.md; a change here is a change to that
 *   decision.
 */

/** A capital that folds to two letters, all caps; its title form is derived. */
export const CAPITALS: Readonly<Record<string, string>> = {
  Æ: "AE",
  Ɲ: "NY",
  Ŋ: "NG",
  Œ: "OE",
  ẞ: "SS",
  Ʃ: "SH",
  Ʒ: "DZ",
  Þ: "TH",
};

/**
 * Latin letters that NFKD leaves whole, each with its ASCII spelling: the
 * letters of living orthographies, and the small capitals as lowercase.
 */
export const LETTERS: Readonly<Record<string, string>> = {
  æ: "ae",
  ᴀ: "a",
  ʙ: "b",
  ɓ: "b",
  Ɓ: "B",
  ᴄ: "c",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  ᴅ: "d",
  ɖ: "d",
  Ɖ: "D",
  ɗ: "d",
  Ɗ: "D",
  ᴇ: "e",
  ǝ: "e",
  Ǝ: "E",
  ə: "e",
  Ə: "E",
  ɛ: "e",
  Ɛ: "E",
  ꜰ: "f",
  ƒ: "f",
  Ƒ: "F",
  ɢ: "g",
  ǥ: "g",
  Ǥ: "G",
  ɣ: "g",
  Ɣ: "G",
  ħ: "h",
  Ħ: "H",
  ʜ: "h",
  ı: "i",
  ɪ: "i",
  ɨ: "i",
  Ɨ: "I",
  ᴊ: "j",
  ᴋ: "k",
  ƙ: "k",
  Ƙ: "K",
  ł: "l",
  Ł: "L",
  ʟ: "l",
  ᴍ: "m",
  ɴ: "n",
  ɲ: "ny",
  ŋ: "ng",
  ø: "o",
  Ø: "O",
  œ: "oe",
  ᴏ: "o",
  ɔ: "o",
  Ɔ: "O",
  ᴘ: "p",
  ĸ: "q",
  ʀ: "r",
  ß: "ss",
  ꜱ: "s",
  ʃ: "sh",
  ᴛ: "t",
  ŧ: "t",
  Ŧ: "T",
  ƭ: "t",
  Ƭ: "T",
  ʈ: "t",
  Ʈ: "T",
  ᴜ: "u",
  ʉ: "u",
  Ʉ: "U",
  ɯ: "w",
  Ɯ: "W",
  ʊ: "u",
  Ʊ: "U",
  ᴠ: "v",
  ʋ: "v",
  Ʋ: "V",
  ᴡ: "w",
  ʏ: "y",
  ƴ: "y",
  Ƴ: "Y",
  ᴢ: "z",
  ʒ: "dz",
  þ: "th",
};

/** Punctuation and spaces that NFKD leaves whole, each with its ASCII spelling. */
export const PUNCTUATION: Readonly<Record<string, string>> = {
  "\u1680": " ",
  "\u2010": "-",
  "\u2012": "-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2015": "-",
  "\u2E3A": "--",
  "\u2E3B": "---",
  "\u203D": "?!",
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u201B": "'",
  "\u2039": "'",
  "\u203A": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u201F": '"',
  "\u301D": '"',
  "\u301E": '"',
  "\u301F": '"',
  "\u00AB": '"',
  "\u00BB": '"',
  "\u2045": "[",
  "\u2046": "]",
  "\u29FC": "<",
  "\u29FD": ">",
  "\u2989": "<",
  "\u298A": ">",
  "\u27E8": "<",
  "\u27E9": ">",
  "\u27EA": "<<",
  "\u27EB": ">>",
  "\u2768": "(",
  "\u2769": ")",
  "\u276A": "(",
  "\u276B": ")",
  "\u276C": "<",
  "\u276D": ">",
  "\u276E": "<",
  "\u276F": ">",
  "\u2770": "<",
  "\u2771": ">",
  "\u2772": "(",
  "\u2773": ")",
  "\u2774": "{",
  "\u2775": "}",
  "\u2E26": "(",
  "\u2E27": ")",
  "\u2E28": "((",
  "\u2E29": "))",
  "\u2E55": "[",
  "\u2E56": "]",
  "\u2E57": "[",
  "\u2E58": "]",
  "\u2E59": "(",
  "\u2E5A": ")",
  "\u2E5B": "(",
  "\u2E5C": ")",
  "\u3008": "'",
  "\u3009": "'",
  "\u300A": '"',
  "\u300B": '"',
  "\u300C": '"',
  "\u300D": '"',
  "\u300E": '"',
  "\u300F": '"',
  "\u3010": "[",
  "\u3011": "]",
  "\u3014": "[",
  "\u3015": "]",
  "\u3016": "[",
  "\u3017": "]",
  "\u3018": "[",
  "\u3019": "]",
  "\u301A": "[",
  "\u301B": "]",
  "\uFD3E": "(",
  "\uFD3F": ")",
  "\u2043": "-",
  "\u2032": "'",
  "\u2035": "'",
  "\u2212": "-",
  "\u2044": "/",
  "\u02BC": "'",
};

/**
 * Characters NFKD would split into several, replaced before it runs: the
 * double primes, which NFKD writes as two single primes.
 */
export const BEFORE_NFKD: Readonly<Record<string, string>> = {
  "\u2033": '"',
  "\u2036": '"',
};

const BEFORE_NFKD_PATTERN = new RegExp(
  `[${Object.keys(BEFORE_NFKD).join("")}]`,
  "gu"
);

/**
 * Fold text by the planned rules, before anything left outside ASCII is
 * dropped: `BEFORE_NFKD`, then NFKD, then combining marks removed, then the
 * tables.
 *
 * - A capital in `CAPITALS` takes its title form before a lowercase letter.
 *
 * @returns the folded text, which may still hold non-ASCII characters.
 */
export function foldBeforeDrop(text: string): string {
  const chars = [
    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- the rules map one code point at a time.
    ...text
      .replace(BEFORE_NFKD_PATTERN, (char) => BEFORE_NFKD[char] ?? char)
      .normalize("NFKD")
      .replace(/\p{M}/gu, ""),
  ];

  return chars
    .map((char, index) => {
      const capital = CAPITALS[char];

      if (capital === undefined) {
        return LETTERS[char] ?? PUNCTUATION[char] ?? char;
      }

      return /^\p{Ll}$/u.test(chars[index + 1] ?? "")
        ? `${capital.slice(0, 1)}${capital.slice(1).toLowerCase()}`
        : capital;
    })
    .join("");
}
