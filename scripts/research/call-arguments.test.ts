import { describe, expect, test } from "vitest";

import { splitCalls } from "./call-arguments.ts";

describe("splitCalls", () => {
  test.each([
    {
      description: "plain arguments",
      expected: [["text", "10"]],
      fragment: "parseInt(text, 10)",
    },
    {
      description: "a call without arguments",
      expected: [[]],
      fragment: "parseInt()",
    },
    {
      description: "a trailing comma",
      expected: [["text"]],
      fragment: "parseInt(text,)",
    },
    {
      description: "nested brackets",
      expected: [["f(a, b)", "[1, 2]", "{ c: 3 }"]],
      fragment: "parseInt(f(a, b), [1, 2], { c: 3 })",
    },
    {
      description: "commas and brackets inside strings",
      expected: [[String.raw`"a,\")"`, "'b('", "`c,`"]],
      fragment: String.raw`parseInt("a,\")", 'b(', ` + "`c,`)",
    },
    {
      description: "a member call",
      expected: [["x", "16"]],
      fragment: "Number.parseInt(x, 16)",
    },
    {
      description: "space before the parenthesis",
      expected: [["x"]],
      fragment: "parseInt (x)",
    },
    {
      description: "a longer identifier, which isn't a call",
      expected: [],
      fragment: "myParseInt(x, 10); $parseInt(x)",
    },
    {
      description: "a call cut off by the fragment's end",
      expected: [undefined],
      fragment: "parseInt(text, ",
    },
    {
      description: "several calls",
      expected: [["a"], ["b", "2"]],
      fragment: "parseInt(a) + parseInt(b, 2)",
    },
  ])("splits $description", ({ expected, fragment }) => {
    // Given/When/Then - the calls' arguments in order
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual(
      expected
    );
  });

  test("escapes a callee's regex characters", () => {
    // Given - a dotted callee, whose dot must not match any character
    const fragment = "JSON.parse(a); JSONxparse(b)";

    // When - splitting its calls
    const calls = splitCalls({ callee: "JSON.parse", fragment });

    // Then - only the real call is found
    expect(calls).toStrictEqual([["a"]]);
  });
});

describe("splitCalls skipping", () => {
  test.each([
    {
      description: "a line comment holding an apostrophe",
      expected: [["x", "10"]],
      fragment: "parseInt(x, // don't trust it\n 10)",
    },
    {
      description: "a block comment holding a comma",
      expected: [["x", "16"]],
      fragment: "parseInt(x, /* hex, always */ 16)",
    },
    {
      description: "a regex holding a bracket and a comma",
      expected: [["x.replace(/[),]/g, '')", "10"]],
      fragment: "parseInt(x.replace(/[),]/g, ''), 10)",
    },
    {
      description: "a regex holding an escaped slash",
      expected: [["/a\\/b/.source", "10"]],
      fragment: "parseInt(/a\\/b/.source, 10)",
    },
    {
      description: "a division, which isn't a regex",
      expected: [["a / b", "10"]],
      fragment: "parseInt(a / b, 10)",
    },
    {
      description: "a division after a closing bracket",
      expected: [["f(a) / g(b) / 2", "10"]],
      fragment: "parseInt(f(a) / g(b) / 2, 10)",
    },
    {
      description: "an unterminated block comment",
      expected: [undefined],
      fragment: "parseInt(x, /* never closed",
    },
    {
      description: "a line comment that runs to the end",
      expected: [undefined],
      fragment: "parseInt(x, // the rest",
    },
    {
      description: "a slash before a newline, which isn't a regex",
      expected: [["x", "/abc"]],
      fragment: "parseInt(x, /abc\n)",
    },
    {
      description: "an apostrophe in JSX text, which isn't a string",
      expected: [["<p>don't</p>", "10"]],
      fragment: "parseInt(<p>don't</p>, 10)\n",
    },
    {
      description: "a template literal spanning lines",
      expected: [["`1\n0`", "10"]],
      fragment: "parseInt(`1\n0`, 10)",
    },
    {
      description: "a string that never closes",
      expected: [undefined],
      fragment: 'parseInt("abc',
    },
  ])("skips $description", ({ expected, fragment }) => {
    // Given/When/Then - what's inside is neither split nor counted
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual(
      expected
    );
  });

  test.each([
    {
      description: "a declaration",
      fragment: "function parseInt(text) { return 0; }",
    },
    {
      description: "a call after a line comment",
      fragment: "const a = 1; // parseInt(x, 16) is wrong",
    },
    {
      description: "a call on a block comment's star line",
      fragment: "/**\n * Use parseInt(x, 10).\n */",
    },
    {
      description: "a call on a block comment's opening line",
      fragment: "/* parseInt(x, 8) */",
    },
  ])("finds no call in $description", ({ fragment }) => {
    // Given/When/Then - none of these is a call
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual([]);
  });

  test.each([
    {
      description: "inside a block comment's unstarred line",
      fragment: "/*\n  parseInt(x, 16)\n*/",
    },
    {
      description: "inside a block comment that opened before the fragment",
      fragment: "  parseInt(x, 16)\n*/ const a = 1;",
    },
    {
      description: "inside a string",
      fragment: 'const s = "parseInt(x, 16)";',
    },
    {
      description: "a class method",
      fragment: "  parseInt(text, radix) {\n    return 0;",
    },
    {
      description: "a declaration file signature",
      fragment:
        "declare function f(): void;\n  parseInt(string: string, radix?: number): number;",
    },
    {
      description: "a static method signature",
      fragment: "  static parseInt(text: string): number;",
    },
  ])("finds no call $description", ({ fragment }) => {
    // Given/When/Then - none of these is a live call
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual([]);
  });

  test.each([
    {
      description: "after a closed block comment on its line",
      expected: [["x", "10"]],
      fragment: "/* a */ parseInt(x, 10)",
    },
    {
      description: "before a ternary's colon",
      expected: [["x"]],
      fragment: "const n = isHex ? parseInt(x) : 0;",
    },
    {
      description: "cut off, which can't be checked for a body",
      expected: [undefined],
      fragment: "  parseInt(text, ",
    },
  ])("finds a call $description", ({ expected, fragment }) => {
    // Given/When/Then - a live call is kept
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual(
      expected
    );
  });

  test("finds a call on the line after a comment", () => {
    // Given - a comment line, then a real call
    const fragment = "// radix matters\nparseInt(x, 10)";

    // When - splitting its calls
    const calls = splitCalls({ callee: "parseInt", fragment });

    // Then - only the comment line is skipped
    expect(calls).toStrictEqual([["x", "10"]]);
  });
});

