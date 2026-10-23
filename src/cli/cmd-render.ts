import { Fail } from "../base/fail";
import type { Io } from "../base/inputs";
import { readText } from "../base/inputs";
import { show } from "../base/text";
import { buildDoc } from "../doc/build";
import { renderDoc } from "../render/plain";

export const USAGE = "usage: manlens render [--width N] [--ansi] FILE";
export const ARGS = ["FILE"];
export const FLAGS = ["--ansi"];
export const VALUES = ["--width"];

export function runRender(
  args: string[],
  flags: Set<string>,
  values: Map<string, string>,
  io: Io,
): { out: string; code: number } {
  const suppliedWidth = values.get("--width");
  let width = 78;
  if (suppliedWidth !== undefined) {
    if (!/^[1-9][0-9]*$/u.test(suppliedWidth)) {
      throw new Fail(`invalid --width ${show(suppliedWidth)} (expected 20 to 200)`);
    }
    width = Number(suppliedWidth);
    if (width < 20 || width > 200) {
      throw new Fail(`invalid --width ${show(suppliedWidth)} (expected 20 to 200)`);
    }
  }

  const source = readText(io, args[0] ?? "");
  const doc = buildDoc(source.text);
  return { out: renderDoc(doc, width, flags.has("--ansi")), code: 0 };
}
