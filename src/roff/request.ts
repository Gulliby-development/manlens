import type { Logical, Problem } from "./lines";

export interface Arg {
  text: string;
  col: number;
}

export type Item =
  | { kind: "skip" }
  | { kind: "blank" }
  | { kind: "text"; text: string }
  | { kind: "request"; name: string; col: number; args: Arg[]; problems: Problem[] };

function isBlank(character: string | undefined): boolean {
  return character === " " || character === "\t";
}

function codePointLength(text: string, index: number): number {
  const codePoint = text.codePointAt(index);
  return codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
}

function isWhitespaceOnly(text: string): boolean {
  for (const character of text) {
    if (character !== " " && character !== "\t") {
      return false;
    }
  }
  return true;
}

function readQuoted(text: string, start: number): { text: string; end: number; closed: boolean } {
  let value = "";
  let index = start + 1;

  while (index < text.length) {
    if (text[index] === '"') {
      if (text[index + 1] === '"') {
        value += '"';
        index += 2;
      } else {
        return { text: value, end: index + 1, closed: true };
      }
    } else {
      value += text[index];
      index += 1;
    }
  }

  return { text: value, end: index, closed: false };
}

function readUnquoted(text: string, start: number): { text: string; end: number } {
  let index = start;
  while (index < text.length && !isBlank(text[index])) {
    if (text[index] === "\\") {
      index += 1;
      if (index < text.length) {
        index += codePointLength(text, index);
      }
    } else {
      index += codePointLength(text, index);
    }
  }
  return { text: text.slice(start, index), end: index };
}

export function classify(l: Logical): Item {
  if (isWhitespaceOnly(l.text)) {
    return l.comment ? { kind: "skip" } : { kind: "blank" };
  }

  if (l.text[0] !== ".") {
    return { kind: "text", text: l.text };
  }

  let index = 1;
  while (isBlank(l.text[index])) {
    index += 1;
  }
  const nameStart = index;
  while (index < l.text.length && !isBlank(l.text[index])) {
    index += codePointLength(l.text, index);
  }
  if (nameStart === index) {
    return { kind: "skip" };
  }

  const name = l.text.slice(nameStart, index);
  const col = nameStart + 1;
  const args: Arg[] = [];
  const problems: Problem[] = [];

  while (index < l.text.length) {
    while (isBlank(l.text[index])) {
      index += 1;
    }
    if (index >= l.text.length) {
      break;
    }

    const start = index;
    if (l.text[index] === '"') {
      const quoted = readQuoted(l.text, index);
      args.push({ text: quoted.text, col: start + 1 });
      if (!quoted.closed) {
        problems.push({
          line: l.line,
          col: start + 1,
          code: "MN004",
          text: "unterminated quoted argument",
        });
      }
      index = quoted.end;
    } else {
      const unquoted = readUnquoted(l.text, index);
      args.push({ text: unquoted.text, col: start + 1 });
      index = unquoted.end;
    }
  }

  return { kind: "request", name, col, args, problems };
}
