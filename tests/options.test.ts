import { expect, test } from "bun:test";
import { Fail } from "../src/base/fail";
import { type Io, readText } from "../src/base/inputs";
import { parseOptions } from "../src/base/options";

test("parseOptions preserves empty and repeated option behavior", () => {
  const empty = parseOptions([], [], []);
  expect([...empty.flags]).toEqual([]);
  expect([...empty.values]).toEqual([]);
  expect(empty.args).toEqual([]);

  const repeated = parseOptions(
    ["--width", "30", "--width", "20", "--ansi", "--ansi", "f.1"],
    ["--ansi"],
    ["--width"],
  );
  expect([...repeated.flags]).toEqual(["--ansi"]);
  expect([...repeated.values]).toEqual([["--width", "20"]]);
  expect(repeated.args).toEqual(["f.1"]);
});

test("parseOptions consumes option-looking and empty values and preserves positionals", () => {
  const optionLooking = parseOptions(
    ["-", "-5", "a.1", "--width", "--ansi"],
    ["--ansi"],
    ["--width"],
  );
  expect([...optionLooking.flags]).toEqual([]);
  expect([...optionLooking.values]).toEqual([["--width", "--ansi"]]);
  expect(optionLooking.args).toEqual(["-", "-5", "a.1"]);

  const empty = parseOptions(["--width", "", "f.1"], [], ["--width"]);
  expect([...empty.flags]).toEqual([]);
  expect([...empty.values]).toEqual([["--width", ""]]);
  expect(empty.args).toEqual(["f.1"]);
});

test.each([
  { argv: ["--"], flags: [], values: [], message: 'unknown option "--"' },
  { argv: ["--help"], flags: [], values: [], message: 'unknown option "--help"' },
  {
    argv: ["--width=60"],
    flags: [],
    values: ["--width"],
    message: 'unknown option "--width=60"',
  },
  { argv: ["--width"], flags: [], values: ["--width"], message: "missing value for --width" },
  {
    argv: ["--bogus", "--width"],
    flags: [],
    values: ["--width"],
    message: 'unknown option "--bogus"',
  },
  {
    argv: ["--é😀\n"],
    flags: [],
    values: [],
    message: 'unknown option "--???"',
  },
] as const)(
  "parseOptions throws Fail for invalid options: %j",
  ({ argv, flags, values, message }) => {
    let caught: unknown;
    try {
      parseOptions([...argv], [...flags], [...values]);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Fail);
    expect(caught).toHaveProperty("message", message);
  },
);

test("readText routes stdin and files and returns empty and valid multibyte text", () => {
  let stdinReads = 0;
  let stdinOutCalls = 0;
  let stdinErrCalls = 0;
  const stdinIo: Io = {
    readStdin() {
      stdinReads += 1;
      return new Uint8Array([]);
    },
    readFile() {
      throw new Error("unexpected file read");
    },
    out() {
      stdinOutCalls += 1;
    },
    err() {
      stdinErrCalls += 1;
    },
  };
  expect(readText(stdinIo, "-")).toEqual({ display: "<stdin>", text: "" });
  expect(stdinReads).toBe(1);
  expect(stdinOutCalls).toBe(0);
  expect(stdinErrCalls).toBe(0);

  let fileReads = 0;
  let filePath = "";
  let fileStdinReads = 0;
  let fileOutCalls = 0;
  let fileErrCalls = 0;
  const fileIo: Io = {
    readStdin() {
      fileStdinReads += 1;
      return new Uint8Array([]);
    },
    readFile(path: string) {
      fileReads += 1;
      filePath = path;
      return new Uint8Array([195, 169, 240, 159, 152, 128]);
    },
    out() {
      fileOutCalls += 1;
    },
    err() {
      fileErrCalls += 1;
    },
  };
  expect(readText(fileIo, "café😀.1")).toEqual({ display: "caf??.1", text: "é😀" });
  expect(fileReads).toBe(1);
  expect(filePath).toBe("café😀.1");
  expect(fileStdinReads).toBe(0);
  expect(fileOutCalls).toBe(0);
  expect(fileErrCalls).toBe(0);
});

