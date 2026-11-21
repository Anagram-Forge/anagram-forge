/**
 * English → Hebrew letters for the cipher. Runs in the browser only: a small
 * built-in glossary of well-known Biblical words, and a plain sound-alike
 * spelling for anything else. No network, no imports (the node tests load it).
 */

export type HebrewPart = {
  /** The English word as typed. */
  source: string;
  hebrew: string;
  /** "translation" from the glossary, "sound" for a sound-alike spelling, "hebrew" if it was already Hebrew. */
  kind: "translation" | "sound" | "hebrew";
};

/** Consonantal Hebrew, no niqqud. Keys are lowercase English. */
export const GLOSSARY: Record<string, string> = {
  // God and names of God
  god: "אלהים",
  elohim: "אלהים",
  lord: "יהוה",
  yahweh: "יהוה",
  adonai: "אדני",
  // Jesus and titles
  jesus: "ישוע",
  yeshua: "ישוע",
  messiah: "משיח",
  christ: "משיח",
  mashiach: "משיח",
  immanuel: "עמנואל",
  emmanuel: "עמנואל",
  // Core words
  light: "אור",
  truth: "אמת",
  life: "חיים",
  love: "אהבה",
  peace: "שלום",
  shalom: "שלום",
  faith: "אמונה",
  grace: "חן",
  mercy: "חסד",
  spirit: "רוח",
  word: "דבר",
  holy: "קדוש",
  blessed: "ברוך",
  amen: "אמן",
  hallelujah: "הללויה",
  halleluyah: "הללויה",
  hosanna: "הושענא",
  selah: "סלה",
  glory: "כבוד",
  wisdom: "חכמה",
  praise: "תהלה",
  salvation: "ישועה",
  covenant: "ברית",
  torah: "תורה",
  law: "תורה",
  gospel: "בשורה",
  kingdom: "מלכות",
  righteous: "צדיק",
  righteousness: "צדקה",
  good: "טוב",
  evil: "רע",
  name: "שם",
  one: "אחד",
  beginning: "ראשית",
  heart: "לב",
  soul: "נפש",
  blood: "דם",
  cross: "צלב",
  sabbath: "שבת",
  shabbat: "שבת",
  passover: "פסח",
  pesach: "פסח",
  // People and beings
  king: "מלך",
  kings: "מלכים",
  son: "בן",
  father: "אב",
  mother: "אם",
  man: "איש",
  woman: "אשה",
  people: "עם",
  nation: "גוי",
  angel: "מלאך",
  angels: "מלאכים",
  prophet: "נביא",
  priest: "כהן",
  shepherd: "רעה",
  servant: "עבד",
  cherub: "כרוב",
  seraph: "שרף",
  nephilim: "נפלים",
  // Biblical names
  adam: "אדם",
  eve: "חוה",
  noah: "נח",
  abraham: "אברהם",
  sarah: "שרה",
  isaac: "יצחק",
  rebekah: "רבקה",
  jacob: "יעקב",
  rachel: "רחל",
  leah: "לאה",
  israel: "ישראל",
  joseph: "יוסף",
  judah: "יהודה",
  benjamin: "בנימין",
  moses: "משה",
  aaron: "אהרן",
  miriam: "מרים",
  mary: "מרים",
  joshua: "יהושע",
  samuel: "שמואל",
  saul: "שאול",
  david: "דוד",
  solomon: "שלמה",
  elijah: "אליהו",
  isaiah: "ישעיהו",
  jeremiah: "ירמיהו",
  daniel: "דניאל",
  jonah: "יונה",
  john: "יוחנן",
  gabriel: "גבריאל",
  michael: "מיכאל",
  // Places
  jerusalem: "ירושלים",
  zion: "ציון",
  bethlehem: "בית לחם",
  nazareth: "נצרת",
  egypt: "מצרים",
  eden: "עדן",
  // Creation
  heaven: "שמים",
  heavens: "שמים",
  earth: "ארץ",
  water: "מים",
  fire: "אש",
  day: "יום",
  night: "לילה",
  sun: "שמש",
  moon: "ירח",
  star: "כוכב",
  sea: "ים",
  mountain: "הר",
  tree: "עץ",
  seed: "זרע",
  bread: "לחם",
  wine: "יין",
  lamb: "שה",
  lion: "אריה",
  dove: "יונה",
  way: "דרך",
};

