import { plain, plural } from "../base/text";
import type { Doc } from "../doc/blocks";

export function lintReport(
  display: string,
  doc: Doc,
  only?: Set<string>,
): { out: string; code: number } {
  const problems =
    only === undefined ? doc.problems : doc.problems.filter((problem) => only.has(problem.code));
  if (problems.length === 0) {
    return { out: `ok, ${plural(doc.lines, "line")}\n`, code: 0 };
  }

  const diagnostics = problems
    .map(
      (problem) =>
        `${plain(display)}:${problem.line}:${problem.col}: ${plain(problem.code)} ${plain(problem.text)}\n`,
    )
    .join("");

  return {
    out: `${diagnostics}${plural(problems.length, "problem")}\n`,
    code: 1,
  };
}
