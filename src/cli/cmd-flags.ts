import { type Io, readText } from "../base/inputs";
import { buildDoc } from "../doc/build";
import { flagsTable, manEntries } from "../flags/collect";

export const USAGE = "       manlens flags FILE";
export const ARGS = ["FILE"];
export const FLAGS: string[] = [];
export const VALUES: string[] = [];

export function runFlags(
  args: string[],
  _flags: Set<string>,
  _values: Map<string, string>,
  io: Io,
): { out: string; code: number } {
  const source = readText(io, args[0]);
  const doc = buildDoc(source.text);
  return { out: flagsTable(manEntries(doc)), code: 0 };
}