const FINAL: Record<string, string> = { כ: "ך", מ: "ם", נ: "ן", פ: "ף", צ: "ץ" };
const GERESH = "\u05F3";

/** Swap the last letter of a Hebrew word for its final form (ך ם ן ף ץ). */
export function withFinalForm(word: string): string {
  const chars = [...word];
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i];
    if (c === GERESH) continue;
    if (/[\u05D0-\u05EA]/.test(c)) {
      if (FINAL[c] && chars[i + 1] !== GERESH) chars[i] = FINAL[c];
      break;
    }
  }
  return chars.join("");
}

export function lookupGlossary(word: string): string | null {
  const key = word.toLowerCase().replace(/[^a-z]/g, "");
  return Object.prototype.hasOwnProperty.call(GLOSSARY, key) ? GLOSSARY[key] : null;
}

const PAIRS: [string, string][] = [
  ["sh", "ש"],
  ["ch", "ח"],
  ["kh", "ח"],
  ["th", "ת"],
  ["ph", "פ"],
  ["tz", "צ"],
  ["ts", "צ"],
  ["ck", "ק"],
  ["qu", "קו"],
  ["ee", "י"],
  ["ea", "י"],
  ["oo", "ו"],
  ["ou", "ו"],
  ["oa", "ו"],
  ["ai", "י"],
  ["ay", "י"],
  ["ei", "י"],
];

const ONE: Record<string, string> = {
  b: "ב",
  d: "ד",
  f: "פ",
  g: "ג",
  h: "ה",
  j: "ג" + GERESH,
  k: "כ",
  l: "ל",
  m: "מ",
  n: "נ",
  p: "פ",
  q: "ק",
  r: "ר",
  s: "ס",
  t: "ט",
  v: "ו",
  w: "ו",
  x: "קס",
  z: "ז",
};

const VOWEL = /[aeiou]/;

/** Sound-alike Hebrew spelling of one English word. Not a translation. */
export function spellBySound(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "").replace(/([b-df-hj-np-tv-z])\1+/g, "$1");
  if (!w) return "";
  let out = "";
  let i = 0;
  while (i < w.length) {
    const two = w.slice(i, i + 2);
    const pair = PAIRS.find(([en]) => en === two);
    const start = i === 0;
    if (pair) {
      const vowelish = VOWEL.test(two[0]);
      out += vowelish && start ? (pair[1] === "י" ? "אי" : "א" + pair[1]) : pair[1];
      i += 2;
      continue;
    }
    const c = w[i];
    const last = i === w.length - 1;
    if (c === "a") out += start ? "א" : last ? "ה" : "";
    else if (c === "e") out += start ? "א" : last ? (w.length <= 3 ? "י" : "") : "";
    else if (c === "i") out += start ? "אי" : "י";
    else if (c === "o" || c === "u") out += start ? "או" : "ו";
    else if (c === "y") out += "י";
    else if (c === "c") out += /[eiy]/.test(w[i + 1] || "") ? "ס" : "ק";
    else out += ONE[c] || "";
    i += 1;
  }
  return withFinalForm(out);
}

/** Split English text into words and give each one Hebrew letters. */
export function englishToHebrew(text: string): HebrewPart[] {
  const parts: HebrewPart[] = [];
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    if (/[\u05D0-\u05EA]/.test(raw)) {
      const heb = raw.replace(/[^\u05D0-\u05EA\u05F3]/g, "");
      if (heb) parts.push({ source: raw, hebrew: heb, kind: "hebrew" });
      continue;
    }
    const clean = raw.replace(/[^A-Za-z]/g, "");
    if (!clean) continue;
    const hit = lookupGlossary(clean);
    if (hit) parts.push({ source: clean, hebrew: hit, kind: "translation" });
    else {
      const sound = spellBySound(clean);
      if (sound) parts.push({ source: clean, hebrew: sound, kind: "sound" });
    }
  }
  return parts;
}
