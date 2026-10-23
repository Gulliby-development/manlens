import { show } from "../base/text";
import type { Font, Run, Word } from "../inline/spans";
import { decode, joinWords, mergeRuns, runsText, splitWords } from "../inline/spans";
import type { Problem } from "../roff/lines";
import { splitLines } from "../roff/lines";
import type { Arg, Item } from "../roff/request";
import { classify } from "../roff/request";
import type { Block, Doc, Title } from "./blocks";
import { expandTabs, KNOWN, parseNumber, trimRuns } from "./rules";

export function buildDoc(text: string): Doc {
  const { lines, problems: lineProblems, count } = splitLines(text);
  const problems: Problem[] = [...lineProblems];
  const blocks: Block[] = [];
  let title: Title | null = null;
  let firstContentSeen = false;
  let firstTitleSeen = false;
  let firstSectionSeen = false;
  let pending = 0;
  let fill = true;
  let nfLine: number | null = null;
  let prevailingIndent = 7;
  const rsStack: { indent: number; line: number }[] = [];
  let bodyIndent = 0;
  let openItem: Extract<Block, { kind: "item" }> | null = null;
  let openSegment: { gap: number; words: Word[] } | null = null;
  let openPre: Extract<Block, { kind: "pre" }> | null = null;
  let awaitedTag: { line: number; margin: number; indent: number } | null = null;

  const addProblem = (line: number, col: number, code: string, message: string): void => {
    problems.push({ line, col, code, text: message });
  };

  const reportBad = (
    line: number,
    bad: { at: number; text: string }[],
    argumentCol?: number,
  ): void => {
    for (const badEscape of bad) {
      addProblem(
        line,
        argumentCol ?? badEscape.at + 1,
        "MN002",
        `unknown escape ${show(badEscape.text)}`,
      );
    }
  };

  const decodeArgument = (line: number, arg: Arg, font: Font): Run[] => {
    const decoded = decode(arg.text, font);
    reportBad(line, decoded.bad, arg.col);
    return decoded.runs;
  };

  const wordsForArguments = (line: number, args: Arg[]): Word[] => {
    const runs: Run[] = [];
    let firstArgument = true;
    for (const arg of args) {
      if (!firstArgument) {
        runs.push({ text: " ", font: "R" });
      }
      firstArgument = false;
      for (const run of decodeArgument(line, arg, "R")) {
        runs.push(run);
      }
    }
    return splitWords(mergeRuns(runs));
  };

  const wordsForFontRequest = (line: number, name: string, args: Arg[]): Word[] => {
    if (args.length === 0) {
      addProblem(line, 1, "MN005", `${name} needs arguments`);
      return [];
    }

    const runs: Run[] = [];
    const alternating = name.length === 2 && name !== "B" && name !== "I";
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === undefined) {
        continue;
      }
      if (index > 0 && !alternating) {
        runs.push({ text: " ", font: "R" });
      }
      const font = alternating ? (name[index % 2] as Font) : (name as Font);
      for (const run of decodeArgument(line, arg, font)) {
        runs.push(run);
      }
    }
    return splitWords(mergeRuns(runs));
  };

  const currentMargin = (): number => 7 + rsStack.reduce((total, entry) => total + entry.indent, 0);

  const takePending = (): number => {
    const gap = pending;
    pending = 0;
    return gap;
  };

  const closeSegment = (): void => {
    openSegment = null;
  };

  const closeBlock = (): void => {
    openItem = null;
    openSegment = null;
    openPre = null;
    awaitedTag = null;
  };

  const recoverSectionOrEof = (): void => {
    if (!fill && nfLine !== null) {
      addProblem(nfLine, 1, "MN012", "nf is not closed before the end of its section");
    }
    fill = true;
    nfLine = null;
    for (const entry of rsStack) {
      addProblem(entry.line, 1, "MN010", "RS is not closed before the end of its section");
    }
    rsStack.length = 0;
  };

  const makeFilledContent = (line: number, words: Word[]): void => {
    if (awaitedTag !== null) {
      const wait = awaitedTag;
      awaitedTag = null;
      const item: Extract<Block, { kind: "item" }> = {
        kind: "item",
        line: wait.line,
        gap: takePending(),
        margin: wait.margin,
        indent: wait.indent,
        tag: words.length === 0 ? null : joinWords(words),
        segs: [],
      };
      blocks.push(item);
      openItem = item;
      openSegment = null;
      openPre = null;
      return;
    }

    if (openItem === null) {
      const item: Extract<Block, { kind: "item" }> = {
        kind: "item",
        line,
        gap: takePending(),
        margin: currentMargin(),
        indent: 0,
        tag: null,
        segs: [],
      };
      blocks.push(item);
      openItem = item;
      openSegment = null;
      openPre = null;
      bodyIndent = 0;
    }

    if (openItem !== null && openSegment === null) {
      const segment = { gap: takePending(), words: [] as Word[] };
      openItem.segs.push(segment);
      openSegment = segment;
    }
    if (openSegment !== null) {
      for (const word of words) {
        openSegment.words.push(word);
      }
    }
  };

  const makePreRow = (line: number, runs: Run[]): void => {
    if (openPre === null) {
      openPre = {
        kind: "pre",
        line,
        margin: currentMargin(),
        indent: bodyIndent,
        rows: [],
      };
      blocks.push(openPre);
      openItem = null;
      openSegment = null;
    }
    openPre.rows.push({ gap: takePending(), runs });
  };

  const handleText = (line: number, raw: string): void => {
    if (fill || awaitedTag !== null) {
      const decoded = decode(raw, "R");
      reportBad(line, decoded.bad);
      makeFilledContent(line, splitWords(decoded.runs));
      return;
    }

    const sourceDecoded = decode(raw, "R");
    reportBad(line, sourceDecoded.bad);
    const outputDecoded = decode(expandTabs(raw), "R");
    makePreRow(line, trimRuns(outputDecoded.runs));
  };

  const handleTitle = (line: number, args: Arg[]): void => {
    if (firstTitleSeen) {
      addProblem(line, 1, "MN008", "TH appears more than once");
      return;
    }
    firstTitleSeen = true;
    if (args.length < 2) {
      addProblem(line, 1, "MN005", "TH needs a name and a section");
      return;
    }

    const values = ["", "", "", "", ""];
    for (let index = 0; index < Math.min(args.length, values.length); index += 1) {
      const arg = args[index];
      if (arg !== undefined) {
        values[index] = runsText(decodeArgument(line, arg, "R"));
      }
    }
    title = {
      name: values[0] ?? "",
      section: values[1] ?? "",
      date: values[2] ?? "",
      source: values[3] ?? "",
      manual: values[4] ?? "",
    };
  };

  const handleHeading = (line: number, level: 1 | 2, name: "SH" | "SS", args: Arg[]): void => {
    if (args.length === 0) {
      addProblem(line, 1, "MN005", `${name} needs arguments`);
      return;
    }

    recoverSectionOrEof();
    closeBlock();
    prevailingIndent = 7;
    bodyIndent = 0;
    const words = wordsForArguments(line, args);
    const runs = joinWords(words);
    if (level === 1 && !firstSectionSeen) {
      firstSectionSeen = true;
      if (runsText(runs) !== "NAME") {
        addProblem(line, 1, "MN011", "the first section is not NAME");
      }
    }
    blocks.push({
      kind: "heading",
      level,
      line,
      gap: Math.max(pending, 1),
      runs,
    });
    pending = 0;
  };

  const handleParagraph = (): void => {
    closeBlock();
    pending = Math.max(pending, 1);
    prevailingIndent = 7;
    bodyIndent = 0;
  };

  const handleTp = (line: number, args: Arg[]): void => {
    closeBlock();
    pending = Math.max(pending, 1);
    if (args.length > 0) {
      const parsed = parseNumber(args[0]?.text ?? "");
      if (parsed === null) {
        const arg = args[0];
        if (arg !== undefined) {
          addProblem(line, arg.col, "MN006", `invalid number ${show(arg.text)}`);
        }
      } else {
        prevailingIndent = parsed;
      }
    }
    bodyIndent = prevailingIndent;
    awaitedTag = { line, margin: currentMargin(), indent: prevailingIndent };
  };

  const handleIp = (line: number, args: Arg[]): void => {
    closeBlock();
    pending = Math.max(pending, 1);
    const tagArg = args[0];
    const words = tagArg === undefined ? [] : splitWords(decodeArgument(line, tagArg, "R"));
    if (args.length > 1) {
      const arg = args[1];
      if (arg !== undefined) {
        const parsed = parseNumber(arg.text);
        if (parsed === null) {
          addProblem(line, arg.col, "MN006", `invalid number ${show(arg.text)}`);
        } else {
          prevailingIndent = parsed;
        }
      }
    }
    bodyIndent = prevailingIndent;
    const item: Extract<Block, { kind: "item" }> = {
      kind: "item",
      line,
      gap: takePending(),
      margin: currentMargin(),
      indent: prevailingIndent,
      tag: words.length === 0 ? null : joinWords(words),
      segs: [],
    };
    blocks.push(item);
    openItem = item;
  };

  const handleNumberForSpacing = (line: number, args: Arg[], fallback = 1): number => {
    if (args.length === 0) {
      return fallback;
    }
    const arg = args[0];
    if (arg === undefined) {
      return fallback;
    }
    const parsed = parseNumber(arg.text);
    if (parsed === null) {
      addProblem(line, arg.col, "MN006", `invalid number ${show(arg.text)}`);
      return fallback;
    }
    return parsed;
  };

  const processRequest = (item: Extract<Item, { kind: "request" }>, line: number): void => {
    for (const problem of item.problems) {
      problems.push(problem);
    }
    if (!KNOWN.includes(item.name)) {
      addProblem(line, item.col, "MN003", `unknown request ${show(item.name)}`);
      return;
    }

    switch (item.name) {
      case "TH":
        handleTitle(line, item.args);
        return;
      case "SH":
        handleHeading(line, 1, "SH", item.args);
        return;
      case "SS":
        handleHeading(line, 2, "SS", item.args);
        return;
      case "PP":
      case "P":
      case "LP":
        handleParagraph();
        return;
      case "TP":
        handleTp(line, item.args);
        return;
      case "IP":
        handleIp(line, item.args);
        return;
      case "RS": {
        closeBlock();
        const value = handleNumberForSpacing(line, item.args, prevailingIndent);
        rsStack.push({ indent: value, line });
        bodyIndent = 0;
        return;
      }
      case "RE":
        closeBlock();
        if (rsStack.length === 0) {
          addProblem(line, 1, "MN009", "RE without RS");
        } else {
          rsStack.pop();
        }
        bodyIndent = 0;
        return;
      case "nf":
        if (!fill) {
          return;
        }
        closeBlock();
        fill = false;
        nfLine = line;
        return;
      case "fi":
        closeBlock();
        if (fill) {
          addProblem(line, 1, "MN013", "fi without nf");
        } else {
          fill = true;
          nfLine = null;
        }
        return;
      case "br":
        if (awaitedTag === null) {
          closeSegment();
        }
        return;
      case "sp":
        if (awaitedTag !== null) {
          return;
        }
        pending = Math.max(pending, handleNumberForSpacing(line, item.args));
        closeSegment();
        return;
      case "B":
      case "I":
      case "BR":
      case "BI":
      case "IB":
      case "IR":
      case "RB":
      case "RI":
        {
          const words = wordsForFontRequest(line, item.name, item.args);
          if (fill || awaitedTag !== null) {
            makeFilledContent(line, words);
          } else {
            makePreRow(line, joinWords(words));
          }
        }
        return;
      default:
        return;
    }
  };

  for (const logical of lines) {
    const item = classify(logical);
    if (item.kind === "skip") {
      continue;
    }

    if (item.kind === "blank") {
      if (awaitedTag !== null) {
        continue;
      }
      if (fill) {
        closeSegment();
        pending = Math.max(pending, 1);
      } else {
        pending += 1;
      }
      continue;
    }

    if (!firstContentSeen) {
      firstContentSeen = true;
      if (item.kind !== "request" || item.name !== "TH") {
        addProblem(logical.line, 1, "MN007", "the page does not start with TH");
      }
    }

    if (item.kind === "text") {
      handleText(logical.line, item.text);
    } else {
      processRequest(item, logical.line);
    }
  }

  recoverSectionOrEof();
  closeBlock();

  const sortedProblems = problems
    .map((problem, order) => ({ problem, order }))
    .sort((left, right) => {
      if (left.problem.line !== right.problem.line) {
        return left.problem.line - right.problem.line;
      }
      if (left.problem.col !== right.problem.col) {
        return left.problem.col - right.problem.col;
      }
      if (left.problem.code < right.problem.code) {
        return -1;
      }
      if (left.problem.code > right.problem.code) {
        return 1;
      }
      return left.order - right.order;
    })
    .map(({ problem }) => problem);

  return { title, blocks, problems: sortedProblems, lines: count };
}
