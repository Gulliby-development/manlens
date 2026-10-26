import { Fail } from "../base/fail";
import type { Io } from "../base/inputs";
import { parseOptions } from "../base/options";
import { show } from "../base/text";
import {
  ARGS as driftArgs,
  FLAGS as driftFlags,
  USAGE as driftUsage,
  VALUES as driftValues,
  runDrift,
} from "./cmd-drift";
import {
  ARGS as flagsArgs,
  FLAGS as flagsFlags,
  USAGE as flagsUsage,
  VALUES as flagsValues,
  runFlags,
} from "./cmd-flags";
import {
  ARGS as lintArgs,
  FLAGS as lintFlags,
  USAGE as lintUsage,
  VALUES as lintValues,
  runLint,
} from "./cmd-lint";
import {
  ARGS as markdownArgs,
  FLAGS as markdownFlags,
  USAGE as markdownUsage,
  VALUES as markdownValues,
  runMarkdown,
} from "./cmd-markdown";
import {
  ARGS as renderArgs,
  FLAGS as renderFlags,
  USAGE as renderUsage,
  VALUES as renderValues,
  runRender,
} from "./cmd-render";

interface Command {
  name: string;
  usage: string;
  args: string[];
  flags: string[];
  values: string[];
  run(
    args: string[],
    flags: Set<string>,
    values: Map<string, string>,
    io: Io,
  ): { out: string; code: number };
}

const commands: Command[] = [
  {
    name: "render",
    usage: renderUsage,
    args: renderArgs,
    flags: renderFlags,
    values: renderValues,
    run: runRender,
  },
  {
    name: "markdown",
    usage: markdownUsage,
    args: markdownArgs,
    flags: markdownFlags,
    values: markdownValues,
    run: runMarkdown,
  },
  {
    name: "lint",
    usage: lintUsage,
    args: lintArgs,
    flags: lintFlags,
    values: lintValues,
    run: runLint,
  },
  {
    name: "flags",
    usage: flagsUsage,
    args: flagsArgs,
    flags: flagsFlags,
    values: flagsValues,
    run: runFlags,
  },
  {
    name: "drift",
    usage: driftUsage,
    args: driftArgs,
    flags: driftFlags,
    values: driftValues,
    run: runDrift,
  },
];

export function run(argv: string[], io: Io): number {
  try {
    if (argv.length === 1 && argv[0] === "--help") {
      io.out(`${commands.map((command) => command.usage).join("\n")}\n`);
      return 0;
    }

    const [commandName] = argv;
    if (commandName === undefined) {
      throw new Fail("missing command (render, markdown, lint, flags or drift)");
    }

    const command = commands.find((candidate) => candidate.name === commandName);
    if (command === undefined) {
      throw new Fail(`unknown command ${show(commandName)}`);
    }

    const parsed = parseOptions(argv.slice(1), command.flags, command.values);
    for (let index = 0; index < command.args.length; index += 1) {
      if (parsed.args[index] === undefined) {
        throw new Fail(`missing ${command.args[index]}`);
      }
    }
    if (parsed.args.length > command.args.length) {
      throw new Fail("too many arguments");
    }

    const result = command.run(parsed.args, parsed.flags, parsed.values, io);
    io.out(result.out);
    return result.code;
  } catch (error) {
    if (!(error instanceof Fail)) {
      throw error;
    }
    io.err(`manlens: ${error.message}\n`);
    return 2;
  }
}