test("readText removes exactly one leading BOM and preserves embedded BOMs", () => {
  let outCalls = 0;
  let errCalls = 0;
  const io: Io = {
    readStdin() {
      throw new Error("unexpected stdin read");
    },
    readFile(path: string) {
      if (path === "leading") {
        return new Uint8Array([239, 187, 191, 239, 187, 191, 97]);
      }
      return new Uint8Array([97, 239, 187, 191]);
    },
    out() {
      outCalls += 1;
    },
    err() {
      errCalls += 1;
    },
  };

  expect(readText(io, "leading").text).toBe("\uFEFFa");
  expect(readText(io, "embedded").text).toBe("a\uFEFF");
  expect(outCalls).toBe(0);
  expect(errCalls).toBe(0);
});

test("readText converts stdin and file read exceptions to Fail", () => {
  let stdinReads = 0;
  let fileReads = 0;
  let filePath = "";
  let outCalls = 0;
  let errCalls = 0;
  const io: Io = {
    readStdin() {
      stdinReads += 1;
      throw new Error("raw stdin failure");
    },
    readFile(path: string) {
      fileReads += 1;
      filePath = path;
      throw new Error("raw file failure");
    },
    out() {
      outCalls += 1;
    },
    err() {
      errCalls += 1;
    },
  };

  let fileError: unknown;
  try {
    readText(io, "café.1");
  } catch (error) {
    fileError = error;
  }
  expect(fileError).toBeInstanceOf(Fail);
  expect(fileError).toHaveProperty("message", "caf?.1: cannot read the file");

  let stdinError: unknown;
  try {
    readText(io, "-");
  } catch (error) {
    stdinError = error;
  }
  expect(stdinError).toBeInstanceOf(Fail);
  expect(stdinError).toHaveProperty("message", "<stdin>: cannot read the file");
  expect(filePath).toBe("café.1");
  expect(fileReads).toBe(1);
  expect(stdinReads).toBe(1);
  expect(outCalls).toBe(0);
  expect(errCalls).toBe(0);
});

test.each([
  { bytes: [97, 255, 10] },
  { bytes: [195] },
  { bytes: [192, 175] },
  { bytes: [237, 160, 128] },
  { bytes: [244, 144, 128, 128] },
  { bytes: [13, 255] },
] as const)("readText rejects malformed UTF-8 bytes: %j", ({ bytes }) => {
  let stdinReads = 0;
  let outCalls = 0;
  let errCalls = 0;
  const io: Io = {
    readStdin() {
      stdinReads += 1;
      return new Uint8Array([...bytes]);
    },
    readFile() {
      throw new Error("unexpected file read");
    },
    out() {
      outCalls += 1;
    },
    err() {
      errCalls += 1;
    },
  };

  let caught: unknown;
  try {
    readText(io, "-");
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Fail);
  expect(caught).toHaveProperty("message", "<stdin>: input is not valid UTF-8");
  expect(stdinReads).toBe(1);
  expect(outCalls).toBe(0);
  expect(errCalls).toBe(0);
});

test.each([
  { bytes: [97, 10, 13, 98, 10], message: "<stdin>: bare carriage return at line 2" },
  { bytes: [97, 13], message: "<stdin>: bare carriage return at line 1" },
  { bytes: [97, 13, 10, 98, 13], message: "<stdin>: bare carriage return at line 2" },
] as const)("readText rejects bare carriage returns: %j", ({ bytes, message }) => {
  let stdinReads = 0;
  let outCalls = 0;
  let errCalls = 0;
  const io: Io = {
    readStdin() {
      stdinReads += 1;
      return new Uint8Array([...bytes]);
    },
    readFile() {
      throw new Error("unexpected file read");
    },
    out() {
      outCalls += 1;
    },
    err() {
      errCalls += 1;
    },
  };

  let caught: unknown;
  try {
    readText(io, "-");
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(Fail);
  expect(caught).toHaveProperty("message", message);
  expect(stdinReads).toBe(1);
  expect(outCalls).toBe(0);
  expect(errCalls).toBe(0);
});

test("readText normalizes CRLF bytes to LF", () => {
  let stdinReads = 0;
  let outCalls = 0;
  let errCalls = 0;
  const io: Io = {
    readStdin() {
      stdinReads += 1;
      return new Uint8Array([97, 13, 10, 98, 10]);
    },
    readFile() {
      throw new Error("unexpected file read");
    },
    out() {
      outCalls += 1;
    },
    err() {
      errCalls += 1;
    },
  };

  expect(readText(io, "-")).toEqual({ display: "<stdin>", text: "a\nb\n" });
  expect(stdinReads).toBe(1);
  expect(outCalls).toBe(0);
  expect(errCalls).toBe(0);
});
