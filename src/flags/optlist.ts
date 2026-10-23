export interface OptItem {
  name: string;
  arg: string | null;
  optional: boolean;
}

export interface Entry {
  names: string[];
  arg: { name: string; optional: boolean } | null;
  line: number;
}

function isLetterOrDigit(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
}

function isIdentifierStart(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_";
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || (ch >= "0" && ch <= "9") || ch === "-";
}

function trimItem(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && (text[start] === " " || text[start] === "\t")) {
    start += 1;
  }
  while (end > start && (text[end - 1] === " " || text[end - 1] === "\t")) {
    end -= 1;
  }
  return text.slice(start, end);
}

function parseAtom(text: string, start: number): { value: string; end: number } | null {
  if (text[start] === "<") {
    let end = start + 1;
    while (end < text.length && text[end] !== ">") {
      if (text[end] === "<" || text[end] === "," || text[end] === " " || text[end] === "\t") {
        return null;
      }
      end += 1;
    }
    if (end === start + 1 || end >= text.length) {
      return null;
    }
    return { value: text.slice(start, end + 1), end: end + 1 };
  }

  if (!isIdentifierStart(text[start] ?? "")) {
    return null;
  }
  let end = start + 1;
  while (end < text.length && isIdentifierPart(text[end] ?? "")) {
    end += 1;
  }
  return { value: text.slice(start, end), end };
}

function parseArgument(
  text: string,
  start: number,
  separated: boolean,
): { arg: string; optional: boolean; end: number } | null {
  if (!separated && text[start] === "=") {
    const atom = parseAtom(text, start + 1);
    return atom === null ? null : { arg: atom.value, optional: false, end: atom.end };
  }

  if (text[start] === "[") {
    const hasEquals = text[start + 1] === "=";
    if (hasEquals === separated) {
      return null;
    }
    const atom = parseAtom(text, start + (hasEquals ? 2 : 1));
    if (atom === null || text[atom.end] !== "]") {
      return null;
    }
    return { arg: atom.value, optional: true, end: atom.end + 1 };
  }

  if (separated) {
    const atom = parseAtom(text, start);
    return atom === null ? null : { arg: atom.value, optional: false, end: atom.end };
  }

  return null;
}

function parseItem(text: string): OptItem | null {
  let index = 0;
  let name: string;

  if (text.startsWith("--")) {
    index = 2;
    if (!isLetterOrDigit(text[index] ?? "")) {
      return null;
    }
    index += 1;
    while (index < text.length && (isLetterOrDigit(text[index] ?? "") || text[index] === "-")) {
      index += 1;
    }
    name = text.slice(0, index);
  } else if (text[0] === "-" && isLetterOrDigit(text[1] ?? "")) {
    name = text.slice(0, 2);
    index = 2;
  } else {
    return null;
  }

  if (index === text.length) {
    return { name, arg: null, optional: false };
  }

  if (text[index] === "=" || (text[index] === "[" && text[index + 1] === "=")) {
    const parsed = parseArgument(text, index, false);
    if (parsed === null || parsed.end !== text.length) {
      return null;
    }
    return { name, arg: parsed.arg, optional: parsed.optional };
  }

  if (text[index] === " " || text[index] === "\t") {
    while (text[index] === " " || text[index] === "\t") {
      index += 1;
    }
    const parsed = parseArgument(text, index, true);
    if (parsed === null || parsed.end !== text.length) {
      return null;
    }
    return { name, arg: parsed.arg, optional: parsed.optional };
  }

  return null;
}

export function parseOptlist(text: string): OptItem[] | null {
  if (text.length === 0) {
    return null;
  }

  const items = text.split(",").map(trimItem);
  if (items.length === 0 || items.some((item) => item.length === 0)) {
    return null;
  }

  const parsed: OptItem[] = [];
  for (const item of items) {
    const entry = parseItem(item);
    if (entry === null) {
      return null;
    }
    parsed.push(entry);
  }
  return parsed;
}

export function entryOf(items: OptItem[], line: number): Entry {
  const names = items.map((item) => item.name);
  const firstArgument = items.find((item) => item.arg !== null);
  return {
    names,
    arg:
      firstArgument === undefined || firstArgument.arg === null
        ? null
        : { name: firstArgument.arg, optional: firstArgument.optional },
    line,
  };
}

export function argText(arg: Entry["arg"]): string {
  if (arg === null) {
    return "-";
  }
  return arg.optional ? `[${arg.name}]` : arg.name;
}
