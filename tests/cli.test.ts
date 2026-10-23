import { expect, spyOn, test } from "bun:test";
import { run } from "../src/cli/cli";

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

test("run prints exact global help for the sole --help argument", () => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run(["--help"], FakeIo)).toBe(0);
    expect(FakeIo.outText).toBe(
      "usage: manlens render [--width N] [--ansi] FILE\n" +
        "       manlens markdown FILE\n" +
        "       manlens lint FILE\n" +
        "       manlens flags FILE\n" +
        "       manlens drift MAN HELP\n",
    );
    expect(out).toHaveBeenCalledTimes(1);
    expect(out).toHaveBeenCalledWith(
      "usage: manlens render [--width N] [--ansi] FILE\n" +
        "       manlens markdown FILE\n" +
        "       manlens lint FILE\n" +
        "       manlens flags FILE\n" +
        "       manlens drift MAN HELP\n",
    );
    expect(err).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe("");
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
});

test.each([
  { argv: ["render", "a.1"], expected: { code: 0, out: "A(1)\n" } },
  { argv: ["markdown", "a.1"], expected: { code: 0, out: "# A(1)\n" } },
  { argv: ["lint", "a.1"], expected: { code: 0, out: "ok, 1 line\n" } },
  { argv: ["flags", "a.1"], expected: { code: 0, out: "" } },
  { argv: ["drift", "a.1", "a.help"], expected: { code: 0, out: "in sync, 0 options\n" } },
] as const)("dispatches successful command: %j", ({ argv, expected }) => {
  FakeIo.files = new Map([
    ["a.1", new TextEncoder().encode(".TH A 1\n")],
    ["a.help", new Uint8Array()],
  ]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run([...argv], FakeIo)).toBe(expected.code);
    expect(FakeIo.outText).toBe(expected.out);
    expect(out).toHaveBeenCalledTimes(1);
    expect(out).toHaveBeenCalledWith(expected.out);
    expect(err).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe("");
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
});

test.each([
  {
    argv: ["lint", "a.1"],
    files: [["a.1", ".TH A 1\n.RE\n"]],
    expected: "a.1:2:1: MN009 RE without RS\n1 problem\n",
  },
  {
    argv: ["drift", "a.1", "a.help"],
    files: [
      ["a.1", ".TH A 1\n.IP -x\n"],
      ["a.help", ""],
    ],
    expected: "only in man: -x (man line 2)\n1 difference\n",
  },
] as const)("preserves negative command result codes: %j", ({ argv, files, expected }) => {
  FakeIo.files = new Map(files.map(([path, text]) => [path, new TextEncoder().encode(text)]));
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run([...argv], FakeIo)).toBe(1);
    expect(FakeIo.outText).toBe(expected);
    expect(out).toHaveBeenCalledTimes(1);
    expect(out).toHaveBeenCalledWith(expected);
    expect(err).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe("");
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
});

