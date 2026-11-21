import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GLOSSARY,
  englishToHebrew,
  lookupGlossary,
  spellBySound,
  withFinalForm,
} from "../src/lib/hebrew-from-english.ts";

test("glossary lookup is whole-word and case-insensitive", () => {
  assert.equal(lookupGlossary("God"), "אלהים");
  assert.equal(lookupGlossary("LORD"), "יהוה");
  assert.equal(lookupGlossary("yeshua"), "ישוע");
  assert.equal(lookupGlossary("Jesus,"), "ישוע");
  assert.equal(lookupGlossary("Nephilim"), "נפלים");
  assert.equal(lookupGlossary("godly"), null);
  assert.equal(lookupGlossary("constructor"), null);
});

test("glossary has 60–150 entries, all plain Hebrew letters", () => {
  const n = Object.keys(GLOSSARY).length;
  assert.ok(n >= 60 && n <= 150, `size ${n}`);
  for (const [en, he] of Object.entries(GLOSSARY)) {
    assert.match(en, /^[a-z]+$/);
    assert.match(he, /^[\u05D0-\u05EA ]+$/, en);
  }
});

test("final letter forms at word end only", () => {
  assert.equal(withFinalForm("שלומ"), "שלום");
  assert.equal(withFinalForm("מלכ"), "מלך");
  assert.equal(withFinalForm("בנ"), "בן");
  assert.equal(withFinalForm("יוספ"), "יוסף");
  assert.equal(withFinalForm("ארצ"), "ארץ");
  assert.equal(withFinalForm("מנה"), "מנה");
  assert.equal(withFinalForm("ג׳"), "ג׳");
});

test("sound-alike spellings", () => {
  assert.equal(spellBySound("shalom"), "שלום");
  assert.equal(spellBySound("Ben"), "בן");
  assert.equal(spellBySound("anna"), "אנה");
  assert.equal(spellBySound("faith"), "פית");
  assert.equal(spellBySound("grace"), "גרס");
  assert.equal(spellBySound("Smith"), "סמית");
  assert.equal(spellBySound("Rem"), "רם");
  assert.equal(spellBySound("Kim"), "כים");
});

test("mixed text says which words were translated and which were spelled by sound", () => {
  const parts = englishToHebrew("Jesus loves Rem!");
  assert.deepEqual(
    parts.map((p) => [p.source, p.kind]),
    [
      ["Jesus", "translation"],
      ["loves", "sound"],
      ["Rem", "sound"],
    ],
  );
  assert.equal(parts[0].hebrew, "ישוע");
  assert.deepEqual(englishToHebrew("  123 ... "), []);
});
