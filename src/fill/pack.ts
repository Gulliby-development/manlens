import type { Word } from "../inline/spans";
import { widthOf } from "./words";

export function pack(words: Word[], avail: number): Word[][] {
  const rows: Word[][] = [];
  let currentRow: Word[] = [];
  let currentWidth = 0;

  for (const word of words) {
    const wordWidth = widthOf(word);
    if (currentRow.length === 0) {
      currentRow.push(word);
      currentWidth = wordWidth;
    } else if (currentWidth + 1 + wordWidth <= avail) {
      currentRow.push(word);
      currentWidth += 1 + wordWidth;
    } else {
      rows.push(currentRow);
      currentRow = [word];
      currentWidth = wordWidth;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}