test.each([
  { argv: [], message: "missing command (render, markdown, lint, flags or drift)" },
  { argv: ["show"], message: 'unknown command "show"' },
  { argv: ["--help", "f.1"], message: 'unknown command "--help"' },
] as const)("rejects missing, unknown, and non-sole help commands: %j", ({ argv, message }) => {
  FakeIo.files = new Map([["f.1", new TextEncoder().encode(".TH F 1\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const readFile = spyOn(FakeIo, "readFile");
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run([...argv], FakeIo)).toBe(2);
    expect(FakeIo.outText).toBe("");
    expect(out).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe(`manlens: ${message}\n`);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith(`manlens: ${message}\n`);
  } finally {
    readFile.mockRestore();
    out.mockRestore();
    err.mockRestore();
  }
});

test.each([
  { argv: ["lint", "--help"], message: 'unknown option "--help"' },
  { argv: ["render", "--width"], message: "missing value for --width" },
  { argv: ["render", "--width=60", "f.1"], message: 'unknown option "--width=60"' },
  {
    argv: ["render", "--bogus", "--width", "19", "f.1"],
    message: 'unknown option "--bogus"',
  },
  { argv: ["render"], message: "missing FILE" },
  { argv: ["render", "--width", "19"], message: "missing FILE" },
  { argv: ["drift", "f.1"], message: "missing HELP" },
  { argv: ["lint", "f.1", "f.1"], message: "too many arguments" },
  {
    argv: ["render", "--width", "--ansi", "f.1"],
    message: 'invalid --width "--ansi" (expected 20 to 200)',
  },
] as const)("validates options and arity before reading files: %j", ({ argv, message }) => {
  FakeIo.files = new Map([["f.1", new TextEncoder().encode(".TH F 1\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const readFile = spyOn(FakeIo, "readFile");
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run([...argv], FakeIo)).toBe(2);
    expect(FakeIo.outText).toBe("");
    expect(out).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe(`manlens: ${message}\n`);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith(`manlens: ${message}\n`);
  } finally {
    readFile.mockRestore();
    out.mockRestore();
    err.mockRestore();
  }
});

test.each([
  {
    argv: ["render", "--width", "19", "nofile.1"],
    expected: 'manlens: invalid --width "19" (expected 20 to 200)\n',
  },
  {
    argv: ["render", "--width", "080", "nofile.1"],
    expected: 'manlens: invalid --width "080" (expected 20 to 200)\n',
  },
  {
    argv: ["render", "--width", "2e1", "nofile.1"],
    expected: 'manlens: invalid --width "2e1" (expected 20 to 200)\n',
  },
  {
    argv: ["render", "--width", "201", "nofile.1"],
    expected: 'manlens: invalid --width "201" (expected 20 to 200)\n',
  },
  {
    argv: ["render", "--width", "", "nofile.1"],
    expected: 'manlens: invalid --width "" (expected 20 to 200)\n',
  },
  {
    argv: ["render", "--width", "30", "--width", "201", "nofile.1"],
    expected: 'manlens: invalid --width "201" (expected 20 to 200)\n',
  },
] as const)("rejects invalid render widths before reading files: %j", ({ argv, expected }) => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const readFile = spyOn(FakeIo, "readFile");
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run([...argv], FakeIo)).toBe(2);
    expect(FakeIo.outText).toBe("");
    expect(out).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe(expected);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith(expected);
  } finally {
    readFile.mockRestore();
    out.mockRestore();
    err.mockRestore();
  }
});

test("uses the final repeated width and repeated ansi flag", () => {
  FakeIo.files = new Map([["f.1", new TextEncoder().encode(".TH F 1\n.B bold\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(
      run(["render", "--width", "30", "--width", "20", "--ansi", "--ansi", "f.1"], FakeIo),
    ).toBe(0);
    expect(FakeIo.outText).toBe("F(1)\n\n       \u001b[1mbold\u001b[22m\n");
    expect(out).toHaveBeenCalledTimes(1);
    expect(out).toHaveBeenCalledWith("F(1)\n\n       \u001b[1mbold\u001b[22m\n");
    expect(err).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe("");
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
});

test.each([
  {
    argv: ["render", "nofile.1"],
    stdin: [],
    expected: "manlens: nofile.1: cannot read the file\n",
  },
  {
    argv: ["lint", "café.1"],
    stdin: [],
    expected: "manlens: caf?.1: cannot read the file\n",
  },
  {
    argv: ["drift", "nofile1", "nofile2"],
    stdin: [],
    expected: "manlens: nofile1: cannot read the file\n",
  },
  {
    argv: ["lint", "-"],
    stdin: [97, 255, 10],
    expected: "manlens: <stdin>: input is not valid UTF-8\n",
  },
  {
    argv: ["lint", "-"],
    stdin: [97, 10, 13, 98, 10],
    expected: "manlens: <stdin>: bare carriage return at line 2\n",
  },
  {
    argv: ["lint", "-"],
    stdin: [97, 13],
    expected: "manlens: <stdin>: bare carriage return at line 1\n",
  },
] as const)("reports input failures once: %j", ({ argv, stdin, expected }) => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array(stdin);
  FakeIo.outText = "";
  FakeIo.errText = "";
  const out = spyOn(FakeIo, "out");
  const err = spyOn(FakeIo, "err");

  try {
    expect(run([...argv], FakeIo)).toBe(2);
    expect(FakeIo.outText).toBe("");
    expect(out).not.toHaveBeenCalled();
    expect(FakeIo.errText).toBe(expected);
    expect(err).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalledWith(expected);
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
});

test("rethrows the identical non-Fail error from output", () => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  const outputError = new Error("output failed");
  const out = spyOn(FakeIo, "out").mockImplementation(() => {
    throw outputError;
  });
  const err = spyOn(FakeIo, "err");

  try {
    let caught: unknown;
    try {
      run(["--help"], FakeIo);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(outputError);
    expect(out).toHaveBeenCalledTimes(1);
    expect(err).not.toHaveBeenCalled();
    expect(FakeIo.outText).toBe("");
    expect(FakeIo.errText).toBe("");
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
});
