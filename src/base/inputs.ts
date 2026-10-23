import { Fail } from "./fail";
import { plain } from "./text";

export interface Io {
  readStdin(): Uint8Array;
  readFile(path: string): Uint8Array;
  out(text: string): void;
  err(text: string): void;
}

export interface Source {
  display: string;
  text: string;
}

export function readText(io: Io, arg: string): Source {
  const isStdin = arg === "-";
  const display = isStdin ? "<stdin>" : plain(arg);
  let bytes: Uint8Array;

  try {
    bytes = isStdin ? io.readStdin() : io.readFile(arg);
  } catch {
    throw new Fail(`${display}: cannot read the file`);
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Fail(`${display}: input is not valid UTF-8`);
  }

  if (text.startsWith("\uFEFF")) {
    text = text.slice(1);
  }

  const bareCarriageReturn = text.search(/\r(?!\n)/u);
  if (bareCarriageReturn !== -1) {
    const line = text.slice(0, bareCarriageReturn).split("\n").length;
    throw new Fail(`${display}: bare carriage return at line ${line}`);
  }

  return { display, text: text.replace(/\r\n/gu, "\n") };
}
