import { expect, test } from "bun:test";
import { argText, entryOf, parseOptlist } from "../src/flags/optlist";

test("parses aliases without arguments in order", () => {
  expect(parseOptlist("-v, --verbose, -7, --2-fast")).toEqual([
    { name: "-v", arg: null, optional: false },
    { name: "--verbose", arg: null, optional: false },
    { name: "-7", arg: null, optional: false },
    { name: "--2-fast", arg: null, optional: false },
  ]);
});

test("parses required arguments with equals and blank separators", () => {
  expect(parseOptlist("-w N, --width=N, -k <key>, --key=<key>")).toEqual([
    { name: "-w", arg: "N", optional: false },
    { name: "--width", arg: "N", optional: false },
    { name: "-k", arg: "<key>", optional: false },
    { name: "--key", arg: "<key>", optional: false },
  ]);
});

test("parses optional arguments with equals and blank separators", () => {
  expect(parseOptlist("--color[=WHEN], -m [MODE], --cache[=POLICY]")).toEqual([
    { name: "--color", arg: "WHEN", optional: true },
    { name: "-m", arg: "MODE", optional: true },
    { name: "--cache", arg: "POLICY", optional: true },
  ]);
});

test("trims only spaces and tabs around comma-separated items", () => {
  expect(parseOptlist(" \t-v \t,\t--long \t")).toEqual([
    { name: "-v", arg: null, optional: false },
    { name: "--long", arg: null, optional: false },
  ]);
  expect(parseOptlist("\u00a0-v")).toBeNull();
  expect(parseOptlist("-v\u0085")).toBeNull();
  expect(parseOptlist("\uFEFF-v")).toBeNull();
});

test("rejects empty text and every empty comma item", () => {
  expect(parseOptlist("")).toBeNull();
  expect(parseOptlist(" ")).toBeNull();
  expect(parseOptlist(",")).toBeNull();
  expect(parseOptlist(", -v")).toBeNull();
  expect(parseOptlist("-v,")).toBeNull();
  expect(parseOptlist("-v,,--x")).toBeNull();
});

test("rejects invalid short and long option names", () => {
  expect(parseOptlist("-")).toBeNull();
  expect(parseOptlist("--")).toBeNull();
  expect(parseOptlist("-ab")).toBeNull();
  expect(parseOptlist("-é")).toBeNull();
  expect(parseOptlist("--naïve")).toBeNull();
  expect(parseOptlist("---x")).toBeNull();
  expect(parseOptlist("--_x")).toBeNull();
});

test("rejects malformed arguments but permits otherwise-unrestricted angle atoms", () => {
  expect(parseOptlist("--x=")).toBeNull();
  expect(parseOptlist("--x[=]")).toBeNull();
  expect(parseOptlist("--x[]")).toBeNull();
  expect(parseOptlist("--x[=N")).toBeNull();
  expect(parseOptlist("--x N]")).toBeNull();
  expect(parseOptlist("--x=<>")).toBeNull();
  expect(parseOptlist("--x=<a b>")).toBeNull();
  expect(parseOptlist("--x=<a\tb>")).toBeNull();
  expect(parseOptlist("--x=<a,b>")).toBeNull();
  expect(parseOptlist("--x=<a<b>")).toBeNull();
  expect(parseOptlist("--x=<a>tail")).toBeNull();
  expect(parseOptlist("--x=N!")).toBeNull();
  expect(parseOptlist("--x=[=N]junk")).toBeNull();
  expect(parseOptlist("--x=N\n")).toBeNull();
  expect(parseOptlist("--x=<a=b/[x]\n\u00a0\u0085\uFEFF!>")).toEqual([
    { name: "--x", arg: "<a=b/[x]\n\u00a0\u0085\uFEFF!>", optional: false },
  ]);
});

test("normalizes entries while retaining name order, first argument and source line", () => {
  expect(
    entryOf(
      [
        { name: "-a", arg: null, optional: false },
        { name: "--all", arg: "FIRST", optional: true },
        { name: "-a", arg: "SECOND", optional: false },
      ],
      27,
    ),
  ).toEqual({
    names: ["-a", "--all", "-a"],
    arg: { name: "FIRST", optional: true },
    line: 27,
  });
  expect(entryOf([{ name: "--quiet", arg: null, optional: false }], 4)).toEqual({
    names: ["--quiet"],
    arg: null,
    line: 4,
  });
  expect(entryOf([], 0)).toEqual({ names: [], arg: null, line: 0 });
});

test("formats absent, required and optional arguments without changing atom text", () => {
  expect(argText(null)).toBe("-");
  expect(argText({ name: "N", optional: false })).toBe("N");
  expect(argText({ name: "N", optional: true })).toBe("[N]");
  expect(argText({ name: "<key>", optional: false })).toBe("<key>");
  expect(argText({ name: "<key>", optional: true })).toBe("[<key>]");
});
