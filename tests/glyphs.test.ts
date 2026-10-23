import { expect, test } from "bun:test";
import { glyph, isControl, NB } from "../src/inline/glyphs";

test("NB is the nonbreaking-space sentinel", () => {
  expect(NB).toBe("\u0001");
});

test("glyph maps em, en, and hyphen names", () => {
  expect(glyph("em")).toBe("--");
  expect(glyph("en")).toBe("-");
  expect(glyph("hy")).toBe("-");
});

test("glyph maps bullet, copyright, and registered names", () => {
  expect(glyph("bu")).toBe("o");
  expect(glyph("co")).toBe("(C)");
  expect(glyph("rg")).toBe("(R)");
});

test("glyph maps all double-quote names", () => {
  expect(glyph("lq")).toBe('"');
  expect(glyph("rq")).toBe('"');
  expect(glyph("dq")).toBe('"');
});

test("glyph maps all apostrophe names", () => {
  expect(glyph("oq")).toBe("'");
  expect(glyph("cq")).toBe("'");
  expect(glyph("aq")).toBe("'");
});

test("glyph rejects unknown, empty, case-mismatched, and inherited names", () => {
  expect(glyph("xx")).toBeUndefined();
  expect(glyph("")).toBeUndefined();
  expect(glyph("EM")).toBeUndefined();
  expect(glyph("toString")).toBeUndefined();
});

test("isControl recognizes lower control boundaries and excludes TAB", () => {
  expect(isControl("\u0000")).toBe(true);
  expect(isControl("\u0001")).toBe(true);
  expect(isControl("\b")).toBe(true);
  expect(isControl("\t")).toBe(false);
  expect(isControl("\n")).toBe(true);
  expect(isControl("\u001f")).toBe(true);
});

test("isControl recognizes upper control boundaries", () => {
  expect(isControl("\u007f")).toBe(true);
  expect(isControl("\u0085")).toBe(true);
  expect(isControl("\u009f")).toBe(true);
});

test("isControl excludes ordinary spaces, printable text, NBSP, BOM, and astral characters", () => {
  expect(isControl(" ")).toBe(false);
  expect(isControl("~")).toBe(false);
  expect(isControl("\u00a0")).toBe(false);
  expect(isControl("\ufeff")).toBe(false);
  expect(isControl("😀")).toBe(false);
});
