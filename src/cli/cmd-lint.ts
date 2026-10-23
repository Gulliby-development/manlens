import type { Io } from "../base/inputs";
import { readText } from "../base/inputs";
import { lintReport } from "../check/report";
import { buildDoc } from "../doc/build";

export const USAGE = "       manlens lint FILE";
export const ARGS = ["FILE"];
export const FLAGS: string[] = [];
export const VALUES: string[] = [];

export function runLint(
  args: string[],
  _flags: Set<string>,
  _values: Map<string, string>,
  io: Io,
): { out: string; code: number } {
  const source = readText(io, args[0] ?? "");
  return lintReport(source.display, buildDoc(source.text));
}
