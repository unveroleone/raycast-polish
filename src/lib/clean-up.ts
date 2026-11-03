// Cleans up text copied from a terminal: removes the shared left indent and joins hard-wrapped lines back into
// sentences. Pure code, no AI. Keeps list items, blank lines, headings, tables and fenced code blocks.

const LIST_ITEM = /^( *)([-*+•]|\d+[.)])\s+/;
const FENCE = /^ *(```|~~~)/;
const STRUCTURAL = /^ *(#{1,6} |>|\||<)/;
// Two or more spaces between words mean aligned columns (ls -l, ps, docker ps), not prose.
const COLUMNS = /\S {2,}\S/;
// Chinese, Japanese and Korean have no spaces between words, so wrapped lines join without one.
const CJK_END = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]$/;
const CJK_START = /^[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

interface Block {
  indent: number;
  textIndent: number;
  lastLength: number;
  columnar: boolean;
}

const indentOf = (line: string) => line.match(/^ */)![0].length;

// Chat apps like Teams turn pasted indentation into non-breaking spaces. Treat them as normal spaces.
const normalizeIndent = (line: string) => line.replace(/^[ \u00a0]+/, (m) => " ".repeat(m.length));

// Strong signal for text copied from a terminal: every line after the first is indented by at least two spaces.
// Normal prose from a mail or chat app never looks like that.
export function looksLikeTerminalCopy(text: string): boolean {
  const rest = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim())
    .slice(1);
  return rest.length >= 2 && rest.every((line) => /^[ \u00a0]{2,}/.test(line));
}

export function cleanUpText(input: string): string {
  const lines = input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeIndent(line.replace(/\s+$/, "")));

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

  // An odd number of fences means the selection starts or ends inside a code block. Only dedent then.
  const canMerge = dedented.filter((line) => FENCE.test(line)).length % 2 === 0;

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

    const columnar = COLUMNS.test(line.trim());

    if (canMerge && block && !listItem && !structural && !columnar && !block.columnar) {
      // Continuation of a list item: indented under the item's text, like "  - text\n    more text".
      const listContinuation = indent > block.indent && indent >= block.textIndent;
      // Continuation of a paragraph: same indent and the previous line was wrapped at the width.
      const paragraphContinuation = indent === block.indent && block.lastLength >= wrapThreshold;

      if (listContinuation || paragraphContinuation) {
        const previous = out[out.length - 1];
        const next = line.trim();
        out[out.length - 1] = previous + (CJK_END.test(previous) && CJK_START.test(next) ? "" : " ") + next;
        block.lastLength = line.length;
        continue;
      }
    }

    out.push(line);
    block = structural
      ? undefined
      : { indent, textIndent: listItem ? listItem[0].length : indent, lastLength: line.length, columnar };
  }

  const trailingNewlines = input.match(/\n*$/)![0];
  return out.join("\n").replace(/^\n+|\n+$/g, "") + trailingNewlines;
}
