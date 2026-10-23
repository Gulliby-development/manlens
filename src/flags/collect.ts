import { plain, table } from "../base/text";
import type { Doc } from "../doc/blocks";
import { runsText } from "../inline/spans";
import type { Entry } from "./optlist";
import { argText, entryOf, parseOptlist } from "./optlist";

export function manEntries(doc: Doc): Entry[] {
  const entries: Entry[] = [];
  for (const block of doc.blocks) {
    if (block.kind !== "item" || block.tag === null) {
      continue;
    }
    const items = parseOptlist(runsText(block.tag));
    if (items !== null) {
      entries.push(entryOf(items, block.line));
    }
  }
  return entries;
}

export function helpEntries(text: string): Entry[] {
  const entries: Entry[] = [];
  const lines = text.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    let start = 0;
    while (line[start] === " " || line[start] === "\t") {
      start += 1;
    }
    if (line[start] !== "-") {
      continue;
    }

    let end = line.length;
    for (let index = start; index < line.length; index += 1) {
      if (line[index] === "\t") {
        end = index;
        break;
      }
      if (line[index] === " " && index + 1 < line.length && line[index + 1] === " ") {
        end = index;
        break;
      }
    }

    const items = parseOptlist(line.slice(start, end));
    if (items !== null) {
      entries.push(entryOf(items, lineIndex + 1));
    }
  }
  return entries;
}

export function flagsTable(entries: Entry[]): string {
  if (entries.length === 0) {
    return "";
  }
  const rows = entries.map((entry) => [
    plain(entry.names.join(", ")),
    plain(argText(entry.arg)),
    String(entry.line),
  ]);
  return table(["OPTIONS", "ARG", "LINE"], rows);
}
