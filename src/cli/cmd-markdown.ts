import { type Io, readText } from "../base/inputs";
import { toMarkdown } from "../convert/markdown";
import { buildDoc } from "../doc/build";

export const USAGE: string = "       manlens markdown FILE";
export const ARGS: string[] = ["FILE"];
export const FLAGS: string[] = [];
export const VALUES: string[] = [];

export function runMarkdown(
  args: string[],
  flags: Set<string>,
  values: Map<string, string>,
  io: Io,
): { out: string; code: number } {
  void flags;
  void values;
  const source = readText(io, args[0] ?? "");
  return { out: toMarkdown(buildDoc(source.text)), code: 0 };
}
