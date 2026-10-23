import { NB } from "../inline/glyphs";
import type { Font, Run } from "../inline/spans";
import { runsText } from "../inline/spans";

export function widthOf(runs: Run[]): number {
  return runsText(runs).length;
}

export function styleRuns(runs: Run[], ansi: boolean, force?: Font): string {
  return runs
    .map((run) => {
      const text = run.text.replaceAll(NB, " ");
      if (!ansi) {
        return text;
      }

      const font = force ?? run.font;
      if (font === "B") {
        return `\u001b[1m${text}\u001b[22m`;
      }
      if (font === "I") {
        return `\u001b[4m${text}\u001b[24m`;
      }
      return text;
    })
    .join("");
}
