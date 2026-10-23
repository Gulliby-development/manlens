import type { Run, Word } from "../inline/spans";
import type { Problem } from "../roff/lines";

export interface Seg {
  gap: number;
  words: Word[];
}

export interface Row {
  gap: number;
  runs: Run[];
}

export type Block =
  | { kind: "heading"; level: 1 | 2; line: number; gap: number; runs: Run[] }
  | {
      kind: "item";
      line: number;
      gap: number;
      margin: number;
      indent: number;
      tag: Run[] | null;
      segs: Seg[];
    }
  | { kind: "pre"; line: number; margin: number; indent: number; rows: Row[] };

export interface Title {
  name: string;
  section: string;
  date: string;
  source: string;
  manual: string;
}

export interface Doc {
  title: Title | null;
  blocks: Block[];
  problems: Problem[];
  lines: number;
}
