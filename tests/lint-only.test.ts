import { expect, test } from "bun:test";
import { run } from "../src/cli/cli";

const PAGE =
  ".TH A 1\n.XX\n.SH NAME\na \\- b\n.TH A 2\n.sp x\n.RE\n.nf\ntext\n.SH MORE\n.br\n\\q\n";

const FakeIo = {
  files: new Map<string, Uint8Array>([["p.1", new TextEncoder().encode(PAGE)]]),
  stdin: new TextEncoder().encode(PAGE),
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

function execute(argv: string[], stdin = new TextEncoder().encode(PAGE)) {
  FakeIo.stdin = stdin;
  FakeIo.outText = "";
  FakeIo.errText = "";
  const code = run(argv, FakeIo);
  return { out: FakeIo.outText, err: FakeIo.errText, code };
}

test("lint reports all problems in page order", () => {
  expect(execute(["lint", "p.1"])).toEqual({
    out:
      'p.1:2:2: MN003 unknown request "XX"\n' +
      "p.1:5:1: MN008 TH appears more than once\n" +
      'p.1:6:5: MN006 invalid number "x"\n' +
      "p.1:7:1: MN009 RE without RS\n" +
      "p.1:8:1: MN012 nf is not closed before the end of its section\n" +
      'p.1:12:1: MN002 unknown escape "\\q"\n' +
      "6 problems\n",
    err: "",
    code: 1,
  });
});

test("lint filters to one code", () => {
  expect(execute(["lint", "--only", "MN006", "p.1"])).toEqual({
    out: 'p.1:6:5: MN006 invalid number "x"\n1 problem\n',
    err: "",
    code: 1,
  });
});

test("lint filter preserves page order instead of code-list order", () => {
  expect(execute(["lint", "--only", "MN009,MN003", "p.1"])).toEqual({
    out: 'p.1:2:2: MN003 unknown request "XX"\np.1:7:1: MN009 RE without RS\n2 problems\n',
    err: "",
    code: 1,
  });
});

test("repeated filter codes do not duplicate problems", () => {
  expect(execute(["lint", "--only", "MN006,MN006", "p.1"])).toEqual({
    out: 'p.1:6:5: MN006 invalid number "x"\n1 problem\n',
    err: "",
    code: 1,
  });
});

test("lint accepts the option after FILE and reads filtered stdin", () => {
  expect(execute(["lint", "p.1", "--only", "MN002"])).toEqual({
    out: 'p.1:12:1: MN002 unknown escape "\\q"\n1 problem\n',
    err: "",
    code: 1,
  });
  expect(execute(["lint", "--only", "MN012", "-"])).toEqual({
    out: "<stdin>:8:1: MN012 nf is not closed before the end of its section\n1 problem\n",
    err: "",
    code: 1,
  });
});

test("the final repeated --only value wins", () => {
  expect(execute(["lint", "--only", "MN006", "--only", "MN002", "p.1"])).toEqual({
    out: 'p.1:12:1: MN002 unknown escape "\\q"\n1 problem\n',
    err: "",
    code: 1,
  });
});

test("an empty filtered report keeps the original line count", () => {
  expect(execute(["lint", "--only", "MN013", "p.1"])).toEqual({
    out: "ok, 12 lines\n",
    err: "",
    code: 0,
  });
});

test("listing every problem code preserves the unfiltered report", () => {
  expect(
    execute([
      "lint",
      "--only",
      "MN001,MN002,MN003,MN004,MN005,MN006,MN007,MN008,MN009,MN010,MN011,MN012,MN013",
      "p.1",
    ]),
  ).toEqual({
    out:
      'p.1:2:2: MN003 unknown request "XX"\n' +
      "p.1:5:1: MN008 TH appears more than once\n" +
      'p.1:6:5: MN006 invalid number "x"\n' +
      "p.1:7:1: MN009 RE without RS\n" +
      "p.1:8:1: MN012 nf is not closed before the end of its section\n" +
      'p.1:12:1: MN002 unknown escape "\\q"\n' +
      "6 problems\n",
    err: "",
    code: 1,
  });
});

test.each([
  { value: "MN000", item: "MN000" },
  { value: "MN014", item: "MN014" },
  { value: "MN100", item: "MN100" },
  { value: "mn006", item: "mn006" },
  { value: "MN06", item: "MN06" },
  { value: "", item: "" },
  { value: "MN006,", item: "" },
  { value: ",MN006", item: "" },
  { value: "MN006,XX", item: "XX" },
  { value: "MN006, MN002", item: " MN002" },
  { value: "MÉN006", item: "M?N006" },
] as const)("rejects invalid problem code value: $value", ({ value, item }) => {
  expect(execute(["lint", "--only", value, "p.1"])).toEqual({
    out: "",
    err: `manlens: unknown problem code "${item}"\n`,
    code: 2,
  });
});

test("validates codes before reading a missing file", () => {
  expect(execute(["lint", "--only", "MN999", "missing.1"])).toEqual({
    out: "",
    err: 'manlens: unknown problem code "MN999"\n',
    code: 2,
  });
  expect(execute(["lint", "--only", "MN006", "missing.1"])).toEqual({
    out: "",
    err: "manlens: missing.1: cannot read the file\n",
    code: 2,
  });
});

test("reports missing values and keeps --only exclusive to lint", () => {
  expect(execute(["lint", "p.1", "--only"])).toEqual({
    out: "",
    err: "manlens: missing value for --only\n",
    code: 2,
  });
  expect(execute(["flags", "--only", "MN006", "p.1"])).toEqual({
    out: "",
    err: 'manlens: unknown option "--only"\n',
    code: 2,
  });
  expect(execute(["lint", "--only=MN006", "p.1"])).toEqual({
    out: "",
    err: 'manlens: unknown option "--only=MN006"\n',
    code: 2,
  });
});
