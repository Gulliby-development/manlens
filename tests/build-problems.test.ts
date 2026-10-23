import { expect, test } from "bun:test";
import { buildDoc } from "../src/doc/build";

test("first content, blank-only pages, and malformed or repeated TH", () => {
  expect(buildDoc(' \n.\\" comment\n.   \n')).toEqual({
    title: null,
    blocks: [],
    problems: [],
    lines: 3,
  });
  expect(buildDoc(".TH A\n.TH B 1\n")).toEqual({
    title: null,
    blocks: [],
    problems: [
      { line: 1, col: 1, code: "MN005", text: "TH needs a name and a section" },
      { line: 2, col: 1, code: "MN008", text: "TH appears more than once" },
    ],
    lines: 2,
  });
  expect(buildDoc(" \ntext\n")).toMatchObject({
    lines: 2,
    problems: [{ line: 2, col: 1, code: "MN007", text: "the page does not start with TH" }],
  });
});

test("TH decodes only its first five arguments and IP only its tag", () => {
  const doc = buildDoc(".TH A 1 \\q d s m \\z\n.TH B 1 \\z\n.IP \\q 4 \\z\n");
  expect(doc.title).toEqual({ name: "A", section: "1", date: "q", source: "d", manual: "s" });
  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 3,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "q", font: "R" }],
      segs: [],
    },
  ]);
  expect(doc.problems).toEqual([
    { line: 1, col: 9, code: "MN002", text: 'unknown escape "\\q"' },
    { line: 2, col: 1, code: "MN008", text: "TH appears more than once" },
    { line: 3, col: 5, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
});

test("text escape columns count ASCII, accented, astral, tabs, and original no-fill text", () => {
  expect(buildDoc(".TH T 1\na\\qb\n").problems).toEqual([
    { line: 2, col: 2, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
  expect(buildDoc(".TH T 1\naé\\qb\n").problems).toEqual([
    { line: 2, col: 3, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
  expect(buildDoc(".TH T 1\na😀\\qb\n").problems).toEqual([
    { line: 2, col: 4, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
  expect(buildDoc(".TH T 1\n  \t\\q\n").problems).toEqual([
    { line: 2, col: 4, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
  expect(buildDoc(".TH T 1\n.nf\n\t\\q\n.fi\n").problems).toEqual([
    { line: 3, col: 2, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
});

test("request escape columns use argument starts through quotes and continuations", () => {
  expect(buildDoc('.TH T 1\n.B ab \\q "x \\q"\n').problems).toEqual([
    { line: 2, col: 7, code: "MN002", text: 'unknown escape "\\q"' },
    { line: 2, col: 10, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
  expect(buildDoc('.TH T 1\n.B "a ""b"" c" \\q\n').problems).toEqual([
    { line: 2, col: 16, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
  expect(buildDoc(".TH T 1\n.B x\\\n\\q\n").problems).toEqual([
    { line: 2, col: 4, code: "MN002", text: 'unknown escape "\\q"' },
  ]);
});

test("unknown requests retain tokenizer diagnostics without decoding their arguments", () => {
  expect(buildDoc('.TH T 1\n. XY \\q\n.XX "open \\q\n')).toEqual({
    title: { name: "T", section: "1", date: "", source: "", manual: "" },
    blocks: [],
    problems: [
      { line: 2, col: 3, code: "MN003", text: 'unknown request "XY"' },
      { line: 3, col: 2, code: "MN003", text: 'unknown request "XX"' },
      { line: 3, col: 5, code: "MN004", text: "unterminated quoted argument" },
    ],
    lines: 3,
  });
  expect(buildDoc(". XY\n").problems).toEqual([
    { line: 1, col: 1, code: "MN007", text: "the page does not start with TH" },
    { line: 1, col: 3, code: "MN003", text: 'unknown request "XY"' },
  ]);
});

test("missing heading and font arguments diagnose without closing open content", () => {
  const content = buildDoc(".TH T 1\nbefore\n.SH\nafter\n.SS\n");
  expect(content.blocks).toEqual([
    {
      kind: "item",
      line: 2,
      gap: 0,
      margin: 7,
      indent: 0,
      tag: null,
      segs: [{ gap: 0, words: [[{ text: "before", font: "R" }], [{ text: "after", font: "R" }]] }],
    },
  ]);
  expect(content.problems).toEqual([
    { line: 3, col: 1, code: "MN005", text: "SH needs arguments" },
    { line: 5, col: 1, code: "MN005", text: "SS needs arguments" },
  ]);
  expect(buildDoc(".TH T 1\n.B\n.I\n.BR\n.BI\n.IB\n.IR\n.RB\n.RI\n").problems).toEqual([
    { line: 2, col: 1, code: "MN005", text: "B needs arguments" },
    { line: 3, col: 1, code: "MN005", text: "I needs arguments" },
    { line: 4, col: 1, code: "MN005", text: "BR needs arguments" },
    { line: 5, col: 1, code: "MN005", text: "BI needs arguments" },
    { line: 6, col: 1, code: "MN005", text: "IB needs arguments" },
    { line: 7, col: 1, code: "MN005", text: "IR needs arguments" },
    { line: 8, col: 1, code: "MN005", text: "RB needs arguments" },
    { line: 9, col: 1, code: "MN005", text: "RI needs arguments" },
  ]);
});

test("invalid numbers report argument columns, preserve PI, and ignore sp while awaiting TP", () => {
  const doc = buildDoc(".TH T 1\n.TP 4\n.TP x\n.sp x\ntag\n.IP tag x\n.RS 101\n.RE\n.sp 7nn\n");
  expect(doc.blocks).toEqual([
    {
      kind: "item",
      line: 3,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "tag", font: "R" }],
      segs: [],
    },
    {
      kind: "item",
      line: 6,
      gap: 1,
      margin: 7,
      indent: 4,
      tag: [{ text: "tag", font: "R" }],
      segs: [],
    },
  ]);
  expect(doc.problems).toEqual([
    { line: 3, col: 5, code: "MN006", text: 'invalid number "x"' },
    { line: 6, col: 9, code: "MN006", text: 'invalid number "x"' },
    { line: 7, col: 5, code: "MN006", text: 'invalid number "101"' },
    { line: 9, col: 5, code: "MN006", text: 'invalid number "7nn"' },
  ]);

  const rsFallback = buildDoc(".TH T 1\n.TP 4\ntag\n.RS x\nbody\n.RE\n");
  expect(rsFallback.blocks[1]).toMatchObject({ kind: "item", margin: 11 });
  expect(rsFallback.problems).toEqual([
    { line: 4, col: 5, code: "MN006", text: 'invalid number "x"' },
  ]);
});

test("heading and EOF recovery report original nf and RS opening lines", () => {
  const section = buildDoc(".TH T 1\n.RS 2\n.RS 3\n.nf\n.nf\n.SH NAME\n.fi\n.RE\n");
  expect(section.problems).toEqual([
    { line: 2, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
    { line: 3, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
    { line: 4, col: 1, code: "MN012", text: "nf is not closed before the end of its section" },
    { line: 7, col: 1, code: "MN013", text: "fi without nf" },
    { line: 8, col: 1, code: "MN009", text: "RE without RS" },
  ]);
  expect(buildDoc(".TH T 1\n.nf\n.RS\n").problems).toEqual([
    { line: 2, col: 1, code: "MN012", text: "nf is not closed before the end of its section" },
    { line: 3, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
  ]);
});

test("semantic and reader diagnostics sort fully and preserve same-code discovery order", () => {
  expect(buildDoc(".RE\n.B \\q\\z\n").problems).toEqual([
    { line: 1, col: 1, code: "MN007", text: "the page does not start with TH" },
    { line: 1, col: 1, code: "MN009", text: "RE without RS" },
    { line: 2, col: 4, code: "MN002", text: 'unknown escape "\\q"' },
    { line: 2, col: 4, code: "MN002", text: 'unknown escape "\\z"' },
  ]);
  expect(
    buildDoc(
      'text before TH \\q here\n.TH A\n.TH B 1\n.SH NAMES\n.XX arg\n.B "open quote\n.BR\n.TP x\n.RE\n.RS\n.RS 200\n',
    ).problems,
  ).toEqual([
    { line: 1, col: 1, code: "MN007", text: "the page does not start with TH" },
    { line: 1, col: 16, code: "MN002", text: 'unknown escape "\\q"' },
    { line: 2, col: 1, code: "MN005", text: "TH needs a name and a section" },
    { line: 3, col: 1, code: "MN008", text: "TH appears more than once" },
    { line: 4, col: 1, code: "MN011", text: "the first section is not NAME" },
    { line: 5, col: 2, code: "MN003", text: 'unknown request "XX"' },
    { line: 6, col: 4, code: "MN004", text: "unterminated quoted argument" },
    { line: 7, col: 1, code: "MN005", text: "BR needs arguments" },
    { line: 8, col: 5, code: "MN006", text: 'invalid number "x"' },
    { line: 9, col: 1, code: "MN009", text: "RE without RS" },
    { line: 10, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
    { line: 11, col: 1, code: "MN010", text: "RS is not closed before the end of its section" },
    { line: 11, col: 5, code: "MN006", text: 'invalid number "200"' },
  ]);
  expect(buildDoc(".nf\n.fi\n.fi\n.sp 7n\n.SH OTHER\n.nf\nlast\\\n").problems).toEqual([
    { line: 1, col: 1, code: "MN007", text: "the page does not start with TH" },
    { line: 3, col: 1, code: "MN013", text: "fi without nf" },
    { line: 5, col: 1, code: "MN011", text: "the first section is not NAME" },
    { line: 6, col: 1, code: "MN012", text: "nf is not closed before the end of its section" },
    { line: 7, col: 5, code: "MN001", text: "backslash at the end of the input" },
  ]);
});
