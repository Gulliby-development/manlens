export function show(text: string): string {
  return `"${plain(text)}"`;
}

export function plain(text: string): string {
  return Array.from(text, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0x20 && codePoint <= 0x7e ? character : "?";
  }).join("");
}

export function line(key: string, value: string): string {
  return `${key}${" ".repeat(Math.max(0, 10 - key.length))}  ${value}\n`;
}

export function table(header: string[], rows: string[][]): string {
  const allRows = [header, ...rows];
  const columnCount = allRows.reduce((count, cells) => Math.max(count, cells.length), 0);
  const widths = Array.from({ length: columnCount }, (_, column) =>
    allRows.reduce((width, cells) => Math.max(width, cells[column]?.length ?? 0), 0),
  );

  return allRows
    .map((cells) =>
      cells
        .map((cell, column) => `${cell}${" ".repeat(Math.max(0, widths[column] - cell.length))}`)
        .join("  ")
        .replace(/ +$/u, ""),
    )
    .map((row) => `${row}\n`)
    .join("");
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
