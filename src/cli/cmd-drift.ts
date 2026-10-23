import { type Io, readText } from "../base/inputs";
import { buildDoc } from "../doc/build";
import { helpEntries, manEntries } from "../flags/collect";
import { driftReport } from "../flags/drift";

export const USAGE = "       manlens drift MAN HELP";
export const ARGS = ["MAN", "HELP"];
export const FLAGS: string[] = [];
export const VALUES: string[] = [];

export function runDrift(
  args: string[],
  _flags: Set<string>,
  _values: Map<string, string>,
  io: Io,
): { out: string; code: number } {
  const manSource = readText(io, args[0]);
  const helpSource = readText(io, args[1]);
  const man = manEntries(buildDoc(manSource.text));
  return driftReport(man, helpEntries(helpSource.text));
}
