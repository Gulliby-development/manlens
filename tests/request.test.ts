import { expect, test } from "bun:test";
import { splitLines } from "../src/roff/lines";
import { classify } from "../src/roff/request";

test("comment-only whitespace is a skip and ordinary whitespace is blank", () => {
  expect(classify({ line: 1, text: " \t", comment: true })).toEqual({ kind: "skip" });
  expect(classify({ line: 2, text: " \t", comment: false })).toEqual({ kind: "blank" });
});

test("leading blanks prevent request classification and non-ASCII blanks remain text", () => {
  expect(classify({ line: 1, text: " \t.B x", comment: false })).toEqual({
    kind: "text",
    text: " \t.B x",
  });
  expect(classify({ line: 2, text: "\u00a0", comment: false })).toEqual({
    kind: "text",
    text: "\u00a0",
  });
  expect(classify({ line: 3, text: "\u0085", comment: false })).toEqual({
    kind: "text",
    text: "\u0085",
  });
  expect(classify({ line: 4, text: "\ufeff", comment: false })).toEqual({
    kind: "text",
    text: "\ufeff",
  });
});

test("dot requests with no name are skips while a nonblank name is retained", () => {
  expect(classify({ line: 1, text: ".", comment: false })).toEqual({ kind: "skip" });
  expect(classify({ line: 2, text: ". \t", comment: false })).toEqual({ kind: "skip" });
  expect(classify({ line: 3, text: ".\u00a0", comment: false })).toEqual({
    kind: "request",
    name: "\u00a0",
    col: 2,
    args: [],
    problems: [],
  });
});

test("optional blanks after the dot and unknown case-sensitive names keep their exact columns", () => {
  expect(classify({ line: 7, text: ". \tXY\targ", comment: false })).toEqual({
    kind: "request",
    name: "XY",
    col: 4,
    args: [{ text: "arg", col: 7 }],
    problems: [],
  });
  expect(classify({ line: 8, text: ".Sh", comment: false })).toEqual({
    kind: "request",
    name: "Sh",
    col: 2,
    args: [],
    problems: [],
  });
});

test("unquoted backslash escapes keep blanks and consume astral code points whole", () => {
  expect(classify({ line: 3, text: ".B a\\ b\tc\\😀x", comment: false })).toEqual({
    kind: "request",
    name: "B",
    col: 2,
    args: [
      { text: "a\\ b", col: 4 },
      { text: "c\\😀x", col: 9 },
    ],
    problems: [],
  });
});

test("quotes inside an unquoted argument are ordinary characters", () => {
  expect(classify({ line: 1, text: '.B a"b c', comment: false })).toEqual({
    kind: "request",
    name: "B",
    col: 2,
    args: [
      { text: 'a"b', col: 4 },
      { text: "c", col: 8 },
    ],
    problems: [],
  });
});

test("empty quoted arguments and directly adjacent arguments are retained separately", () => {
  expect(classify({ line: 1, text: '.B ""next "tail"', comment: false })).toEqual({
    kind: "request",
    name: "B",
    col: 2,
    args: [
      { text: "", col: 4 },
      { text: "next", col: 6 },
      { text: "tail", col: 11 },
    ],
    problems: [],
  });
});

test("doubled quotes decode to one quote and argument columns point to their starts", () => {
  expect(classify({ line: 5, text: '.B "a ""b"" c" tail', comment: false })).toEqual({
    kind: "request",
    name: "B",
    col: 2,
    args: [
      { text: 'a "b" c', col: 4 },
      { text: "tail", col: 16 },
    ],
    problems: [],
  });
});

test("unterminated quotes emit MN004 at joined UTF-16 positions", () => {
  const joined = splitLines('.B 😀 \\\n"unterminated');
  expect(joined.count).toBe(2);
  expect(joined.lines).toEqual([{ line: 1, text: '.B 😀 "unterminated', comment: false }]);
  expect(classify(joined.lines[0] ?? { line: 0, text: "", comment: false })).toEqual({
    kind: "request",
    name: "B",
    col: 2,
    args: [
      { text: "😀", col: 4 },
      { text: "unterminated", col: 7 },
    ],
    problems: [{ line: 1, col: 7, code: "MN004", text: "unterminated quoted argument" }],
  });
});
