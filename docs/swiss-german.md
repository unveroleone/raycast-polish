# Swiss German

Polish recognizes Swiss German (Mundart) text and handles it differently from every other language. The generic proofreader treats Swiss German as misspelled Standard German and tends to "correct" it into Standard German. For Swiss German text, Polish uses its own prompt and, if configured, your own dialect rules.

Only Swiss German gets this treatment. All other languages go through the normal prompts.

## Overview

| Step | Where | What happens |
| --- | --- | --- |
| Detect | `src/lib/swiss-german.ts`, `isSwissGerman` | Counts Swiss and Standard German marker words in the input |
| Prompt | `src/lib/llm.ts`, `buildSystemPrompt` | Picks the Swiss fix prompt and adds the style guide |
| Style | `src/lib/swiss-german.ts`, `loadSwissGermanStyle` | Reads the Swiss German Style setting (`.md` or skill `.zip`) |
| Output | `src/lib/llm.ts`, `unwrapCodeBlocks` | Removes a code block the style guide may have asked for |
| Preview | `src/lib/task-view.tsx` | Shows "Swiss German" in the title |

## Detection

Detection runs in code, without a model call, so it adds no latency and costs nothing.

General language detectors cannot tell Swiss German from Standard German. Word lists can. There are three:

- **Swiss words**: very common words that exist only in Swiss German (`isch`, `ned`, `scho`, `gsi`, `hesch`, `epis`, `hüt`, `chasch`, `vorbi` and about 60 more).
- **Weak Swiss words**: Swiss words that are also names or words elsewhere (`han`, `chan`, `cho`, `morn`, `gad`, `bi`, `chum`, `eifach`, `eig`, `ebe`). They count towards Swiss German, but never on their own.
- **Standard German words**: common words a Swiss German writer replaces (`nicht`, `ist`, `is`, `auch`, `habe`, `heute`, `kannst` and others), plus simple past forms (`war`, `hatte`, `ging`, `kam`, `sagte`), which Swiss German does not use.

The text is Swiss German only if it has at least one Swiss word, and then when either holds:

- It has at most 8 words and no Standard German word. Short chat messages ("Bisch am lerne?") often carry just one dialect word.
- Swiss and weak Swiss words together number at least 2 and at least twice the Standard German words.

The second rule means a Swiss text with a slipped-in "nicht" still counts as Swiss German, which is exactly the case Fix should correct. A Standard German text that quotes a dialect word ("Er sagte Grüezi und ging") stays Standard German as long as it has Standard German words around it. A very short German text with one dialect word and no listed Standard German word would still count as Swiss German.

Letters stretched for emphasis are reduced before matching, so "neddd" counts as "ned".

Words that are common in other languages are left out completely: "au" and "mer" (French), "nei" (Italian), "het", "wel" and "hoi" (Dutch), "nume" (Romanian), "gang" and "gits" (English), "wieso" and "denn" (Standard German). Short texts without a strong marker ("Okii", "Okii morn am 8i?") are not detected. That is fine, there is little to fix in them.

Detection runs on the input after the terminal clean up, the same text the model gets. The preview title uses the same check (`isSwissGermanText` in `llm.ts`).

## Fix

For Swiss German, Fix uses `SWISS_FIX_PROMPT` instead of the normal proofreader. The normal one makes the smallest possible change and keeps the author's words. The Swiss one goes further:

- Spelling follows the author's spellings, and Standard German words that slipped in become their Swiss form.
- Sentence structure becomes natural spoken Swiss German: perfect tense instead of simple past, "wo" for relative clauses, "vo" or the dative instead of the genitive, Swiss word order.
- Wrong or unnatural word choices and grammar are fixed.

It never translates, never adds content, emojis or greetings, keeps every fact and question, and keeps the line breaks. It does not split the text into separate messages.

Shorten keeps its normal prompt, which already keeps the original language. It gets the style guide like Fix does.

## Style guide

The Swiss German Style setting takes one of:

- a plain `.md` or `.txt` file with dialect rules
- a skill's `SKILL.md`
- a skill exported as `.zip`

For a skill, the frontmatter is removed and every `.md` and `.txt` file in the `references` folder next to `SKILL.md` is added, sorted by name, each under a `## references/<name>` heading. The skill points to these files, and the model cannot open them by itself. In a zip, `SKILL.md` may sit at the root or inside folders; the shallowest one wins. The `references` folder name is matched without regard to case. `__MACOSX` entries are skipped. Zips are read with `fflate`, nothing is unpacked to disk.

When the text is Swiss German and a style guide is set, the style guide replaces the human writing rules, which are written for Standard German and English. Without a style guide, the human writing rules still apply as usual. The ß to ss replacement in code runs in both cases.

### Using a drafting skill for fixing

A writing skill is usually made for drafting new messages. It asks for things that would break Fix: picking a mode, asking the author questions, splitting into several messages, adding emojis, offering alternatives and a code block as output format. The prompt tells the model to use only the guide's spelling, word choice, punctuation and capitalization rules (and its short message rules for Shorten) and to ignore the rest. The task's output rules win.

As a fallback, if the model still answers with code blocks, `unwrapCodeBlocks` removes every fence line. It does this only when the answer starts with a fence and the original text has none. It runs on the streamed preview too, so the preview matches what gets pasted.

### Cost

A full skill with references is about 20 KB, roughly 6,000 tokens per request. With gpt-4o-mini that is about a tenth of a cent. The style guide is part of the system prompt and stays the same between requests, so providers with prompt caching (OpenAI caches prefixes over 1,024 tokens automatically) make repeat requests cheaper and faster.

## Limits

- Detection is a word list. Swiss German written without any of the listed words, for example only nouns, is not detected.
- The word lists are tuned for German, English, French, Italian and Dutch. Other languages could contain a listed word by chance.
- Only one style guide. Different rules for different dialects or people are not supported.
- The style guide is read on every request. A broken path fails the request with "Could not read Swiss German style", the same way the Instructions File does.
