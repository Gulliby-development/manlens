import { Fail } from "../base/fail";
import type { Io } from "../base/inputs";
import { readText } from "../base/inputs";
import { show } from "../base/text";
import { lintReport } from "../check/report";
import { buildDoc } from "../doc/build";

export const USAGE = "       manlens lint [--only CODES] FILE";
export const ARGS = ["FILE"];
export const FLAGS: string[] = [];
export const VALUES = ["--only"];

function parseOnly(value: string | undefined): Set<string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const codes = new Set<string>();
  for (const code of value.split(",")) {
    if (!/^MN0(0[1-9]|1[0-3])$/u.test(code)) {
      throw new Fail(`unknown problem code ${show(code)}`);
    }
    codes.add(code);
  }
  return codes;
}

export function runLint(
  args: string[],
  _flags: Set<string>,
  values: Map<string, string>,
  io: Io,
): { out: string; code: number } {
  const only = parseOnly(values.get("--only"));
  const source = readText(io, args[0] ?? "");
  return lintReport(source.display, buildDoc(source.text), only);
}
