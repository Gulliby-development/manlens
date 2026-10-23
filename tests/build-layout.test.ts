import { expect, test } from "bun:test";
import type { Block } from "../src/doc/blocks";
import { buildDoc } from "../src/doc/build";
import type { Problem } from "../src/roff/lines";

test("title and physical-line examples preserve every title field", () => {
  const empty = buildDoc("");
  expect(empty.title).toBeNull();
  expect(empty.lines).toBe(0);
  expect(empty.problems).toEqual([]);

  const basic = buildDoc(".TH T 1\n");
  expect(basic.title).toEqual({ name: "T", section: "1", date: "", source: "", manual: "" });
  expect(basic.lines).toBe(1);

  const complete = buildDoc('.TH TOOL 8 "2026-01-05" "tool 2.1" "Tool Manual"\n');
  expect(complete.title).toEqual({
    name: "TOOL",
    section: "8",
    date: "2026-01-05",
    source: "tool 2.1",
    manual: "Tool Manual",
  });
  expect(complete.lines).toBe(1);

  const textFirst = buildDoc("text\n");
  expect(textFirst.title).toBeNull();
  expect(textFirst.lines).toBe(1);
  expect(textFirst.problems).toEqual([
    { line: 1, col: 1, code: "MN007", text: "the page does not start with TH" },
  ]);
});

test("paragraphs, blank lines, br, and sp produce exact item segments and gaps", () => {
  const doc = buildDoc(".TH T 1\nfirst\n.br\nsecond\n\nthird\n.sp 3\n.sp 1\nfourth\n.PP\nlast\n");

  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [
        { gap: 0, words: [[{ text: "first", font: "R" }]] },
        { gap: 0, words: [[{ text: "second", font: "R" }]] },
        { gap: 1, words: [[{ text: "third", font: "R" }]] },
        { gap: 3, words: [[{ text: "fourth", font: "R" }]] },
      ],
    },
    {
      kind: "item",
      line: 11,
      gap: 1,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "last", font: "R" }]] }],
    },
  ]);
});

test("TP and IP tags preserve inherited indentation and source lines", () => {
  const doc = buildDoc(
    '.TH T 1\n.TP 8\n\n.sp x\n.B tag\nbody\n.TP\nnext\n.IP "" 4\n.IP long\\ label 4\n',
  );

  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 1,
      margin: 7,
      indent: 8,
      tag: [{ text: "tag", font: "B" }],
      segs: [{ gap: 0, words: [[{ text: "body", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 7,
      gap: 1,
      margin: 7,
      indent: 8,
      tag: [{ text: "next", font: "R" }],
      segs: [],
    },
    { kind: "item", line: 9, gap: 1, margin: 7, indent: 4, tag: null, segs: [] },
    {
      kind: "item",
      line: 10,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "long\u0001label", font: "R" }],
      segs: [],
    },
  ]);

  const invalid = buildDoc(".TH T 1\n.TP 8\ntag\n.TP x\nfallback\n.IP other x\nafter\n");
  expect(invalid.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 1,
      margin: 7,
      indent: 8,
      tag: [{ text: "tag", font: "R" }],
      segs: [],
    },
    {
      kind: "item",
      line: 4,
      gap: 1,
      margin: 7,
      indent: 8,
      tag: [{ text: "fallback", font: "R" }],
      segs: [],
    },
    {
      kind: "item",
      line: 6,
      gap: 1,
      margin: 7,
      indent: 8,
      tag: [{ text: "other", font: "R" }],
      segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
    },
  ]);
});

test("awaited tags survive ignored layout and title requests and accept empty tags", () => {
  const doc = buildDoc(
    '.TH T 1\n.TP 3\n\n.br\n.sp x\n.TH X 1\n.ZZ ignored\n.B ""\nbody\n.TP\n.PP\nafter\n',
  );

  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 1,
      margin: 7,
      indent: 3,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "body", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 12,
      gap: 1,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
    },
  ]);
  expect(doc.problems).toEqual([
    { line: 6, col: 1, code: "MN008", text: "TH appears more than once" },
    { line: 7, col: 2, code: "MN003", text: 'unknown request "ZZ"' },
  ]);
});

