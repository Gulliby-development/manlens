export interface Problem {
  line: number;
  col: number;
  code: string;
  text: string;
}

export interface Logical {
  line: number;
  text: string;
  comment: boolean;
}

function trailingBackslashes(text: string): number {
  let count = 0;
  for (let index = text.length - 1; index >= 0 && text[index] === "\\"; index -= 1) {
    count += 1;
  }
  return count;
}

function codePointLength(text: string, index: number): number {
  const codePoint = text.codePointAt(index);
  return codePoint !== undefined && codePoint > 0xff_ff ? 2 : 1;
}

function commentStart(text: string): number {
  for (let index = 0; index < text.length; ) {
    if (text[index] !== "\\" || index + 1 >= text.length) {
      index += codePointLength(text, index);
      continue;
    }
    if (text[index + 1] === '"') {
      return index;
    }
    index += 1 + codePointLength(text, index + 1);
  }
  return -1;
}

export function splitLines(text: string): {
  lines: Logical[];
  problems: Problem[];
  count: number;
} {
  const physical = text.length === 0 ? [] : text.split("\n");
  if (text.endsWith("\n")) {
    physical.pop();
  }

  const lines: Logical[] = [];
  const problems: Problem[] = [];
  const count = physical.length;

  for (let index = 0; index < physical.length; index += 1) {
    const firstLine = index + 1;
    let joined = physical[index] ?? "";

    while (trailingBackslashes(joined) % 2 === 1) {
      const column = joined.length;
      joined = joined.slice(0, -1);
      if (index + 1 >= physical.length) {
        problems.push({
          line: firstLine,
          col: column,
          code: "MN001",
          text: "backslash at the end of the input",
        });
        break;
      }
      index += 1;
      joined += physical[index] ?? "";
    }

    const start = commentStart(joined);
    const comment = start >= 0;
    const logicalText = comment ? joined.slice(0, start) : joined;
    lines.push({ line: firstLine, text: logicalText, comment });
  }

  return { lines, problems, count };
}
