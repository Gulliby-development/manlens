import { expect, test } from "bun:test";
import { Fail } from "../src/base/fail";
import {
  ARGS as DRIFT_ARGS,
  FLAGS as DRIFT_FLAGS,
  USAGE as DRIFT_USAGE,
  VALUES as DRIFT_VALUES,
  runDrift,
} from "../src/cli/cmd-drift";
import {
  ARGS as FLAGS_ARGS,
  FLAGS as FLAGS_FLAGS,
  USAGE as FLAGS_USAGE,
  VALUES as FLAGS_VALUES,
  runFlags,
} from "../src/cli/cmd-flags";
import { driftReport } from "../src/flags/drift";
import type { Entry } from "../src/flags/optlist";

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

test("drift reports the worked differences in pass order and counts synchronized options", () => {
  expect(
    driftReport(
      [
        { names: ["-a", "--all"], arg: null, line: 3 },
        { names: ["-n"], arg: { name: "N", optional: false }, line: 6 },
        { names: ["--color"], arg: { name: "WHEN", optional: true }, line: 9 },
        { names: ["-x"], arg: null, line: 12 },
        { names: ["-k", "--key"], arg: { name: "<key>", optional: false }, line: 18 },
        { names: ["--width"], arg: { name: "N", optional: false }, line: 20 },
      ],
      [
        { names: ["-a", "--all"], arg: null, line: 4 },
        { names: ["-n", "--lines"], arg: { name: "N", optional: false }, line: 5 },
        { names: ["--color"], arg: null, line: 6 },
        { names: ["-h", "--help"], arg: null, line: 7 },
        { names: ["-k", "--key"], arg: { name: "<key>", optional: false }, line: 8 },
        { names: ["-w", "--width"], arg: { name: "N", optional: false }, line: 9 },
        { names: ["-q"], arg: null, line: 12 },
      ],
    ),
  ).toEqual({
    out:
      "only in man: -x (man line 12)\n" +
      "only in help: -h, --help (help line 7)\n" +
      "only in help: -q (help line 12)\n" +
      "argument differs: --color (man [WHEN], help none; man line 9, help line 6)\n" +
      "names differ: -n (man -n; help -n, --lines; man line 6, help line 5)\n" +
      "names differ: --width (man --width; help -w, --width; man line 20, help line 9)\n" +
      "6 differences\n",
    code: 1,
  });
  expect(
    driftReport(
      [
        { names: ["-a", "--all"], arg: null, line: 3 },
        { names: ["-n"], arg: { name: "N", optional: false }, line: 6 },
        { names: ["--color"], arg: { name: "WHEN", optional: true }, line: 9 },
        { names: ["-x"], arg: null, line: 12 },
        { names: ["-k", "--key"], arg: { name: "<key>", optional: false }, line: 18 },
        { names: ["--width"], arg: { name: "N", optional: false }, line: 20 },
      ],
      [
        { names: ["-a", "--all"], arg: null, line: 3 },
        { names: ["-n"], arg: { name: "N", optional: false }, line: 6 },
        { names: ["--color"], arg: { name: "WHEN", optional: true }, line: 9 },
        { names: ["-x"], arg: null, line: 12 },
        { names: ["-k", "--key"], arg: { name: "<key>", optional: false }, line: 18 },
        { names: ["--width"], arg: { name: "N", optional: false }, line: 20 },
      ],
    ),
  ).toEqual({ out: "in sync, 6 options\n", code: 0 });
});

test("empty and alias-equivalent entries synchronize without mutating inputs", () => {
  expect(driftReport([], [])).toEqual({ out: "in sync, 0 options\n", code: 0 });
  const man: Entry[] = [
    { names: ["-n", "--number", "-n"], arg: { name: "N", optional: false }, line: 1 },
  ];
  const help: Entry[] = [
    { names: ["--number", "-n"], arg: { name: "OTHER", optional: true }, line: 9 },
  ];
  expect(driftReport(man, help)).toEqual({ out: "in sync, 1 option\n", code: 0 });
  expect(man).toEqual([
    { names: ["-n", "--number", "-n"], arg: { name: "N", optional: false }, line: 1 },
  ]);
  expect(help).toEqual([
    { names: ["--number", "-n"], arg: { name: "OTHER", optional: true }, line: 9 },
  ]);
});

test("reports one unmatched man entry with singular difference", () => {
  expect(driftReport([{ names: ["-x"], arg: null, line: 1 }], [])).toEqual({
    out: "only in man: -x (man line 1)\n1 difference\n",
    code: 1,
  });
});

test("compares all meeting pairs without consuming entries", () => {
  expect(
    driftReport(
      [
        { names: ["-b", "-a"], arg: null, line: 2 },
        { names: ["-a"], arg: null, line: 4 },
      ],
      [
        { names: ["-a", "-b"], arg: { name: "N", optional: false }, line: 5 },
        { names: ["-a"], arg: { name: "M", optional: true }, line: 6 },
      ],
    ),
  ).toEqual({
    out:
      "argument differs: -b (man none, help N; man line 2, help line 5)\n" +
      "argument differs: -a (man none, help [M]; man line 2, help line 6)\n" +
      "argument differs: -a (man none, help N; man line 4, help line 5)\n" +
      "argument differs: -a (man none, help [M]; man line 4, help line 6)\n" +
      "names differ: -a (man -b, -a; help -a; man line 2, help line 6)\n" +
      "names differ: -a (man -a; help -a, -b; man line 4, help line 5)\n" +
      "6 differences\n",
    code: 1,
  });
});

