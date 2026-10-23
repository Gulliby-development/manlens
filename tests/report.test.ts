import { expect, test } from "bun:test";
import { Fail } from "../src/base/fail";
import { lintReport } from "../src/check/report";
import { ARGS, FLAGS, runLint, USAGE, VALUES } from "../src/cli/cmd-lint";
import { buildDoc } from "../src/doc/build";

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

test("empty document reports zero physical lines", () => {
  expect(lintReport("page.1", buildDoc(""))).toEqual({ out: "ok, 0 lines\n", code: 0 });
});

test("a clean one-line page uses singular line total", () => {
  expect(lintReport("page.1", buildDoc(".TH A 1\n"))).toEqual({ out: "ok, 1 line\n", code: 0 });
});

test("clean reports count multiple physical lines", () => {
  expect(lintReport("page.1", buildDoc("\n\n"))).toEqual({ out: "ok, 2 lines\n", code: 0 });
});

test("one problem includes exact coordinates and a singular summary", () => {
  expect(
    lintReport("bad.1", {
      title: null,
      blocks: [],
      problems: [{ line: 2, col: 5, code: "MN006", text: 'invalid number "x"' }],
      lines: 2,
    }),
  ).toEqual({
    out: 'bad.1:2:5: MN006 invalid number "x"\n1 problem\n',
    code: 1,
  });
});

test("multiple already-sorted problems preserve tied-position order", () => {
  expect(
    lintReport("bad.1", {
      title: null,
      blocks: [],
      problems: [
        { line: 1, col: 1, code: "MN007", text: "first" },
        { line: 1, col: 1, code: "MN009", text: "second" },
        { line: 1, col: 1, code: "MN009", text: "third" },
      ],
      lines: 1,
    }),
  ).toEqual({
    out: "bad.1:1:1: MN007 first\nbad.1:1:1: MN009 second\nbad.1:1:1: MN009 third\n3 problems\n",
    code: 1,
  });
});

test("display and diagnostic fields are sanitized by code point without extra lines", () => {
  expect(
    lintReport("m😀\n", {
      title: null,
      blocks: [],
      problems: [{ line: 3, col: 4, code: "MN😀\u0085", text: "é😀\u0000\u007f\nbad" }],
      lines: 3,
    }),
  ).toEqual({ out: "m??:3:4: MN?? ?????bad\n1 problem\n", code: 1 });
});

test("runLint reads a file and exports the lint command metadata", () => {
  FakeIo.files = new Map<string, Uint8Array>([["a.1", new TextEncoder().encode(".TH A 1\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";

  expect(runLint(["a.1"], new Set(), new Map(), FakeIo)).toEqual({ out: "ok, 1 line\n", code: 0 });
  expect(USAGE).toBe("       manlens lint FILE");
  expect(ARGS).toEqual(["FILE"]);
  expect(FLAGS).toEqual([]);
  expect(VALUES).toEqual([]);
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runLint reads stdin and reports every problem", () => {
  FakeIo.files = new Map<string, Uint8Array>();
  FakeIo.stdin = new TextEncoder().encode(".RE\n");
  FakeIo.outText = "";
  FakeIo.errText = "";

  expect(runLint(["-"], new Set(), new Map(), FakeIo)).toEqual({
    out:
      "<stdin>:1:1: MN007 the page does not start with TH\n" +
      "<stdin>:1:1: MN009 RE without RS\n2 problems\n",
    code: 1,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runLint propagates a sanitized read failure without direct writes", () => {
  FakeIo.files = new Map<string, Uint8Array>();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";

  expect(() => runLint(["café.1"], new Set(), new Map(), FakeIo)).toThrow(Fail);
  expect(() => runLint(["café.1"], new Set(), new Map(), FakeIo)).toThrow(
    /^caf\?\.1: cannot read the file$/u,
  );
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});