test.each<{ name: string; page: string; blocks: Block[]; problems: Problem[] }>([
  {
    name: "PP",
    page: ".TH T 1\n.TP\n.PP\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 4,
        gap: 1,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [],
  },
  {
    name: "P",
    page: ".TH T 1\n.TP\n.P\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 4,
        gap: 1,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [],
  },
  {
    name: "LP",
    page: ".TH T 1\n.TP\n.LP\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 4,
        gap: 1,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [],
  },
  {
    name: "TP",
    page: ".TH T 1\n.TP\n.TP 4\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 3,
        gap: 1,
        margin: 7,
        indent: 4,
        tag: [{ text: "after", font: "R" }],
        segs: [],
      },
    ],
    problems: [],
  },
  {
    name: "IP",
    page: ".TH T 1\n.TP\n.IP tag 3\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 3,
        gap: 1,
        margin: 7,
        indent: 3,
        tag: [{ text: "tag", font: "R" }],
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [],
  },
  {
    name: "RS",
    page: ".TH T 1\n.TP\n.RS 2\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 4,
        gap: 1,
        margin: 9,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [
      { line: 3, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
    ],
  },
  {
    name: "RE",
    page: ".TH T 1\n.TP\n.RE\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 4,
        gap: 1,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [{ line: 3, col: 1, code: "MN009", text: "RE without RS" }],
  },
  {
    name: "nf",
    page: ".TH T 1\n.TP\n.nf\nafter\n",
    blocks: [
      {
        kind: "pre",
        line: 4,
        margin: 7,
        indent: 7,
        rows: [{ gap: 1, runs: [{ text: "after", font: "R" }] }],
      },
    ],
    problems: [
      { line: 3, col: 1, code: "MN012", text: "nf is not closed before the end of its section" },
    ],
  },
  {
    name: "fi",
    page: ".TH T 1\n.TP\n.fi\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 4,
        gap: 1,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [{ line: 3, col: 1, code: "MN013", text: "fi without nf" }],
  },
  {
    name: "SH with arguments",
    page: ".TH T 1\n.TP\n.SH NAME\nafter\n",
    blocks: [
      { kind: "heading", level: 1, line: 3, gap: 1, runs: [{ text: "NAME", font: "R" }] },
      {
        kind: "item",
        line: 4,
        gap: 0,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [],
  },
  {
    name: "SS with arguments",
    page: ".TH T 1\n.TP\n.SS sub\nafter\n",
    blocks: [
      { kind: "heading", level: 2, line: 3, gap: 1, runs: [{ text: "sub", font: "R" }] },
      {
        kind: "item",
        line: 4,
        gap: 0,
        margin: 7,
        indent: 0,
        tag: null,
        segs: [{ gap: 0, words: [[{ text: "after", font: "R" }]] }],
      },
    ],
    problems: [],
  },
  {
    name: "SH without arguments",
    page: ".TH T 1\n.TP\n.SH\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 2,
        gap: 1,
        margin: 7,
        indent: 7,
        tag: [{ text: "after", font: "R" }],
        segs: [],
      },
    ],
    problems: [{ line: 3, col: 1, code: "MN005", text: "SH needs arguments" }],
  },
  {
    name: "SS without arguments",
    page: ".TH T 1\n.TP\n.SS\nafter\n",
    blocks: [
      {
        kind: "item",
        line: 2,
        gap: 1,
        margin: 7,
        indent: 7,
        tag: [{ text: "after", font: "R" }],
        segs: [],
      },
    ],
    problems: [{ line: 3, col: 1, code: "MN005", text: "SS needs arguments" }],
  },
  {
    name: "EOF",
    page: ".TH T 1\n.TP\n",
    blocks: [],
    problems: [],
  },
])(
  "awaited tag cancellation by $name follows the state transitions",
  ({ page, blocks, problems }) => {
    const doc = buildDoc(page);
    expect(doc.blocks).toEqual(blocks);
    expect(doc.problems).toEqual(problems);
  },
);

test("nested RS margins use PI defaults and section recovery resets PI and BI", () => {
  const doc = buildDoc(
    ".TH T 1\n.TP 4\n.B tag\nbody\n.RS\ninside\n.RS 3\ndeep\n.RE\nafter inner\n.SH NAME\nreset\n",
  );

  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "tag", font: "B" }],
      segs: [{ gap: 0, words: [[{ text: "body", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 6,
      gap: 0,
      margin: 11,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "inside", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 8,
      gap: 0,
      margin: 14,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "deep", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 10,
      gap: 0,
      margin: 11,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "after", font: "R" }], [{ text: "inner", font: "R" }]] }],
    },
    { kind: "heading", level: 1, line: 11, gap: 1, runs: [{ text: "NAME", font: "R" }] },
    {
      kind: "item",
      line: 12,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "reset", font: "R" }]] }],
    },
  ]);
  expect(doc.problems).toEqual([
    { line: 5, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
  ]);
});

