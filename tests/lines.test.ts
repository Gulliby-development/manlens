import { expect, test } from "bun:test";
import { splitLines } from "../src/roff/lines";

test("empty input has no physical or logical lines", () => {
  expect(splitLines("")).toEqual({ lines: [], problems: [], count: 0 });
});

test("a single LF and consecutive blank physical lines are counted without a phantom line", () => {
  expect(splitLines("\n\n")).toEqual({
    lines: [
      { line: 1, text: "", comment: false },
      { line: 2, text: "", comment: false },
    ],
    problems: [],
    count: 2,
  });
});

test("final LF and absent final LF have the same physical line count", () => {
  expect(splitLines("page\n")).toEqual({
    lines: [{ line: 1, text: "page", comment: false }],
    problems: [],
    count: 1,
  });
  expect(splitLines("page")).toEqual({
    lines: [{ line: 1, text: "page", comment: false }],
    problems: [],
    count: 1,
  });
});

test("repeated continuations join text and preserve the first physical line number", () => {
  expect(splitLines("first\\\nsecond\\\nthird\nlast")).toEqual({
    lines: [
      { line: 1, text: "firstsecondthird", comment: false },
      { line: 4, text: "last", comment: false },
    ],
    problems: [],
    count: 4,
  });
});

test("even backslash runs remain while odd runs continue and retain paired backslashes", () => {
  expect(splitLines("even\\\\\nodd\\\\\\\nnext")).toEqual({
    lines: [
      { line: 1, text: "even\\\\", comment: false },
      { line: 2, text: "odd\\\\next", comment: false },
    ],
    problems: [],
    count: 3,
  });
});

test("an EOF continuation reports MN001 with or without a terminal LF", () => {
  expect(splitLines("x\\")).toEqual({
    lines: [{ line: 1, text: "x", comment: false }],
    problems: [{ line: 1, col: 2, code: "MN001", text: "backslash at the end of the input" }],
    count: 1,
  });
  expect(splitLines("x\\\n")).toEqual({
    lines: [{ line: 1, text: "x", comment: false }],
    problems: [{ line: 1, col: 2, code: "MN001", text: "backslash at the end of the input" }],
    count: 1,
  });
});

test("comments with blank prefixes are skips while ordinary blank prefixes are retained", () => {
  expect(splitLines(' \t\\"comment\n \t\n')).toEqual({
    lines: [
      { line: 1, text: " \t", comment: true },
      { line: 2, text: " \t", comment: false },
    ],
    problems: [],
    count: 2,
  });
});

test("escaped comment markers and continuation-before-comment ordering are distinguished", () => {
  expect(splitLines("pair \\\\u0022 stays\njoined\\\n\\\u0022 cut")).toEqual({
    lines: [
      { line: 1, text: "pair \\\\u0022 stays", comment: false },
      { line: 2, text: "joined", comment: true },
    ],
    problems: [],
    count: 3,
  });
});

test("joined UTF-16 columns include astral characters in EOF continuation diagnostics", () => {
  expect(splitLines("a😀\\\nz\\")).toEqual({
    lines: [{ line: 1, text: "a😀z", comment: false }],
    problems: [{ line: 1, col: 5, code: "MN001", text: "backslash at the end of the input" }],
    count: 2,
  });
});
