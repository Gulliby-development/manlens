import { readFileSync } from "node:fs";
import type { Io } from "./base/inputs";
import { run } from "./cli/cli";

const io: Io = {
  readStdin(): Uint8Array {
    return readFileSync(0);
  },
  readFile(path: string): Uint8Array {
    return readFileSync(path);
  },
  out(text: string): void {
    process.stdout.write(text);
  },
  err(text: string): void {
    process.stderr.write(text);
  },
};

process.exitCode = run(process.argv.slice(2), io);