test("sanitizes echoed argument text only in the report", () => {
  expect(
    driftReport(
      [{ names: ["--key"], arg: { name: "<é😀>", optional: true }, line: 3 }],
      [{ names: ["--key"], arg: null, line: 7 }],
    ),
  ).toEqual({
    out: "argument differs: --key (man [<??>], help none; man line 3, help line 7)\n1 difference\n",
    code: 1,
  });
});

test("exports exact command metadata and reads flags from files and normalized stdin", () => {
  expect(FLAGS_USAGE).toBe("       manlens flags FILE");
  expect(FLAGS_ARGS).toEqual(["FILE"]);
  expect(FLAGS_FLAGS).toEqual([]);
  expect(FLAGS_VALUES).toEqual([]);
  expect(DRIFT_USAGE).toBe("       manlens drift MAN HELP");
  expect(DRIFT_ARGS).toEqual(["MAN", "HELP"]);
  expect(DRIFT_FLAGS).toEqual([]);
  expect(DRIFT_VALUES).toEqual([]);

  FakeIo.files = new Map([["m.1", new TextEncoder().encode('.TH M 1\n.IP "-a, --all"\n')]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runFlags(["m.1"], new Set(), new Map(), FakeIo)).toEqual({
    out: "OPTIONS    ARG  LINE\n-a, --all  -    2\n",
    code: 0,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map();
  FakeIo.stdin = new TextEncoder().encode(".IP -x\r\n");
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runFlags(["-"], new Set(), new Map(), FakeIo)).toEqual({
    out: "OPTIONS  ARG  LINE\n-x       -    1\n",
    code: 0,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runDrift returns synchronized and differing reports without writing channels", () => {
  FakeIo.files = new Map([
    ["m.1", new TextEncoder().encode('.TH M 1\n.IP "-a, --all"\n')],
    ["m.help", new TextEncoder().encode("  -a, --all\n")],
  ]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runDrift(["m.1", "m.help"], new Set(), new Map(), FakeIo)).toEqual({
    out: "in sync, 1 option\n",
    code: 0,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map([
    ["m.1", new TextEncoder().encode('.TH M 1\n.IP "-a, --all"\n')],
    ["m.help", new TextEncoder().encode("  -a\n")],
  ]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  expect(runDrift(["m.1", "m.help"], new Set(), new Map(), FakeIo)).toEqual({
    out: "names differ: -a (man -a, --all; help -a; man line 2, help line 1)\n1 difference\n",
    code: 1,
  });
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runDrift propagates MAN failures before reading HELP", () => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  let missingMan: unknown;
  try {
    runDrift(["nofile1", "nofile2"], new Set(), new Map(), FakeIo);
  } catch (error) {
    missingMan = error;
  }
  expect(missingMan).toBeInstanceOf(Fail);
  expect(missingMan).toHaveProperty("message", "nofile1: cannot read the file");
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map([["m.1", new TextEncoder().encode(".TH M 1\rbad\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  let bareCarriageReturn: unknown;
  try {
    runDrift(["m.1", "nofile2"], new Set(), new Map(), FakeIo);
  } catch (error) {
    bareCarriageReturn = error;
  }
  expect(bareCarriageReturn).toBeInstanceOf(Fail);
  expect(bareCarriageReturn).toHaveProperty("message", "m.1: bare carriage return at line 1");
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");

  FakeIo.files = new Map([["m.1", new TextEncoder().encode(".TH M 1\n")]]);
  FakeIo.stdin = new Uint8Array();
  FakeIo.outText = "";
  FakeIo.errText = "";
  let missingHelp: unknown;
  try {
    runDrift(["m.1", "nofile2"], new Set(), new Map(), FakeIo);
  } catch (error) {
    missingHelp = error;
  }
  expect(missingHelp).toBeInstanceOf(Fail);
  expect(missingHelp).toHaveProperty("message", "nofile2: cannot read the file");
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});

test("runFlags propagates malformed UTF-8 stdin as Fail without channel output", () => {
  FakeIo.files = new Map();
  FakeIo.stdin = new Uint8Array([97, 255, 10]);
  FakeIo.outText = "";
  FakeIo.errText = "";
  let malformed: unknown;
  try {
    runFlags(["-"], new Set(), new Map(), FakeIo);
  } catch (error) {
    malformed = error;
  }
  expect(malformed).toBeInstanceOf(Fail);
  expect(malformed).toHaveProperty("message", "<stdin>: input is not valid UTF-8");
  expect(FakeIo.outText).toBe("");
  expect(FakeIo.errText).toBe("");
});
