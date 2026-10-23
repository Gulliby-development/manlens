import { expect, test } from "bun:test";
import { Fail } from "../src/base/fail";
import { ARGS, FLAGS, runMarkdown, USAGE, VALUES } from "../src/cli/cmd-markdown";
import { toMarkdown } from "../src/convert/markdown";
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

test("serializes an empty document as an empty string", () => {
  expect(toMarkdown(buildDoc(""))).toBe("");
});

test("serializes the title and heading hierarchy with escaped prose", () => {
  expect(toMarkdown(buildDoc('.TH T 1\n.SH "A *"\n.SS "Small _"\n'))).toBe(
    "# T(1)\n\n## A \\*\n\n### Small \\_\n",
  );
});

test("escapes punctuation and NB while preserving mixed-font words", () => {
  expect(
    toMarkdown(
      buildDoc(
        "\\fBa*b\\fR a_b \x60c\x60 \\e \\\\ a\\ b  z ~ [x] <y> & # |\n.BR fetcher.conf (5)\n",
      ),
    ),
  ).toBe(
    "**a\\*b** a\\_b \\\x60c\\\x60 \\\\ \\\\ a&nbsp;b  z \\~ \\[x\\] \\<y\\> \\& \\# \\| **fetcher.conf**(5)\n",
  );
});

test("serializes tagged items, bullets, and empty tags", () => {
  expect(
    toMarkdown(
      buildDoc(
        ".TP\n\\fB\\-\\-width\\fR=\\fIN\\fR\nText and > and <.\n.IP \\(bu 2\nBullet.\n.IP o\n.IP other\n",
      ),
    ),
  ).toBe("- **--width**=*N*\n  Text and \\> and \\<.\n\n- Bullet.\n\n-\n\n- other\n");
});

test("flattens item segments and ignores spacing and margin layout", () => {
  expect(
    toMarkdown(buildDoc("first\n.br\nsecond\n.sp 3\nthird\n\nfourth\n.RS 3\nfifth\n.RE\nsixth\n")),
  ).toBe("first second third fourth\n\nfifth\n\nsixth\n");
});

test("uses safe dynamic pre fences and preserves row gaps without prose escaping", () => {
  expect(
    toMarkdown(
      buildDoc(".nf\n`` ``` x\n```` y\n.sp 2\n\\fBraw*\\fR a\\ b\n.fi\n.nf\nx `````` y\n.fi\n"),
    ),
  ).toBe("`````\n`` ``` x\n```` y\n\n\nraw* a b\n`````\n\n```\nx `````` y\n```\n");
});

test("runMarkdown exports metadata and serializes a named file without writing buffers", () => {
  FakeIo.files = new Map([["a.1", new TextEncoder().encode(".TH A 1\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";

  expect(USAGE).toBe("       manlens markdown FILE");
  expect(ARGS).toEqual(["FILE"]);
  expect(FLAGS).toEqual([]);
  expect(VALUES).toEqual([]);
  expect(runMarkdown(["a.1"], new Set(), new Map(), FakeIo)).toEqual({
    out: "# A(1)\n",
    code: 0,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runMarkdown normalizes BOM and CRLF stdin and returns output despite diagnostics", () => {
  FakeIo.files = new Map();
  FakeIo.stdin = new TextEncoder().encode("\uFEFFhello\r\n");
  FakeIo.outText = "";
  FakeIo.errText = "";

  expect(runMarkdown(["-"], new Set(), new Map(), FakeIo)).toEqual({ out: "hello\n", code: 0 });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runMarkdown propagates a missing-file Fail without writing buffers", () => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";

  let caught: unknown;
  try {
    runMarkdown(["missing.1"], new Set(), new Map(), FakeIo);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(Fail);
  expect(caught).toHaveProperty("message", "missing.1: cannot read the file");
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});
