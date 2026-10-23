import { glyph, isControl, NB } from "./glyphs";

export type Font = "R" | "B" | "I";

export interface Run {
  text: string;
  font: Font;
}

export type Word = Run[];

export function decode(
  raw: string,
  font: Font,
): { runs: Run[]; bad: { at: number; text: string }[] } {
  const runs: Run[] = [];
  const bad: { at: number; text: string }[] = [];
  let current: Font = font;
  let previous: Font = "R";
  let index = 0;

  while (index < raw.length) {
    const start = index;
    const codePoint = raw.codePointAt(index);
    if (codePoint === undefined) {
      break;
    }
    const char = String.fromCodePoint(codePoint);
    index += codePoint > 0xffff ? 2 : 1;

    if (char !== "\\") {
      runs.push({ text: isControl(char) ? "?" : char, font: current });
      continue;
    }

    const escapedCodePoint = raw.codePointAt(index);
    if (escapedCodePoint === undefined) {
      bad.push({ at: start, text: "\\" });
      continue;
    }

    const escapedChar = String.fromCodePoint(escapedCodePoint);
    const escapedLength = escapedCodePoint > 0xffff ? 2 : 1;
    if (escapedChar === "\\") {
      runs.push({ text: "\\", font: current });
      index += escapedLength;
    } else if (escapedChar === "e") {
      runs.push({ text: "\\", font: current });
      index += escapedLength;
    } else if (escapedChar === "-") {
      runs.push({ text: "-", font: current });
      index += escapedLength;
    } else if (escapedChar === " ") {
      runs.push({ text: NB, font: current });
      index += escapedLength;
    } else if (escapedChar === "&" || escapedChar === "%") {
      index += escapedLength;
    } else if (escapedChar === "f") {
      const fontCodePoint = raw.codePointAt(index + escapedLength);
      const fontChar =
        fontCodePoint === undefined ? undefined : String.fromCodePoint(fontCodePoint);
      const fontLength = fontCodePoint === undefined ? 0 : fontCodePoint > 0xffff ? 2 : 1;
      if (fontChar === "R" || fontChar === "B" || fontChar === "I") {
        previous = current;
        current = fontChar;
        index += escapedLength + fontLength;
      } else if (fontChar === "P") {
        const oldCurrent = current;
        current = previous;
        previous = oldCurrent;
        index += escapedLength + fontLength;
      } else {
        bad.push({
          at: start,
          text: raw.slice(start, index + escapedLength + fontLength),
        });
        index += escapedLength + fontLength;
      }
    } else if (escapedChar === "(") {
      let name = "";
      let consumed = escapedLength;
      for (let count = 0; count < 2; count += 1) {
        const nameCodePoint = raw.codePointAt(index + consumed);
        if (nameCodePoint === undefined) {
          break;
        }
        name += String.fromCodePoint(nameCodePoint);
        consumed += nameCodePoint > 0xffff ? 2 : 1;
      }
      const replacement = name.length === 2 ? glyph(name) : undefined;
      if (replacement === undefined) {
        bad.push({ at: start, text: raw.slice(start, index + consumed) });
      } else {
        runs.push({ text: replacement, font: current });
      }
      index += consumed;
    } else {
      bad.push({
        at: start,
        text: raw.slice(start, index + escapedLength),
      });
      runs.push({ text: isControl(escapedChar) ? "?" : escapedChar, font: current });
      index += escapedLength;
    }
  }

  return { runs: mergeRuns(runs), bad };
}

export function splitWords(runs: Run[]): Word[] {
  const words: Word[] = [];
  let currentWord: Run[] = [];
  let fragment = "";
  let fragmentFont: Font | undefined;

  const flushFragment = (): void => {
    if (fragment.length > 0 && fragmentFont !== undefined) {
      currentWord.push({ text: fragment, font: fragmentFont });
    }
    fragment = "";
    fragmentFont = undefined;
  };

  const flushWord = (): void => {
    flushFragment();
    if (currentWord.length > 0) {
      words.push(mergeRuns(currentWord));
      currentWord = [];
    }
  };

  for (const run of runs) {
    let index = 0;
    while (index < run.text.length) {
      const codePoint = run.text.codePointAt(index);
      if (codePoint === undefined) {
        break;
      }
      const char = String.fromCodePoint(codePoint);
      index += codePoint > 0xffff ? 2 : 1;

      if (char === " " || char === "\t") {
        flushWord();
      } else {
        if (fragmentFont !== undefined && fragmentFont !== run.font) {
          flushFragment();
        }
        fragmentFont = run.font;
        fragment += char;
      }
    }
  }

  flushWord();
  return words;
}

export function joinWords(words: Word[]): Run[] {
  const runs: Run[] = [];
  for (let index = 0; index < words.length; index += 1) {
    if (index > 0) {
      runs.push({ text: " ", font: "R" });
    }
    runs.push(...words[index]);
  }
  return mergeRuns(runs);
}

export function runsText(runs: Run[]): string {
  return runs.map((run) => run.text.replaceAll(NB, " ")).join("");
}

export function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    if (run.text.length === 0) {
      continue;
    }
    const previous = merged.at(-1);
    if (previous?.font === run.font) {
      merged[merged.length - 1] = { text: previous.text + run.text, font: run.font };
    } else {
      merged.push({ text: run.text, font: run.font });
    }
  }
  return merged;
}
