import type { Run } from "../inline/spans";

export const KNOWN = [
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
  "br",
  "sp",
];

export function parseNumber(text: string): number | null {
  if (!/^[0-9]+n?$/u.test(text)) {
    return null;
  }

  const digits = text.endsWith("n") ? text.slice(0, -1) : text;
  const value = Number(digits);
  return value <= 100 ? value : null;
}

export function expandTabs(raw: string): string {
  let expanded = "";
  let column = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === "\t") {
      const spaces = 8 - (column % 8);
      expanded += " ".repeat(spaces);
      column += spaces;
    } else {
      expanded += character;
      column += 1;
    }
  }

  return expanded;
}

export function trimRuns(runs: Run[]): Run[] {
  let end = runs.length;

  while (end > 0) {
    const last = runs[end - 1];
    if (last === undefined) {
      end -= 1;
      continue;
    }

    const text = last.text.replace(/ +$/u, "");
    if (text.length === 0) {
      end -= 1;
      continue;
    }

    if (text !== last.text) {
      return [...runs.slice(0, end - 1), { text, font: last.font }];
    }

    return runs.slice(0, end);
  }

  return [];
}
