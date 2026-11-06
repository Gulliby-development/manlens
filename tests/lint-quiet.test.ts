import { expect, test } from "bun:test";
import { run } from "../src/cli/cli";

const PAGE =
  ".TH A 1\n.XX\n.SH NAME\na \\- b\n.TH A 2\n.sp x\n.RE\n.nf\ntext\n.SH MORE\n.br\n\\q\n";
const CLEAN = ".TH A 1\n.SH NAME\na \\- b\n";

const FakeIo = {
  files: new Map<string, Uint8Array>([
    ["p.1", new TextEncoder().encode(PAGE)],
    ["c.1", new TextEncoder().encode(CLEAN)],
  ]),
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

function execute(argv: string[]) {
  FakeIo.outText = "";
  FakeIo.errText = "";
  const code = run(argv, FakeIo);
  return { out: FakeIo.outText, err: FakeIo.errText, code };
}

test("lint --quiet prints only the summary line of a page with problems", () => {
  expect(execute(["lint", "--quiet", "p.1"])).toEqual({ out: "6 problems\n", err: "", code: 1 });
});

test("lint --quiet prints the ok line of a clean page and exits 0", () => {
  expect(execute(["lint", "--quiet", "c.1"])).toEqual({ out: "ok, 3 lines\n", err: "", code: 0 });
});

test("lint --quiet may follow the file name and the other options", () => {
  expect(execute(["lint", "p.1", "--quiet"])).toEqual({ out: "6 problems\n", err: "", code: 1 });
  expect(execute(["lint", "--only", "MN006,MN009", "--quiet", "p.1"])).toEqual({
    out: "2 problems\n",
    err: "",
    code: 1,
  });
});

test("lint --quiet with --only counts only the reported problems", () => {
  expect(execute(["lint", "--quiet", "--only", "MN012", "p.1"])).toEqual({
    out: "1 problem\n",
    err: "",
    code: 1,
  });
  expect(execute(["lint", "--quiet", "--only", "MN001", "p.1"])).toEqual({
    out: "ok, 12 lines\n",
    err: "",
    code: 0,
  });
});

test("lint without --quiet still prints every diagnostic first", () => {
  const full = execute(["lint", "p.1"]);
  const quiet = execute(["lint", "--quiet", "p.1"]);
  expect(full.out.endsWith(quiet.out)).toBe(true);
  expect(full.out.split("\n").length).toBe(8);
  expect(full.code).toBe(quiet.code);
});

test("lint --quiet reads standard input with a dash", () => {
  FakeIo.stdin = new TextEncoder().encode(CLEAN);
  expect(execute(["lint", "--quiet", "-"])).toEqual({ out: "ok, 3 lines\n", err: "", code: 0 });
  FakeIo.stdin = new TextEncoder().encode(PAGE);
});

test("--quiet is a flag and takes no value", () => {
  expect(execute(["lint", "--quiet=1", "p.1"]).code).toBe(2);
});
