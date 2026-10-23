import type { Block, Doc, Row } from "../doc/blocks";
import { pack } from "../fill/pack";
import { styleRuns, widthOf } from "../fill/words";

type Word = Extract<Block, { kind: "item" }>["segs"][number]["words"][number];

function spaces(count: number): string {
  return " ".repeat(Math.max(0, count));
}

function renderRuns(runs: Word, ansi: boolean, force?: Parameters<typeof styleRuns>[2]): string {
  let end = runs.length;
  while (end > 0) {
    const last = runs[end - 1];
    if (last === undefined) {
      end -= 1;
      continue;
    }

    let textEnd = last.text.length;
    while (textEnd > 0) {
      const char = last.text[textEnd - 1];
      if (char !== " " && char !== "\t" && char !== "\u0001") {
        break;
      }
      textEnd -= 1;
    }
    if (textEnd === 0) {
      end -= 1;
      continue;
    }

    const contentRuns =
      textEnd === last.text.length
        ? runs.slice(0, end)
        : [...runs.slice(0, end - 1), { text: last.text.slice(0, textEnd), font: last.font }];
    return styleRuns(contentRuns, ansi, force);
  }
  return "";
}

function renderWords(words: Word[], ansi: boolean): string {
  const row: Word = [];
  let hasWord = false;
  for (const word of words) {
    if (hasWord) {
      row.push({ text: " ", font: "R" });
    }
    row.push(...word);
    hasWord = true;
  }
  return renderRuns(row, ansi);
}

function renderRows(words: Word[], avail: number, ansi: boolean): string[] {
  return pack(words, avail).map((row) => renderWords(row, ansi));
}

export function renderDoc(doc: Doc, width: number, ansi: boolean): string {
  const lines: string[] = [];
  let titleSeparation = false;

  const emit = (content: string, gap = 0): void => {
    if (lines.length > 0) {
      const actualGap = titleSeparation ? Math.max(1, gap) : gap;
      for (let index = 0; index < actualGap; index += 1) {
        lines.push("");
      }
    }
    titleSeparation = false;
    lines.push(content);
  };

  if (doc.title !== null) {
    emit(`${doc.title.name}(${doc.title.section})`);
    titleSeparation = true;
  }

  const emitItem = (block: Extract<Block, { kind: "item" }>): void => {
    const bodycol = block.margin + block.indent;
    const avail = Math.max(10, width - bodycol);
    const packedSegments = block.segs.map((segment) => ({
      gap: segment.gap,
      rows: renderRows(segment.words, avail, ansi),
    }));
    const firstSegment = packedSegments[0];
    const firstBodyRow = firstSegment?.rows[0];
    const canShare =
      block.tag !== null &&
      firstSegment !== undefined &&
      firstSegment.gap === 0 &&
      firstBodyRow !== undefined &&
      firstBodyRow !== "" &&
      widthOf(block.tag) < block.indent;

    if (block.tag !== null) {
      if (canShare && firstBodyRow !== undefined) {
        const tagWidth = widthOf(block.tag);
        emit(
          spaces(block.margin) +
            styleRuns(block.tag, ansi) +
            spaces(bodycol - block.margin - tagWidth) +
            firstBodyRow,
          block.gap,
        );
      } else {
        const tag = renderRuns(block.tag, ansi);
        emit(tag === "" ? "" : spaces(block.margin) + tag, block.gap);
      }
    }

    let bodyStarted = false;
    for (let segmentIndex = 0; segmentIndex < packedSegments.length; segmentIndex += 1) {
      const segment = packedSegments[segmentIndex];
      if (segment === undefined) {
        continue;
      }
      let start = 0;
      if (canShare && segmentIndex === 0 && segment.rows.length > 0) {
        start = 1;
      }
      for (let rowIndex = start; rowIndex < segment.rows.length; rowIndex += 1) {
        const row = segment.rows[rowIndex];
        if (row !== undefined) {
          const firstBodyRow = !bodyStarted;
          const gap = rowIndex === start ? segment.gap : 0;
          emit(
            row === "" ? "" : spaces(bodycol) + row,
            gap + (block.tag === null && firstBodyRow ? block.gap : 0),
          );
          bodyStarted = true;
        }
      }
    }
  };

  const emitPreRow = (row: Row, block: Extract<Block, { kind: "pre" }>): void => {
    const content = renderRuns(row.runs, ansi);
    emit(content === "" ? "" : spaces(block.margin + block.indent) + content, row.gap);
  };

  for (const block of doc.blocks) {
    switch (block.kind) {
      case "heading": {
        const content = renderRuns(block.runs, ansi, "B");
        emit(content === "" ? "" : spaces(block.level === 2 ? 3 : 0) + content, block.gap);
        break;
      }
      case "item":
        emitItem(block);
        break;
      case "pre":
        for (const row of block.rows) {
          emitPreRow(row, block);
        }
        break;
    }
  }

  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
