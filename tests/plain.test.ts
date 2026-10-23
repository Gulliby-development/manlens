import { expect, test } from "bun:test";
import { Fail } from "../src/base/fail";
import { ARGS, FLAGS, runRender, USAGE, VALUES } from "../src/cli/cmd-render";
import { buildDoc } from "../src/doc/build";
import { renderDoc } from "../src/render/plain";

const FakeIo = {
  files: new Map<string, Uint8Array>(),
  stdin: new Uint8Array(),
  outText: "",
  errText: "",
  readStdin(): Uint8Array {
    return this.stdin;
  },
  readFile(path: string): Uint8Array {
    const data = this.files.get(path);
    if (data === undefined) {
      throw new Error("no such file");
    }
    return data;
  },
  out(text: string): void {
    this.outText += text;
  },
  err(text: string): void {
    this.errText += text;
  },
};

test.each([
  ["", 30, false, ""],
  ['.SS ""\n', 30, false, "\n"],
  [".TH T 1\n", 30, false, "T(1)\n"],
  [".TH T 1\n.SH NAME\n.SS Options\n", 30, false, "T(1)\n\nNAME\n\n   Options\n"],
  [
    ".TH T 1\n.SH NAME\n.SS Options\n",
    30,
    true,
    "T(1)\n\n\u001b[1mNAME\u001b[22m\n\n   \u001b[1mOptions\u001b[22m\n",
  ],
] as const)("renders empty documents, titles and headings", (page, width, ansi, expected) => {
  expect(renderDoc(buildDoc(page), width, ansi)).toBe(expected);
});

test.each([
  [
    ".TP 8\n.B \\-v\nFits.\n.TP\n.B \\-\\-verbose\nToo long.\n",
    30,
    false,
    "       -v      Fits.\n\n       --verbose\n               Too long.\n",
  ],
  [
    '.TP 8\n\\-n\n.sp 2\nTwo blank lines.\n.IP "" 4\nNo tag, indent 4.\n.IP 1. 4\nShares.\n',
    30,
    false,
    "       -n\n\n\n               Two blank\n               lines.\n\n           No tag, indent 4.\n\n       1.  Shares.\n",
  ],
  [
    ".IP long\\ label 4\nNot shared, tag 10 wide.\n.IP a 1\nNot shared, 1 is not more than 1.\n",
    30,
    false,
    "       long label\n           Not shared, tag 10\n           wide.\n\n       a\n        Not shared, 1 is not\n        more than 1.\n",
  ],
] as const)(
  "renders item tags, strict sharing, empty tags and segment gaps",
  (page, width, ansi, expected) => {
    expect(renderDoc(buildDoc(page), width, ansi)).toBe(expected);
  },
);

test.each([
  [
    "first line\n.br\nafter br\n\nafter a blank line\n.sp 3\n.sp 1\nafter sp 3 and sp 1\n.PP\nnew paragraph\n",
    30,
    false,
    "       first line\n       after br\n\n       after a blank line\n\n\n\n       after sp 3 and sp 1\n\n       new paragraph\n",
  ],
  [
    ".RS\ninside RS (7)\n.RS 3\ninside RS 3\n.RE\n.RE\nback\n",
    30,
    false,
    "              inside RS (7)\n                 inside RS 3\n       back\n",
  ],
  [".sp 3\nfirst\n.sp 3\n", 30, false, "       first\n"],
] as const)("renders pending gaps, breaks and margins", (page, width, ansi, expected) => {
  expect(renderDoc(buildDoc(page), width, ansi)).toBe(expected);
});

test.each([
  ["w😀😀😀😀 x😀😀😀😀 y\n", 20, false, "       w😀😀😀😀\n       x😀😀😀😀 y\n"],
  [
    ".RS 20\nabcdefghijk x y\n.RE\n",
    20,
    false,
    "                           abcdefghijk\n                           x y\n",
  ],
  ["a\\ b c\n", 20, false, "       a b c\n"],
] as const)(
  "wraps by UTF-16 width and preserves intact oversized words",
  (page, width, ansi, expected) => {
    expect(renderDoc(buildDoc(page), width, ansi)).toBe(expected);
  },
);

