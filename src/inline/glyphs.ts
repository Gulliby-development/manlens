export const NB = "\u0001";

export function glyph(name: string): string | undefined {
  switch (name) {
    case "em":
      return "--";
    case "en":
    case "hy":
      return "-";
    case "bu":
      return "o";
    case "co":
      return "(C)";
    case "rg":
      return "(R)";
    case "lq":
    case "rq":
    case "dq":
      return '"';
    case "oq":
    case "cq":
    case "aq":
      return "'";
    default:
      return undefined;
  }
}

export function isControl(ch: string): boolean {
  const codePoint = ch.codePointAt(0);
  return (
    codePoint !== undefined &&
    ((codePoint >= 0x00 && codePoint <= 0x08) ||
      (codePoint >= 0x0a && codePoint <= 0x1f) ||
      (codePoint >= 0x7f && codePoint <= 0x9f))
  );
}
