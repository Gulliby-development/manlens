import { expect, test } from "bun:test";
import { Fail } from "../src/base/fail";
import { line, plain, plural, show, table } from "../src/base/text";

test("Fail preserves its message and extends Error", () => {
  const failure = new Fail("cannot proceed");

  expect(failure).toBeInstanceOf(Fail);
  expect(failure).toBeInstanceOf(Error);
  expect(failure.message).toBe("cannot proceed");
});

test("plain sanitizes controls and non-ASCII code points", () => {
  const input = { op: "plain", text: "A ~\t\n\u001b\u007fé😀" };

  expect(input.op === "plain" ? plain(input.text) : "").toBe("A ~??????");
});

test("show sanitizes Unicode by code point", () => {
  const input = { op: "show", text: "café😀.1" };

  expect(input.op === "show" ? show(input.text) : "").toBe('"caf??.1"');
});

test("show wraps without escaping quotes or backslashes", () => {
  const input = { op: "show", text: '"\\' };

  expect(input.op === "show" ? show(input.text) : "").toBe('""\\"');
});

test("plain and show handle empty strings", () => {
  const plainInput = { op: "plain", text: "" };
  const showInput = { op: "show", text: "" };

  expect(plainInput.op === "plain" ? plain(plainInput.text) : "").toBe("");
  expect(showInput.op === "show" ? show(showInput.text) : "").toBe('""');
});

test("line pads short, long, and astral keys by UTF-16 length", () => {
  const short = { op: "line", args: ["key", "value"] };
  const long = { op: "line", args: ["abcdefghijk", "v"] };
  const astral = { op: "line", args: ["😀", "v"] };

  const [shortKey, shortValue] = short.args;
  const [longKey, longValue] = long.args;
  const [astralKey, astralValue] = astral.args;

  expect(short.op === "line" ? line(shortKey, shortValue) : "").toBe("key         value\n");
  expect(long.op === "line" ? line(longKey, longValue) : "").toBe("abcdefghijk  v\n");
  expect(astral.op === "line" ? line(astralKey, astralValue) : "").toBe("😀          v\n");
});

test("table aligns astral-width cells and removes trailing spaces", () => {
  const input = {
    op: "table",
    args: [
      ["A", "B"],
      [
        ["😀", "x"],
        ["long", ""],
      ],
    ] as [string[], string[][]],
  };

  expect(input.op === "table" ? table(...input.args) : "").toBe("A     B\n😀    x\nlong\n");
});

test("table formats a header without rows", () => {
  const input = { op: "table", args: [["A", "B"], []] as [string[], string[][]] };

  expect(input.op === "table" ? table(...input.args) : "").toBe("A  B\n");
});

test("plural handles one, zero, and multiple counts", () => {
  const one = { op: "plural", args: [1, "line"] as [number, string] };
  const zero = { op: "plural", args: [0, "line"] as [number, string] };
  const multiple = { op: "plural", args: [2, "line"] as [number, string] };

  expect(one.op === "plural" ? plural(...one.args) : "").toBe("1 line");
  expect(zero.op === "plural" ? plural(...zero.args) : "").toBe("0 lines");
  expect(multiple.op === "plural" ? plural(...multiple.args) : "").toBe("2 lines");
});
