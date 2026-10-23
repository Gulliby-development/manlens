import type { Block, Doc } from "../doc/blocks";
import { NB } from "../inline/glyphs";
import type { Run, Word } from "../inline/spans";
import { runsText } from "../inline/spans";

function escapeProse(text: string): string {
  let escaped = "";
  for (const char of text) {
    if (char === NB) {
      escaped += "&nbsp;";
    } else if ("\\`*_[]<>&#|~".includes(char)) {
      escaped += `\\${char}`;
    } else {
      escaped += char;
    }
  }
  return escaped;
}

function markdownRuns(runs: Run[], emphasis = true): string {
  return runs
    .map((run) => {
      const text = escapeProse(run.text);
      if (!emphasis || run.font === "R") {
        return text;
      }
      return run.font === "B" ? `**${text}**` : `*${text}*`;
    })
    .join("");
}

function markdownWords(words: Word[]): string {
  return words.map((word) => markdownRuns(word)).join(" ");
}

function markdownItem(block: Extract<Block, { kind: "item" }>): string {
  const words = block.segs.flatMap((segment) => segment.words);
  const body = markdownWords(words);
  if (block.tag === null) {
    return body;
  }
  if (runsText(block.tag) === "o") {
    return body.length === 0 ? "-" : `- ${body}`;
  }
  const tag = markdownRuns(block.tag);
  return body.length === 0 ? `- ${tag}` : `- ${tag}\n  ${body}`;
}

function markdownPre(block: Extract<Block, { kind: "pre" }>): string {
  let longestLeadingBackticks = 0;
  for (const row of block.rows) {
    const text = runsText(row.runs);
    let count = 0;
    while (text[count] === "`") {
      count += 1;
    }
    longestLeadingBackticks = Math.max(longestLeadingBackticks, count);
  }
  const fenceLength = longestLeadingBackticks >= 3 ? longestLeadingBackticks + 1 : 3;
  const fence = "`".repeat(fenceLength);
  const lines = [fence];
  for (const row of block.rows) {
    for (let count = 0; count < row.gap; count += 1) {
      lines.push("");
    }
    lines.push(runsText(row.runs));
  }
  lines.push(fence);
  return lines.join("\n");
}

function markdownBlock(block: Block): string {
  switch (block.kind) {
    case "heading":
      return `${block.level === 1 ? "##" : "###"} ${markdownRuns(block.runs, false)}`;
    case "item":
      return markdownItem(block);
    case "pre":
      return markdownPre(block);
  }
}

export function toMarkdown(doc: Doc): string {
  const blocks: string[] = [];
  if (doc.title !== null) {
    blocks.push(`# ${escapeProse(`${doc.title.name}(${doc.title.section})`)}`);
  }
  for (const block of doc.blocks) {
    blocks.push(markdownBlock(block));
  }
  return blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;
}
