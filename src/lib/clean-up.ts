// Cleans up text copied from a terminal: removes the shared left indent and joins hard-wrapped lines back into
// sentences. Pure code, no AI. Keeps list items, blank lines, headings, tables and fenced code blocks.

const LIST_ITEM = /^( *)([-*+•]|\d+[.)])\s+/;
const FENCE = /^ *(```|~~~)/;
const STRUCTURAL = /^ *(#{1,6} |>|\||<)/;

interface Block {
  indent: number;
  textIndent: number;
  lastLength: number;
}

const indentOf = (line: string) => line.match(/^ */)![0].length;

export function cleanUpText(input: string): string {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""));

  const contentLines = lines.filter((line) => line.trim());
  if (contentLines.length === 0) return input;

  // A terminal selection often starts mid-line, so the first line lacks the indent. Measure from the other lines.
  const firstIndex = lines.findIndex((line) => line.trim());
  const rest = contentLines.slice(1);
  const minIndent = Math.min(...(rest.length > 0 ? rest : contentLines).map(indentOf));
  const dedented = lines.map((line, i) =>
    i === firstIndex ? line.trimStart() : line.slice(Math.min(minIndent, indentOf(line))),
  );

  // Hard-wrapped lines end close to the terminal width. A shorter line ends its paragraph on purpose.
  const maxLength = Math.max(...dedented.map((line) => line.length));
  const wrapThreshold = Math.max(40, Math.floor(maxLength * 0.6));

  const out: string[] = [];
  let block: Block | undefined;
  let inFence = false;

  for (const line of dedented) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      out.push(line);
      block = undefined;
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (!line.trim()) {
      out.push("");
      block = undefined;
      continue;
    }

    const indent = indentOf(line);
    const listItem = line.match(LIST_ITEM);
    const structural = STRUCTURAL.test(line);

    if (block && !listItem && !structural) {
      // Continuation of a list item: indented under the item's text, like "  - text\n    more text".
      const listContinuation = indent > block.indent && indent >= block.textIndent;
      // Continuation of a paragraph: same indent and the previous line was wrapped at the width.
      const paragraphContinuation = indent === block.indent && block.lastLength >= wrapThreshold;

      if (listContinuation || paragraphContinuation) {
        out[out.length - 1] += ` ${line.trim()}`;
        block.lastLength = line.length;
        continue;
      }
    }

    out.push(line);
    block = structural
      ? undefined
      : { indent, textIndent: listItem ? listItem[0].length : indent, lastLength: line.length };
  }

  const trailingNewlines = input.match(/\n*$/)![0];
  return out.join("\n").replace(/^\n+|\n+$/g, "") + trailingNewlines;
}