test.each([
  [
    ".nf\na   b\n\ttab at the start\nab\ttab after two\n\n  indented\tt\n.B bold request\n.fi\nfilled again\n",
    30,
    false,
    "       a   b\n               tab at the start\n       ab      tab after two\n\n         indented      t\n       bold request\n       filled again\n",
  ],
  [
    '.BR bold roman " spaced words" tail\n.I it\n',
    78,
    true,
    "       \u001b[1mbold\u001b[22mroman \u001b[1mspaced\u001b[22m \u001b[1mwords\u001b[22mtail \u001b[4mit\u001b[24m\n",
  ],
  ["a\\ \n", 30, false, "       a\n"],
  [".B a\\ \n", 30, true, "       \u001b[1ma\u001b[22m\n"],
  ["a \\ \n", 30, false, "       a\n"],
  ["a\\ b\n", 30, false, "       a b\n"],
] as const)(
  "renders no-fill rows, escaped nonbreaking spaces and exact ANSI fonts",
  (page, width, ansi, expected) => {
    expect(renderDoc(buildDoc(page), width, ansi)).toBe(expected);
  },
);

test("renders literal empty pre rows, oversized pre text and title gap separation", () => {
  expect(
    renderDoc(
      {
        title: null,
        blocks: [
          {
            kind: "pre",
            line: 1,
            margin: 7,
            indent: 2,
            rows: [
              { gap: 0, runs: [] },
              { gap: 0, runs: [{ text: "abcdefghijklmnopqrstuvw", font: "R" }] },
            ],
          },
        ],
        problems: [],
        lines: 0,
      },
      20,
      false,
    ),
  ).toBe("\n         abcdefghijklmnopqrstuvw\n");
  expect(
    renderDoc(
      {
        title: { name: "T", section: "1", date: "", source: "", manual: "" },
        blocks: [
          { kind: "heading", level: 1, line: 2, gap: 3, runs: [{ text: "NAME", font: "R" }] },
        ],
        problems: [],
        lines: 2,
      },
      30,
      false,
    ),
  ).toBe("T(1)\n\n\n\nNAME\n");
});

test.each([
  ["19", 'invalid --width "19" (expected 20 to 200)'],
  ["080", 'invalid --width "080" (expected 20 to 200)'],
  ["2e1", 'invalid --width "2e1" (expected 20 to 200)'],
  ["201", 'invalid --width "201" (expected 20 to 200)'],
  ["", 'invalid --width "" (expected 20 to 200)'],
  ["+20", 'invalid --width "+20" (expected 20 to 200)'],
  ["20.0", 'invalid --width "20.0" (expected 20 to 200)'],
  ["２０", 'invalid --width "??" (expected 20 to 200)'],
] as const)("exports render metadata and rejects width %s before reading", (width, message) => {
  expect(USAGE).toBe("usage: manlens render [--width N] [--ansi] FILE");
  expect(ARGS).toEqual(["FILE"]);
  expect(FLAGS).toEqual(["--ansi"]);
  expect(VALUES).toEqual(["--width"]);
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(() => runRender(["nofile.1"], new Set(), new Map([["--width", width]]), FakeIo)).toThrow(
    new Fail(message),
  );
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test.each([
  ["20", "nofile.1: cannot read the file"],
  ["78", "nofile.1: cannot read the file"],
  ["200", "nofile.1: cannot read the file"],
  [undefined, "nofile.1: cannot read the file"],
] as const)("accepts width %s before attempting to read", (width, message) => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const values = width === undefined ? new Map<string, string>() : new Map([["--width", width]]);
  expect(() => runRender(["nofile.1"], new Set(), values, FakeIo)).toThrow(new Fail(message));
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("renders files, stdin, problem-bearing documents and ANSI output through the command", () => {
  FakeIo.files = new Map([["a.1", new TextEncoder().encode(".TH A 1\n")]]);
  FakeIo.stdin = new TextEncoder().encode(".TH S 1\n");
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runRender(["a.1"], new Set(), new Map(), FakeIo)).toEqual({ out: "A(1)\n", code: 0 });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map();
  FakeIo.stdin = new TextEncoder().encode(".TH S 1\n");
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runRender(["-"], new Set(), new Map(), FakeIo)).toEqual({ out: "S(1)\n", code: 0 });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map([["a.1", new TextEncoder().encode("text\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runRender(["a.1"], new Set(), new Map(), FakeIo)).toEqual({
    out: "       text\n",
    code: 0,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map();
  FakeIo.stdin = new TextEncoder().encode(".B bold\n");
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runRender(["-"], new Set(["--ansi"]), new Map(), FakeIo)).toEqual({
    out: "       \u001b[1mbold\u001b[22m\n",
    code: 0,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});
