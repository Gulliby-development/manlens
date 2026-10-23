import { plain, plural } from "../base/text";
import { argText, type Entry } from "./optlist";

export function driftReport(man: Entry[], help: Entry[]): { out: string; code: number } {
  const differences: string[] = [];

  for (const manEntry of man) {
    if (!help.some((helpEntry) => manEntry.names.some((name) => helpEntry.names.includes(name)))) {
      differences.push(
        `only in man: ${plain(manEntry.names.join(", "))} (man line ${manEntry.line})`,
      );
    }
  }

  for (const helpEntry of help) {
    if (!man.some((manEntry) => helpEntry.names.some((name) => manEntry.names.includes(name)))) {
      differences.push(
        `only in help: ${plain(helpEntry.names.join(", "))} (help line ${helpEntry.line})`,
      );
    }
  }

  for (const manEntry of man) {
    for (const helpEntry of help) {
      const sharedName = manEntry.names.find((name) => helpEntry.names.includes(name));
      if (sharedName !== undefined && (manEntry.arg === null) !== (helpEntry.arg === null)) {
        const manArg = manEntry.arg === null ? "none" : argText(manEntry.arg);
        const helpArg = helpEntry.arg === null ? "none" : argText(helpEntry.arg);
        differences.push(
          `argument differs: ${plain(sharedName)} (man ${plain(manArg)}, help ${plain(helpArg)}; man line ${manEntry.line}, help line ${helpEntry.line})`,
        );
      }
    }
  }

  for (const manEntry of man) {
    for (const helpEntry of help) {
      const sharedName = manEntry.names.find((name) => helpEntry.names.includes(name));
      const manNames = new Set(manEntry.names);
      const helpNames = new Set(helpEntry.names);
      const sameNames =
        sharedName !== undefined &&
        manNames.size === helpNames.size &&
        [...manNames].every((name) => helpNames.has(name));
      if (sharedName !== undefined && !sameNames) {
        differences.push(
          `names differ: ${plain(sharedName)} (man ${plain(manEntry.names.join(", "))}; help ${plain(helpEntry.names.join(", "))}; man line ${manEntry.line}, help line ${helpEntry.line})`,
        );
      }
    }
  }

  if (differences.length === 0) {
    return { out: `in sync, ${plural(man.length, "option")}\n`, code: 0 };
  }

  return {
    out: `${differences.join("\n")}\n${plural(differences.length, "difference")}\n`,
    code: 1,
  };
}