test("no-fill blocks preserve expanded tabs, empty rows, gaps, and the first nf line", () => {
  const doc = buildDoc(".TH T 1\n.IP tag 4\n.nf\na   b\nab\tx  \n\n.B bold request\n.fi\n");

  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "tag", font: "R" }],
      segs: [],
    },
    {
      kind: "pre",
      line: 4,
      margin: 7,
      indent: 4,
      rows: [
        { gap: 0, runs: [{ text: "a   b", font: "R" }] },
        { gap: 0, runs: [{ text: "ab      x", font: "R" }] },
        {
          gap: 1,
          runs: [
            { text: "bold", font: "B" },
            { text: " ", font: "R" },
            { text: "request", font: "B" },
          ],
        },
      ],
    },
  ]);

  const emptyRows = buildDoc(".TH T 1\n.nf\n\n\n\\&\n.nf\n\ntext\n.nf\n.fi\n");
  expect(emptyRows.blocks).toEqual([
    {
      kind: "pre",
      line: 5,
      margin: 7,
      indent: 0,
      rows: [
        { gap: 2, runs: [] },
        { gap: 1, runs: [{ text: "text", font: "R" }] },
      ],
    },
  ]);
  expect(emptyRows.problems).toEqual([]);

  const repeatedNf = buildDoc(".TH T 1\n.nf\na\n.nf\nb\n.fi\n");
  expect(repeatedNf.blocks).toEqual([
    {
      kind: "pre",
      line: 3,
      margin: 7,
      indent: 0,
      rows: [
        { gap: 0, runs: [{ text: "a", font: "R" }] },
        { gap: 0, runs: [{ text: "b", font: "R" }] },
      ],
    },
  ]);
  expect(repeatedNf.problems).toEqual([]);
});

test("font requests keep alternating runs and split words with their requested fonts", () => {
  const doc = buildDoc(
    '.TH T 1\n.BR fetcher.conf (5)\n.I it\n.BR bold roman " spaced words" tail\n.B bold roman\n.I italic roman\n.BR b r\n.BI b i\n.IB i b\n.IR i r\n.RB r b\n.RI r i\n',
  );

  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [
        {
          gap: 0,
          words: [
            [
              { text: "fetcher.conf", font: "B" },
              { text: "(5)", font: "R" },
            ],
            [{ text: "it", font: "I" }],
            [
              { text: "bold", font: "B" },
              { text: "roman", font: "R" },
            ],
            [{ text: "spaced", font: "B" }],
            [
              { text: "words", font: "B" },
              { text: "tail", font: "R" },
            ],
            [{ text: "bold", font: "B" }],
            [{ text: "roman", font: "B" }],
            [{ text: "italic", font: "I" }],
            [{ text: "roman", font: "I" }],
            [
              { text: "b", font: "B" },
              { text: "r", font: "R" },
            ],
            [
              { text: "b", font: "B" },
              { text: "i", font: "I" },
            ],
            [
              { text: "i", font: "I" },
              { text: "b", font: "B" },
            ],
            [
              { text: "i", font: "I" },
              { text: "r", font: "R" },
            ],
            [
              { text: "r", font: "R" },
              { text: "b", font: "B" },
            ],
            [
              { text: "r", font: "R" },
              { text: "i", font: "I" },
            ],
          ],
        },
      ],
    },
  ]);
});

test("paragraph aliases, section recovery, and empty decoded content retain layout", () => {
  const paragraphs = buildDoc(".TH T 1\nfirst\n.PP\nsecond\n.P\nthird\n.LP\nlast\n");
  expect(paragraphs.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "first", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 4,
      gap: 1,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "second", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 6,
      gap: 1,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "third", font: "R" }]] }],
    },
    {
      kind: "item",
      line: 8,
      gap: 1,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "last", font: "R" }]] }],
    },
  ]);

  const recovery = buildDoc(".TH T 1\n.IP tag 4\n.RS 2\n.nf\ncode\n.SH NAME\ntext\n");
  expect(recovery.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "tag", font: "R" }],
      segs: [],
    },
    {
      kind: "pre",
      line: 5,
      margin: 9,
      indent: 0,
      rows: [{ gap: 0, runs: [{ text: "code", font: "R" }] }],
    },
    { kind: "heading", level: 1, line: 6, gap: 1, runs: [{ text: "NAME", font: "R" }] },
    {
      kind: "item",
      line: 7,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "text", font: "R" }]] }],
    },
  ]);
  expect(recovery.problems).toEqual([
    { line: 3, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
    { line: 4, col: 1, code: "MN012", text: "nf is not closed before the end of its section" },
  ]);

  const headings = buildDoc(".TH T 1\n.SH TWO words\n.SS three more words\n");
  expect(headings.blocks).toEqual([
    {
      kind: "heading",
      level: 1,
      line: 2,
      gap: 1,
      runs: [{ text: "TWO words", font: "R" }],
    },
    {
      kind: "heading",
      level: 2,
      line: 3,
      gap: 1,
      runs: [{ text: "three more words", font: "R" }],
    },
  ]);

  const emptyContent = buildDoc(".TH T 1\n\\&\n.br\n.B \\&\n");
  expect(emptyContent.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [
        { gap: 0, words: [] },
        { gap: 0, words: [] },
      ],
    },
  ]);
});
