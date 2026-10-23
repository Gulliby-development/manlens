import { expect, test } from "bun:test";
import { pack } from "../src/fill/pack";
import { styleRuns, widthOf } from "../src/fill/words";
import { NB } from "../src/inline/glyphs";
import type { Run, Word } from "../src/inline/spans";

test("counts UTF-16 width across fonts, NB spaces, literal NBSP, and empty input", () => {
  expect(
    widthOf([
      { text: "é", font: "R" },
      { text: "😀", font: "B" },
      { text: `x${NB}`, font: "I" },
      { text: " ", font: "R" },
    ]),
  ).toBe(6);
  expect(widthOf([])).toBe(0);
});

test("styles plain text by printing every NB marker as a space", () => {
  const runs: Run[] = [
    { text: `a${NB}${NB}`, font: "B" },
    { text: " b", font: "I" },
  ];
  expect(styleRuns(runs, false)).toBe("a  \u00a0b");
  expect(styleRuns(runs, false, "B")).toBe("a  \u00a0b");
});

test("emits exact ANSI wrappers for bold, italic, roman, and adjacent runs", () => {
  expect(
    styleRuns(
      [
        { text: "bold", font: "B" },
        { text: "!", font: "B" },
        { text: " roman", font: "R" },
        { text: "under", font: "I" },
        { text: ".", font: "R" },
      ],
      true,
    ),
  ).toBe("\u001b[1mbold\u001b[22m\u001b[1m!\u001b[22m roman\u001b[4munder\u001b[24m.");
});

test("force fonts override each original run without mutation", () => {
  const runs: Run[] = [
    { text: "one", font: "R" },
    { text: "two", font: "I" },
    { text: "three", font: "B" },
  ];
  expect(styleRuns(runs, true, "B")).toBe(
    "\u001b[1mone\u001b[22m\u001b[1mtwo\u001b[22m\u001b[1mthree\u001b[22m",
  );
  expect(styleRuns(runs, true, "I")).toBe(
    "\u001b[4mone\u001b[24m\u001b[4mtwo\u001b[24m\u001b[4mthree\u001b[24m",
  );
  expect(styleRuns(runs, true, "R")).toBe("onetwothree");
  expect(runs).toEqual([
    { text: "one", font: "R" },
    { text: "two", font: "I" },
    { text: "three", font: "B" },
  ]);
});

test("returns empty style and packing results for empty inputs", () => {
  expect(styleRuns([], false)).toBe("");
  expect(styleRuns([], true)).toBe("");
  expect(pack([], 0)).toEqual([]);
  expect(pack([], -1)).toEqual([]);
});

test("packs at the exact width boundary and wraps when one column is too small", () => {
  const words: Word[] = [[{ text: "a", font: "R" }], [{ text: "bc", font: "B" }]];
  expect(pack(words, 4)).toEqual([[[{ text: "a", font: "R" }], [{ text: "bc", font: "B" }]]]);
  expect(pack(words, 3)).toEqual([[[{ text: "a", font: "R" }]], [[{ text: "bc", font: "B" }]]]);
});

test("resets the running width on each row and retains word order", () => {
  expect(
    pack(
      [
        [{ text: "a", font: "R" }],
        [{ text: "bb", font: "I" }],
        [{ text: "c", font: "B" }],
        [{ text: "d", font: "R" }],
      ],
      4,
    ),
  ).toEqual([
    [[{ text: "a", font: "R" }], [{ text: "bb", font: "I" }]],
    [[{ text: "c", font: "B" }], [{ text: "d", font: "R" }]],
  ]);
});

test("allows an oversized first word and handles single, zero, and negative widths", () => {
  const oversized: Word = [{ text: "large", font: "B" }];
  expect(pack([oversized, [{ text: "a", font: "R" }], [{ text: "b", font: "I" }]], 3)).toEqual([
    [[{ text: "large", font: "B" }]],
    [[{ text: "a", font: "R" }], [{ text: "b", font: "I" }]],
  ]);
  expect(pack([oversized], 1)).toEqual([[[{ text: "large", font: "B" }]]]);
  expect(pack([[{ text: "a", font: "R" }], [{ text: "b", font: "R" }]], 0)).toEqual([
    [[{ text: "a", font: "R" }]],
    [[{ text: "b", font: "R" }]],
  ]);
  expect(pack([[{ text: "a", font: "R" }], [{ text: "b", font: "R" }]], -1)).toEqual([
    [[{ text: "a", font: "R" }]],
    [[{ text: "b", font: "R" }]],
  ]);
});

test("keeps mixed-font NB words intact and wraps by UTF-16 astral width", () => {
  const nonbreakingWord: Word = [
    { text: `a${NB}`, font: "B" },
    { text: "😀", font: "I" },
  ];
  expect(widthOf(nonbreakingWord)).toBe(4);
  expect(pack([nonbreakingWord, [{ text: "z", font: "R" }]], 5)).toEqual([
    [
      [
        { text: `a${NB}`, font: "B" },
        { text: "😀", font: "I" },
      ],
    ],
    [[{ text: "z", font: "R" }]],
  ]);
});
