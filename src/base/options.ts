import { Fail } from "./fail";
import { show } from "./text";

export function parseOptions(
  argv: string[],
  flags: string[],
  values: string[],
): { flags: Set<string>; values: Map<string, string>; args: string[] } {
  const parsedFlags = new Set<string>();
  const parsedValues = new Map<string, string>();
  const args: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--")) {
      if (flags.includes(argument)) {
        parsedFlags.add(argument);
        continue;
      }

      if (values.includes(argument)) {
        if (index + 1 >= argv.length) {
          throw new Fail(`missing value for ${argument}`);
        }

        index += 1;
        parsedValues.set(argument, argv[index]);
        continue;
      }

      throw new Fail(`unknown option ${show(argument)}`);
    }

    args.push(argument);
  }

  return { flags: parsedFlags, values: parsedValues, args };
}