describe("splitCalls scanning", () => {
  test.each([
    {
      description: "before a regex ending in `*`, which isn't a comment close",
      expected: [["s", "10"]],
      fragment: 'const n = parseInt(s, 10); const t = s.replace(/^\\s*/, "");',
    },
    {
      description: "before a glob string holding `*/`",
      expected: [["s", "10"]],
      fragment: 'const n = parseInt(s, 10); const glob = "**/x";',
    },
    {
      description: "after a JSX closing tag",
      expected: [["b", "10"]],
      fragment: "<td>{a}</td><td>{parseInt(b, 10)}</td>",
    },
    {
      description: "inside a template interpolation",
      expected: [["x", "16"]],
      fragment: "const s = `${parseInt(x, 16)} px`;",
    },
    {
      description: "inside a template nested in an interpolation",
      expected: [["c"]],
      fragment: "const s = `${a ? `b` : parseInt(c)}`;",
    },
    {
      description: "inside an object literal in an interpolation",
      expected: [["x"]],
      fragment: "const s = `${{ a: parseInt(x) }.a}`;",
    },
    {
      description: "with a template argument holding an interpolation",
      expected: [["`${a}`", "10"]],
      fragment: "parseInt(`${a}`, 10)",
    },
    {
      description: "with a regex after `return`",
      expected: [["f(() => { return /[(]/.test(s) })", "10"]],
      fragment: "parseInt(f(() => { return /[(]/.test(s) }), 10)",
    },
    {
      description: "after a regex that starts the fragment",
      expected: [["x"]],
      fragment: "/re/.source + parseInt(x)",
    },
    {
      description: "on its own line in a multi-line ternary",
      expected: [["x", "16"]],
      fragment: "const v = cond ?\n  parseInt(x, 16) :\n  0;",
    },
    {
      description: "on a multiplication's continuation line",
      expected: [["scale", "10"]],
      fragment: "const px = base\n  * parseInt(scale, 10);",
    },
    {
      description: "with an interpolation the fragment cuts off",
      expected: [undefined],
      fragment: "parseInt(`${x",
    },
  ])("finds a call $description", ({ expected, fragment }) => {
    // Given/When/Then - the scan keeps what's code
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual(
      expected
    );
  });

  test.each([
    {
      description: "a signature without parameters",
      fragment: "  parseInt(): number;",
    },
    {
      description: "doc-comment lines whose close the fragment doesn't reach",
      fragment: " * Use parseInt(x, 10).\n * More.",
    },
  ])("finds no call in $description", ({ fragment }) => {
    // Given/When/Then - neither is a live call
    expect(splitCalls({ callee: "parseInt", fragment })).toStrictEqual([]);
  });
});
