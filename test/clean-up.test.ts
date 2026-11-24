import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { cleanUpText, looksLikeTerminalCopy } from "../src/lib/clean-up.ts";

const lines = (...parts: string[]) => parts.join("\n");

describe("basics", () => {
  test("README example: unwraps list items and drops the indent", () => {
    const input = lines(
      "  - URLs and code are now left alone by",
      "    the replacement.",
      "  - Markdown and line breaks stay as",
      "    they are.",
    );
    assert.equal(
      cleanUpText(input),
      lines("- URLs and code are now left alone by the replacement.", "- Markdown and line breaks stay as they are."),
    );
  });

  test("short texts stay unchanged", () => {
    for (const input of ["Hi Anna,\nsee you tomorrow.\nLeo", "Line one\nLine two", "Done.", ""]) {
      assert.equal(cleanUpText(input), input);
    }
  });

  test("keeps the trailing newline", () => {
    assert.equal(cleanUpText("  first\n  second\n"), "first\nsecond\n");
  });

  test("numbered list items keep their continuation lines", () => {
    const input = lines("  1. Install the dependencies with pnpm", "     install.", "  2. Run pnpm dev once.");
    assert.equal(cleanUpText(input), lines("1. Install the dependencies with pnpm install.", "2. Run pnpm dev once."));
  });

  test("leaves fenced code and headings alone", () => {
    const input = lines(
      "  ## Setup",
      "  ```sh",
      "  pnpm install",
      "    && pnpm build",
      "  ```",
      "  Then open Raycast.",
    );
    assert.equal(
      cleanUpText(input),
      lines("## Setup", "```sh", "pnpm install", "  && pnpm build", "```", "Then open Raycast."),
    );
  });
});

describe("37122a8: harden clean up", () => {
  test("does not merge aligned columns like ls -l", () => {
    const input = lines(
      "  -rw-r--r--   1 leo  staff   4823 Nov 20 10:00 clean-up-text-command.ts",
      "  -rw-r--r--   1 leo  staff   1567 Nov 20 10:00 fix-writing-instant.ts",
      "  drwxr-xr-x   9 leo  staff    288 Nov 20 10:00 node_modules",
    );
    assert.equal(cleanUpText(input), input.replace(/^ {2}/gm, ""));
  });

  test("only dedents when the selection starts inside a code block", () => {
    const input = lines(
      "  // The cleanup must not join these two lines although the first one is long",
      '  const hint = "and the next one starts with a word that would not fit there";',
      "  ```",
      "  Done.",
    );
    assert.equal(cleanUpText(input), input.replace(/^ {2}/gm, ""));
  });

  test("joins wrapped CJK lines without a space", () => {
    const first = "日本語のテキストはスペースなしで書かれるので、ターミナルで折り返された行は";
    const input = lines(`  ${first}`, "  そのまま繋げる。");
    assert.equal(cleanUpText(input), `${first}そのまま繋げる。`);
  });
});

describe("6a4f81c: keep paragraphs of terminal copies", () => {
  test("detects indented terminal text, including non-breaking-space indents from Teams", () => {
    assert.equal(looksLikeTerminalCopy("Summary of the change\n  first point\n  second point"), true);
    assert.equal(looksLikeTerminalCopy("Summary of the change\n  first point\n  second point"), true);
  });

  test("does not flag normal prose from a mail or chat", () => {
    assert.equal(looksLikeTerminalCopy("Hi Anna,\n\nthanks for the update.\nSee you on Monday."), false);
    assert.equal(looksLikeTerminalCopy("One line\n  only one indented line"), false);
  });

  test("keeps blank lines between paragraphs", () => {
    const input = lines(
      "  The cleanup joins lines that the terminal wrapped at its width, so a long",
      "  paragraph reads as one line again.",
      "",
      "  A second paragraph stays separate.",
    );
    assert.equal(
      cleanUpText(input),
      lines(
        "The cleanup joins lines that the terminal wrapped at its width, so a long paragraph reads as one line again.",
        "",
        "A second paragraph stays separate.",
      ),
    );
  });
});

describe("cc22cf8: wrapped lines by word fit, lost blank lines", () => {
  test("a line break is kept when the next word would have fit", () => {
    const input = lines(
      "  The build passed on the first try and the preview looked right.",
      "  It also pasted into Notes and Mail without losing any of the line breaks.",
    );
    assert.equal(cleanUpText(input), input.replace(/^ {2}/gm, ""));
  });

  test("restores blank lines that Teams dropped between wrapped paragraphs", () => {
    const input = lines(
      "  The cleanup joins lines that the terminal wrapped at its width, so a long",
      "  paragraph reads as one line again.",
      "  Teams drops the blank lines when you copy a message, so the paragraphs got",
      "  merged into one block.",
    );
    assert.equal(
      cleanUpText(input),
      lines(
        "The cleanup joins lines that the terminal wrapped at its width, so a long paragraph reads as one line again.",
        "",
        "Teams drops the blank lines when you copy a message, so the paragraphs got merged into one block.",
      ),
    );
  });
});

