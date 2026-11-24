import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";

// @raycast/api has no runtime entry outside Raycast. isSwissGerman never calls it, so the stub throws if anything does.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier !== "@raycast/api") return nextResolve(specifier, context);
    const stub = "export function getPreferenceValues() { throw new Error('@raycast/api is not available in tests'); }";
    return { url: `data:text/javascript,${encodeURIComponent(stub)}`, shortCircuit: true };
  },
});

const { isSwissGerman } = await import("../src/lib/swiss-german.ts");

test("detects a Swiss German chat message", () => {
  assert.equal(isSwissGerman("Hey, bisch hüt am Abig dihei? Mir chönd no öppis go trinke, weisch."), true);
});

test("a Swiss text with a slipped-in Standard German word stays Swiss German", () => {
  assert.equal(isSwissGerman("Das isch ja nicht so schlimm, ich ha das scho gseh und es isch guet."), true);
});

test("a short message with one dialect word counts", () => {
  assert.equal(isSwissGerman("Bisch am lerne?"), true);
  assert.equal(isSwissGerman("Guettt, bis spöter"), true);
});

test("one dialect word only counts in messages of up to 8 words", () => {
  assert.equal(isSwissGerman("Bisch du morgen am Abend bei uns dabei"), true);
  assert.equal(isSwissGerman("Bisch du morgen am Abend eigentlich bei uns dabei"), false);
});

test("weak words count only next to a strong one", () => {
  assert.equal(isSwissGerman("Okii morn am 8i?"), false);
  assert.equal(isSwissGerman("Han Solo und Chewbacca fliegen morn weiter"), false);
  assert.equal(isSwissGerman("Chum, mir gönd am Samstag zäme go wandere, wenn s Wetter mitmacht"), true);
});

test("Standard German that quotes a dialect word stays Standard German", () => {
  assert.equal(isSwissGerman("Er sagte Grüezi und ging"), false);
  // Two dialect words need fewer than two Standard German words around them.
  assert.equal(isSwissGerman("Mein Kollege schreibt 'isch guet' unter jede Nachricht, ich habe heute gelacht"), false);
  assert.equal(isSwissGerman("Mein Kollege schreibt 'isch guet' unter jede Nachricht, ich lache heute"), true);
  assert.equal(
    isSwissGerman(
      "Sie hat gesagt, das sei nicht schlimm, und dann kam noch ein 'isch guet' hinterher, das ich nicht verstand.",
    ),
    false,
  );
});

test("English and French text is not Swiss German", () => {
  assert.equal(isSwissGerman("Is the gang still meeting tonight? I can bring the snacks."), false);
  assert.equal(isSwissGerman("On mange au restaurant ce soir, tu viens avec nous ou tu restes chez toi ?"), false);
});
