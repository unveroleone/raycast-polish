import { getPreferenceValues } from "@raycast/api";
import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { strFromU8, unzipSync } from "fflate";

// Words that only exist in Swiss German. Words that also exist elsewhere are left out: "au" and "mer" (French), "nei"
// (Italian), "het", "wel" and "hoi" (Dutch), "cho" (Vietnamese), "nume" (Romanian), "gang" and "gits" (English),
// "wieso" and "denn" (Standard German).
const SWISS_WORDS = new Set(
  (
    "isch ischs isches ned nöd nid scho gsi hani hesch hets bisch bini nüd nüt epis öppis öpis öpper hüt geschter " +
    "guet guett dete echli chli üs süscht nonig chasch chunsch chunt chunnt gönd gömmer wetsch wotsch weisch seisch " +
    "säg lueg luege gseh gsehsch gseit gmacht ghört hend händ simmer imfall zwoi drü grüezi tschau esch hed mached " +
    "machsch dänk verzell vorbi"
  ).split(" "),
);

// Swiss German words that are also names or words in other languages or in German chat ("Han", "Chan", "morn", "chum",
// "eifach"). They count towards Swiss German, but only together with at least one word from the list above.
const WEAK_SWISS_WORDS = new Set("han chan cho morn gad gaht eifach eif eig ebe bi chum".split(" "));

// Words that only appear in Standard German, including the simple past, which Swiss German does not use. They outweigh
// the Swiss words, so a Standard German text that quotes a dialect word stays Standard German.
const STANDARD_WORDS = new Set(
  (
    "nicht ist is auch habe hast bist heute etwas nichts gewesen kannst muss noch eine einen einem wollte sollte " +
    "würde wäre gerne sind haben wurde möchte war hatte ging kam sagte"
  ).split(" "),
);

// Letters stretched for emphasis ("neddd", "guettt") count as the plain word.
const destretch = (word: string) => word.replace(/(\p{L})\1{2,}/gu, "$1");

export function isSwissGerman(text: string): boolean {
  const words = (text.toLowerCase().match(/\p{L}+/gu) ?? []).map(destretch);
  let strong = 0;
  let weak = 0;
  let standard = 0;
  for (const word of words) {
    if (SWISS_WORDS.has(word)) strong++;
    else if (WEAK_SWISS_WORDS.has(word)) weak++;
    else if (STANDARD_WORDS.has(word)) standard++;
  }
  if (strong === 0) return false;
  const swiss = strong + weak;
  // Short chat messages often carry a single dialect word ("Bisch am lerne?").
  if (words.length <= 8 && standard === 0) return true;
  return swiss >= 2 && swiss >= standard * 2;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?\r?\n)?---(\r?\n|$)/;
const TEXT_FILE = /\.(md|txt)$/i;

const clean = (content: string) =>
  content
    .replace(/^\ufeff/, "")
    .replace(FRONTMATTER, "")
    .trim();

interface StyleFiles {
  main: string;
  // File name and content of each reference, sorted by name.
  references: [string, string][];
}

function readFromFolder(path: string): StyleFiles {
  const main = readFileSync(path, "utf8");
  const referencesDir = join(dirname(path), "references");
  let names: string[] = [];
  try {
    names = readdirSync(referencesDir).filter((name) => TEXT_FILE.test(name));
  } catch {
    // No references folder, the file stands alone.
  }
  return { main, references: names.map((name) => [name, readFileSync(join(referencesDir, name), "utf8")]) };
}

// A skill exported as .zip holds SKILL.md, either at the root or in one folder, with its references next to it.
function readFromZip(path: string): StyleFiles {
  const entries = unzipSync(new Uint8Array(readFileSync(path)), {
    filter: (file) => !file.name.startsWith("__MACOSX/") && TEXT_FILE.test(file.name),
  });
  const skillPath = Object.keys(entries)
    .filter((name) => /(^|\/)SKILL\.md$/i.test(name))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!skillPath) throw new Error("the zip contains no SKILL.md");

  const base = skillPath.slice(0, skillPath.length - "SKILL.md".length);
  const referencesPrefix = `${base}references/`.toLowerCase();
  const references = Object.entries(entries)
    .filter(
      ([name]) => name.toLowerCase().startsWith(referencesPrefix) && !name.slice(referencesPrefix.length).includes("/"),
    )
    .map(([name, data]): [string, string] => [name.slice(referencesPrefix.length), strFromU8(data)]);
  return { main: strFromU8(entries[skillPath]), references };
}

// Reads the Swiss German style: a .md file, or a skill as .zip. A skill's references are added too, because the skill
// points to them and the model cannot open them on its own.
export function loadSwissGermanStyle(): string | undefined {
  const { swissGermanStyle } = getPreferenceValues<Preferences>();
  if (!swissGermanStyle) return undefined;

  let files: StyleFiles;
  try {
    files = /\.zip$/i.test(swissGermanStyle) ? readFromZip(swissGermanStyle) : readFromFolder(swissGermanStyle);
  } catch (error) {
    throw new Error(`Could not read Swiss German style: ${(error as Error).message}`);
  }

  const references = files.references
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, content]) => `## references/${name}\n\n${clean(content)}`);
  return [clean(files.main), ...references].filter(Boolean).join("\n\n");
}