describe("4509ccb: first word measured in terminal columns", () => {
  test("a first word with CJK characters counts double width", () => {
    // 72 columns, 8 short of the 80-column width. "API仕様書" is 5 characters but 9 columns, so it did not fit.
    const second = "The extension reads the selected text and sends it to the model with the";
    const input = lines(`  ${"x".repeat(80)}`, `  ${second}`, "  API仕様書 rules.");
    assert.equal(second.length, 72);
    assert.equal(cleanUpText(input), `${"x".repeat(80)} ${second} API仕様書 rules.`);
  });
});

describe("36a590e: terminal quote bars", () => {
  test("strips Claude Code quote bars and joins the quoted lines", () => {
    const input = lines(
      "▎ The cleanup joins lines that the terminal wrapped at its width, so a long",
      "▎ paragraph reads as one line again.",
    );
    assert.equal(looksLikeTerminalCopy(input), true);
    assert.equal(
      cleanUpText(input),
      "The cleanup joins lines that the terminal wrapped at its width, so a long paragraph reads as one line again.",
    );
  });

  test("keeps box-drawn table rows", () => {
    const input = lines("│ name │ size │", "│ a.ts │ 1 KB │", "│ b.ts │ 2 KB │");
    assert.equal(cleanUpText(input), input);
  });
});

describe("c927bfa: unicode line separators", () => {
  test("U+2028 counts as a line break", () => {
    const input = ["  - URLs and code are left alone by", "    the replacement.", "  - Line breaks stay."].join(" ");
    assert.equal(
      cleanUpText(input),
      lines("- URLs and code are left alone by the replacement.", "- Line breaks stay."),
    );
  });

  test("U+2029 counts as a paragraph break", () => {
    assert.equal(cleanUpText("  First paragraph.   Second paragraph."), "First paragraph.\n\nSecond paragraph.");
  });
});

describe("6bd8c2d: special spaces, invisible characters, prompt symbols", () => {
  test("turns special spaces into normal ones and removes invisible characters", () => {
    assert.equal(cleanUpText("Hello world again"), "Hello world again");
    assert.equal(cleanUpText("pass​word, Ex­ample﻿"), "password, Example");
  });

  test("keeps emoji joiners and variation selectors", () => {
    const input = "Family 👨‍👩‍👧 and a heart ❤️";
    assert.equal(cleanUpText(input), input);
  });

  test("strips prompt and status symbols at the start of a line", () => {
    const input = lines("❯ pnpm build", "", "⏺ The build passed.");
    assert.equal(looksLikeTerminalCopy(input), true);
    assert.equal(cleanUpText(input), lines("pnpm build", "", "The build passed."));
    assert.equal(
      cleanUpText("⏺ Bash(pnpm build)\n  ⎿  built extension successfully"),
      lines("Bash(pnpm build)", "built extension successfully"),
    );
  });

  test("keeps a tool result on its own line when more transcript follows", () => {
    const input = lines(
      "⏺ Bash(pnpm build)",
      "  ⎿  built extension successfully",
      "",
      "⏺ Bash(pnpm lint)",
      "  ⎿  ready - run ESLint",
    );
    assert.equal(
      cleanUpText(input),
      lines("Bash(pnpm build)", "   built extension successfully", "", "Bash(pnpm lint)", "   ready - run ESLint"),
    );
  });

  test("joins a wrapped response but not the tool result below it", () => {
    const input = lines(
      "❯ pnpm build",
      "",
      "⏺ The cleanup joins lines that the terminal wrapped at its width, so a long",
      "  paragraph reads as one line again.",
      "  ⎿  Read 3 files",
    );
    assert.equal(
      cleanUpText(input),
      lines(
        "pnpm build",
        "",
        "The cleanup joins lines that the terminal wrapped at its width, so a long paragraph reads as one line again.",
        "   Read 3 files",
      ),
    );
  });
});

describe("181b5fc: quote bar when the selection starts mid-line", () => {
  test("strips the bars although the first line has none", () => {
    const input = lines("the selection started here,", "▎ in the middle of a quoted block", "▎ from Claude Code.");
    assert.equal(looksLikeTerminalCopy(input), true);
    assert.equal(
      cleanUpText(input),
      lines("the selection started here,", "in the middle of a quoted block", "from Claude Code."),
    );
  });

  test("a two-line selection with one bar line", () => {
    assert.equal(cleanUpText("end of a line\n▎ next quoted line"), "end of a line\nnext quoted line");
  });
});
