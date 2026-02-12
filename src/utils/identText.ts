import wrapAnsi from "wrap-ansi";

/**
 * Wraps and indents long strings so that new lines
 * align with the start of the first line.
 */
export function indentText(
  text: string,
  indentSize: number = 3,
  width: number = 80,
): string {
  const padding = " ".repeat(indentSize);

  // 1. Wrap the text to a specific width minus the padding
  const wrapped = wrapAnsi(text, width - indentSize, { hard: true });

  // 2. Prefix every line with the padding
  return wrapped
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}
