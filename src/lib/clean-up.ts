// Cleans up text copied from a terminal: removes quote bars and the shared left indent and joins hard-wrapped lines
// back into sentences. Pure code, no AI. Keeps list items, blank lines, headings, tables and fenced code blocks.

const LIST_ITEM = /^( *)([-*+•]|\d+[.)])\s+/;
const FENCE = /^ *(```|~~~)/;
const STRUCTURAL = /^ *(#{1,6} |>|\||<)/;
// Two or more spaces between words mean aligned columns (ls -l, ps, docker ps), not prose.
const COLUMNS = /\S {2,}\S/;
// Chinese, Japanese and Korean have no spaces between words, so wrapped lines join without one.
const CJK_END = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]$/;
const CJK_START = /^[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;
const CJK_CHAR = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/g;

// Width in terminal columns: CJK characters take two columns.
const widthOf = (text: string) => text.length + (text.match(CJK_CHAR)?.length ?? 0);

// Width of the first word of a line. CJK has no spaces, so a single character is the smallest unit that can wrap.
const firstWordWidth = (line: string) => {
  const trimmed = line.trim();
  return CJK_START.test(trimmed) ? 2 : widthOf(trimmed.split(/\s+/)[0]);
};

interface Block {
  indent: number;
  textIndent: number;
  lastLength: number;
  columnar: boolean;
}

const indentOf = (line: string) => line.match(/^ */)![0].length;

// Chat apps like Teams turn pasted indentation into non-breaking spaces. Treat them as normal spaces.
const normalizeIndent = (line: string) => line.replace(/^[ \u00a0]+/, (m) => " ".repeat(m.length));

// Vertical bars that terminals draw left of quoted or highlighted blocks, e.g. "▎" in Claude Code.
const GUTTER_CHARS = "▎▍▌▋▊▉▏▕│┃║╎╏┆┇┊┋";
const GUTTER = new RegExp(`^( *)[${GUTTER_CHARS}] ?`);
const BAR_LATER = new RegExp(`.[${GUTTER_CHARS}]`);

// True when most lines start with a bar. Lines with a second bar are table rows ("│ a │ b │"), not a quote.
function hasGutter(lines: string[]): boolean {
  const content = lines.filter((line) => line.trim());
  const withGutter = content.filter((line) => GUTTER.test(line));
  if (withGutter.length < 2 || withGutter.length < content.length / 2) return false;
  return !withGutter.some((line) => BAR_LATER.test(line.trimStart()));
}

const normalizedLines = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => normalizeIndent(line.replace(/\s+$/, "")));

const toLines = (text: string) => {
  const lines = normalizedLines(text);
  return hasGutter(lines) ? lines.map((line) => line.replace(GUTTER, "$1").replace(/\s+$/, "")) : lines;
};

// Strong signal for text copied from a terminal: lines carry a quote bar, or every line after the first is indented
// by at least two spaces. Normal prose from a mail or chat app never looks like that.
export function looksLikeTerminalCopy(text: string): boolean {
  const lines = normalizedLines(text);
  if (hasGutter(lines)) return true;
  const rest = lines.filter((line) => line.trim()).slice(1);
  return rest.length >= 2 && rest.every((line) => /^ {2,}/.test(line));
}

export function cleanUpText(input: string): string {
  const lines = toLines(input);

  const contentLines = lines.filter((line) => line.trim());
  if (contentLines.length === 0) return input;

  // A terminal selection often starts mid-line, so the first line lacks the indent. Measure from the other lines.
  const firstIndex = lines.findIndex((line) => line.trim());
  const rest = contentLines.slice(1);
  const minIndent = Math.min(...(rest.length > 0 ? rest : contentLines).map(indentOf));
  const dedented = lines.map((line, i) =>
    i === firstIndex ? line.trimStart() : line.slice(Math.min(minIndent, indentOf(line))),
  );

  // The longest line approximates the terminal width. A line was wrapped by the terminal only if the next word would
  // not have fit on it. If it would have fit, the line break was intentional (e.g. a paragraph end in text whose
  // blank lines got lost, which happens when copying from Teams).
  const maxLength = Math.max(...dedented.map(widthOf));
  // Short texts have no real terminal width, so nothing counts as wrapped there.
  const wasWrapped = (previousLength: number, next: string) =>
    maxLength >= 60 && previousLength >= maxLength * 0.6 && previousLength + 1 + firstWordWidth(next) > maxLength;

  // An odd number of fences means the selection starts or ends inside a code block. Only dedent then.
  const canMerge = dedented.filter((line) => FENCE.test(line)).length % 2 === 0;

  const out: string[] = [];
  // Marks plain paragraph lines in `out`, used to put lost blank lines back between paragraphs.
  const isParagraph: boolean[] = [];
  let merged = false;
  let block: Block | undefined;
  let inFence = false;
  const push = (line: string, paragraph = false) => {
    out.push(line);
    isParagraph.push(paragraph);
  };

  for (const line of dedented) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      push(line);
      block = undefined;
      continue;
    }
    if (inFence) {
      push(line);
      continue;
    }
    if (!line.trim()) {
      push("");
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
      const paragraphContinuation = indent === block.indent && wasWrapped(block.lastLength, line);

      if (listContinuation || paragraphContinuation) {
        const previous = out[out.length - 1];
        const next = line.trim();
        out[out.length - 1] = previous + (CJK_END.test(previous) && CJK_START.test(next) ? "" : " ") + next;
        block.lastLength = widthOf(line);
        merged = true;
        continue;
      }
    }

    push(line, !listItem && !structural && !columnar);
    block = structural
      ? undefined
      : { indent, textIndent: listItem ? listItem[0].length : indent, lastLength: widthOf(line), columnar };
  }

  // Some apps (Teams) drop the blank lines when the selection is copied. If the text had none but was clearly wrapped,
  // separate the paragraphs again.
  const content = dedented.slice(firstIndex, dedented.findLastIndex((line) => line.trim()) + 1);
  const lostBlankLines = merged && !content.some((line) => !line.trim());
  const result = lostBlankLines
    ? out.map((line, i) => (i > 0 && isParagraph[i] && isParagraph[i - 1] ? `\n${line}` : line))
    : out;

  const trailingNewlines = input.match(/\n*$/)![0];
  return result.join("\n").replace(/^\n+|\n+$/g, "") + trailingNewlines;
}
