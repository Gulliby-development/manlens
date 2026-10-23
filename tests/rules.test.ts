import { expect, test } from "bun:test";
import { expandTabs, KNOWN, parseNumber, trimRuns } from "../src/doc/rules";

test("KNOWN lists the complete case-sensitive request vocabulary", () => {
  expect(KNOWN).toHaveLength(22);
  expect(KNOWN.slice(0, 20)).toEqual([
    "TH",
    "SH",
    "SS",
    "PP",
    "P",
    "LP",
    "TP",
    "IP",
    "RS",
    "RE",
    "B",
    "I",
    "BR",
    "BI",
    "IB",
    "IR",
    "RB",
    "RI",
    "nf",
    "fi",
  ]);
  expect(KNOWN.slice(20)).toEqual(["br", "sp"]);
});

test("parseNumber accepts decimal values and an optional trailing n", () => {
  expect(parseNumber("7")).toBe(7);
  expect(parseNumber("007")).toBe(7);
  expect(parseNumber("4n")).toBe(4);
  expect(parseNumber("0")).toBe(0);
  expect(parseNumber("100n")).toBe(100);
});

test("parseNumber rejects malformed, out-of-range, and non-ASCII values", () => {
  expect(parseNumber("x")).toBeNull();
  expect(parseNumber("1.5")).toBeNull();
  expect(parseNumber("-2")).toBeNull();
  expect(parseNumber("101")).toBeNull();
  expect(parseNumber("7nn")).toBeNull();
  expect(parseNumber("")).toBeNull();
  expect(parseNumber("７")).toBeNull();
});

test("expandTabs moves initial and two-column tabs to tab stops", () => {
  expect(expandTabs("\tx")).toBe("        x");
  expect(expandTabs("ab\tx")).toBe("ab      x");
});

test("expandTabs counts astral characters in UTF-16 columns", () => {
  expect(expandTabs("😀\tx")).toBe("😀      x");
});

test("expandTabs advances an already aligned column by eight spaces", () => {
  expect(expandTabs("12345678\tx")).toBe("12345678        x");
});

test("trimRuns removes trailing spaces spanning font runs", () => {
  expect(
    trimRuns([
      { text: "a ", font: "B" },
      { text: "  ", font: "I" },
    ]),
  ).toEqual([{ text: "a", font: "B" }]);
});

test("trimRuns preserves tabs, NB, and NBSP while trimming ASCII spaces", () => {
  expect(trimRuns([{ text: "a\t", font: "R" }])).toEqual([{ text: "a\t", font: "R" }]);
  expect(trimRuns([{ text: "a\u0001 ", font: "I" }])).toEqual([{ text: "a\u0001", font: "I" }]);
  expect(trimRuns([{ text: "a  ", font: "R" }])).toEqual([{ text: "a ", font: "R" }]);
});

test("trimRuns handles empty and all-space run lists", () => {
  expect(trimRuns([])).toEqual([]);
  expect(
    trimRuns([
      { text: " ", font: "R" },
      { text: "   ", font: "B" },
    ]),
  ).toEqual([]);
});
