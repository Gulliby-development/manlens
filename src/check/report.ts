import { plain, plural } from "../base/text";
import type { Doc } from "../doc/blocks";

export function lintReport(display: string, doc: Doc): { out: string; code: number } {
  if (doc.problems.length === 0) {
    return { out: `ok, ${plural(doc.lines, "line")}\n`, code: 0 };
  }

  const diagnostics = doc.problems
    .map(
      (problem) =>
        `${plain(display)}:${problem.line}:${problem.col}: ${plain(problem.code)} ${plain(problem.text)}\n`,
    )
    .join("");

  return {
    out: `${diagnostics}${plural(doc.problems.length, "problem")}\n`,
    code: 1,
  };
}
