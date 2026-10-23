import { expect, test } from "bun:test";
import { NB } from "../src/inline/glyphs";
import { decode, joinWords, mergeRuns, type Run, runsText, splitWords } from "../src/inline/spans";

test("decodes recognized escapes, glyphs, controls, and empty input", () => {
  expect(decode(String.raw`\\\e\-\ \&\%`, "R")).toEqual({
    runs: [{ text: "\\\\-\u0001", font: "R" }],
    bad: [],
  });
  expect(decode(String.raw`\(em\(en\(hy\(bu\(co\(rg\(lq\(rq\(dq\(oq\(cq\(aq`, "I")).toEqual({
    runs: [{ text: "----o(C)(R)\"\"\"'''", font: "I" }],
    bad: [],
  });
  expect(decode("p\u0001q\u007fr\u0085s t\t\uFEFF😀", "R")).toEqual({
    runs: [{ text: "p?q?r?s t\t\uFEFF😀", font: "R" }],
    bad: [],
  });
  expect(decode("", "B")).toEqual({ runs: [], bad: [] });
  expect(NB).toBe("\u0001");
});

test("reports generic unknown escapes at UTF-16 offsets", () => {
  expect(decode(String.raw`a\qb`, "R")).toEqual({
    runs: [{ text: "aqb", font: "R" }],
    bad: [{ at: 1, text: String.raw`\q` }],
  });
  expect(decode("aé\\qb", "R")).toEqual({
    runs: [{ text: "aéqb", font: "R" }],
    bad: [{ at: 2, text: String.raw`\q` }],
  });
  expect(decode("a😀\\qb", "R")).toEqual({
    runs: [{ text: "a😀qb", font: "R" }],
    bad: [{ at: 3, text: String.raw`\q` }],
  });
  expect(decode("  \t\\q", "R")).toEqual({
    runs: [{ text: "  \tq", font: "R" }],
    bad: [{ at: 3, text: String.raw`\q` }],
  });
});

test("consumes invalid and truncated escapes by whole code points", () => {
  expect(decode("\\😀x\\f😀y\\(😀xz", "B")).toEqual({
    runs: [{ text: "😀xyz", font: "B" }],
    bad: [
      { at: 0, text: "\\😀" },
      { at: 4, text: "\\f😀" },
      { at: 9, text: "\\(😀x" },
    ],
  });
  expect(decode("\\fZx\\(zzY\\" + "\u0001", "I")).toEqual({
    runs: [{ text: "xY?", font: "I" }],
    bad: [
      { at: 0, text: String.raw`\fZ` },
      { at: 4, text: String.raw`\(zz` },
      { at: 9, text: "\\\u0001" },
    ],
  });
  expect(decode("\\", "R")).toEqual({
    runs: [],
    bad: [{ at: 0, text: "\\" }],
  });
  expect(decode(String.raw`\f`, "R")).toEqual({
    runs: [],
    bad: [{ at: 0, text: String.raw`\f` }],
  });
  expect(decode(String.raw`\(`, "R")).toEqual({
    runs: [],
    bad: [{ at: 0, text: String.raw`\(` }],
  });
  expect(decode("\\(😀", "R")).toEqual({
    runs: [],
    bad: [{ at: 0, text: "\\(😀" }],
  });
});

test("tracks current and previous font across font swaps", () => {
  expect(decode(String.raw`\fBb\fIi\fPb2\fPi2\fRr`, "R")).toEqual({
    runs: [
      { text: "b", font: "B" },
      { text: "i", font: "I" },
      { text: "b2", font: "B" },
      { text: "i2", font: "I" },
      { text: "r", font: "R" },
    ],
    bad: [],
  });
  expect(decode(String.raw`a\fPb\fPc`, "B")).toEqual({
    runs: [
      { text: "a", font: "B" },
      { text: "b", font: "R" },
      { text: "c", font: "B" },
    ],
    bad: [],
  });
});

test("updates font history on repeated assignments and drops zero-output escapes", () => {
  expect(decode(String.raw`\fB\fBx\fPy`, "R")).toEqual({
    runs: [{ text: "xy", font: "B" }],
    bad: [],
  });
  expect(decode(String.raw`\fI\fR\fRx\fPy`, "B")).toEqual({
    runs: [{ text: "xy", font: "R" }],
    bad: [],
  });
  expect(decode(String.raw`\fB\&a\%b\fR`, "R")).toEqual({
    runs: [{ text: "ab", font: "B" }],
    bad: [],
  });
});

test("splits words only on spaces and tabs while preserving run fonts", () => {
  expect(splitWords([])).toEqual([]);
  expect(splitWords([{ text: " \t", font: "R" }])).toEqual([]);
  expect(
    splitWords([
      { text: " a\u0001b c\t", font: "B" },
      { text: "d", font: "I" },
      { text: "e", font: "I" },
      { text: " f", font: "R" },
    ]),
  ).toEqual([
    [{ text: "a\u0001b c", font: "B" }],
    [{ text: "de", font: "I" }],
    [{ text: "f", font: "R" }],
  ]);
  expect(
    splitWords([
      { text: "a", font: "B" },
      { text: "b", font: "I" },
    ]),
  ).toEqual([
    [
      { text: "a", font: "B" },
      { text: "b", font: "I" },
    ],
  ]);
  expect(splitWords([{ text: "\uFEFFx", font: "R" }])).toEqual([[{ text: "\uFEFFx", font: "R" }]]);
});

test("joins words with one roman space and normalizes runs", () => {
  expect(joinWords([])).toEqual([]);
  expect(joinWords([[{ text: "a", font: "R" }], [{ text: "b", font: "R" }]])).toEqual([
    { text: "a b", font: "R" },
  ]);
  expect(joinWords([[{ text: "a\u0001b", font: "B" }], [{ text: "c", font: "I" }]])).toEqual([
    { text: "a\u0001b", font: "B" },
    { text: " ", font: "R" },
    { text: "c", font: "I" },
  ]);
});

test("renders nonbreaking markers as spaces without changing nonbreaking spaces", () => {
  expect(runsText([])).toBe("");
  expect(
    runsText([
      { text: "a\u0001b", font: "B" },
      { text: " c", font: "I" },
    ]),
  ).toBe("a b c");
});

test("merges adjacent equal-font runs into fresh objects without mutation", () => {
  expect(mergeRuns([])).toEqual([]);
  const input: Run[] = [
    { text: "", font: "I" },
    { text: "a", font: "B" },
    { text: "", font: "R" },
    { text: "b", font: "B" },
    { text: "c", font: "I" },
  ];
  const snapshot = input.map((run) => ({ ...run }));
  const merged = mergeRuns(input);
  expect(merged).toEqual([
    { text: "ab", font: "B" },
    { text: "c", font: "I" },
  ]);
  expect(input).toEqual(snapshot);
  expect(input).not.toBe(merged);
  expect(merged[0]).not.toBe(input[1]);
  expect(merged[1]).not.toBe(input[4]);
});
