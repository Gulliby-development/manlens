import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

test("main reports malformed UTF-8 from real stdin with exact process bytes", () => {
  const result = Bun.spawnSync([process.execPath, "src/main.ts", "lint", "-"], {
    cwd: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
    stdin: new Uint8Array([0x61, 0xff, 0x0a]),
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });

  expect(result.exitCode).toBe(2);
  expect(new Uint8Array(result.stdout)).toEqual(new Uint8Array());
  expect(new Uint8Array(result.stderr)).toEqual(
    new TextEncoder().encode("manlens: <stdin>: input is not valid UTF-8\n"),
  );
}, 30_000);

test("README documents installation, commands, page language, and development", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");

  expect(readme).toContain("## Install");
  expect(readme).toContain("## Usage");
  expect(readme).toContain("## Page language");
  expect(readme).toContain("## Development");
  expect(readme).toContain(
    "manlens is an offline command-line tool for people who write manual pages for command-line programs in the classic man macro language.",
  );
  expect(readme).toContain(
    "It is designed for command-line authors who want to catch documentation problems and option drift without depending on the operating system's manual-page tools.",
  );
  expect(readme).toContain("bun run src/main.ts");
  expect(readme).toContain(
    "```text\n" +
      "usage: manlens render [--width N] [--ansi] FILE\n" +
      "       manlens markdown FILE\n" +
      "       manlens lint FILE\n" +
      "       manlens flags FILE\n" +
      "       manlens drift MAN HELP\n" +
      "```",
  );
  expect(readme).toContain("### Render example");
  expect(readme).toContain("bun run src/main.ts render --width 40 fetcher.1");
  expect(readme).toContain("FETCHER(1)\n\nNAME\n       fetcher - download files");
  expect(readme).toContain("### Drift example");
  expect(readme).toContain("bun run src/main.ts drift m.1 m.help");
  expect(readme).toContain("only in man: -x (man line 12)");
  expect(readme).toContain("6 differences");
  expect(readme).toContain(
    "`.TH`, `.SH`, `.SS`, `.PP`, `.P`, `.LP`, `.TP`, `.IP`, `.RS`, `.RE`, `.B`, `.I`, `.BR`, `.BI`, `.IB`, `.IR`, `.RB`, `.RI`, `.nf`, `.fi`, `.br`, and `.sp`.",
  );
  expect(readme).toContain(
    "`\\\\` and `\\e` for a backslash, `\\-` for a hyphen, `\\ ` for a non-breaking space, and `\\&` and `\\%` for no output.",
  );
  expect(readme).toContain(
    "`\\fR`, `\\fB`, and `\\fI` select roman, bold, and italic text; `\\fP` restores the previous font.",
  );
  expect(readme).toContain("bun run typecheck");
  expect(readme).toContain("bun run lint");
  expect(readme).toContain("bun test");
}, 30_000);
