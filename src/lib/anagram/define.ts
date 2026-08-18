export type Definition = {
  word: string;
  phonetic?: string;
  audio?: string;
  etymology?: string;
  senses: { pos: string; text: string }[];
};

const cache = new Map<string, Definition | null>();
const inflight = new Map<string, Promise<Definition | null>>();

type DictApiEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  origin?: string;
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string }[];
  }[];
};

type DatamuseRow = { word?: string; defs?: string[] };

type WikiParse = {
  parse?: {
    sections?: { index: string; line: string }[];
    text?: { "*": string };
  };
};

type WikiSense = {
  partOfSpeech?: string;
  definitions?: { definition?: string }[];
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;|'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\[edit\]/gi, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function clipEtymology(text: string): string {
  const clean = text
    .replace(/\u200e|\u200f|\u200b|\u200c|\u200d/g, "")
    .replace(/ \)/g, ")")
    .replace(/\( /g, "(")
    .replace(/ ,/g, ",")
    .replace(/ ;/g, ";")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= 320) return clean;
  const cut = clean.slice(0, 320);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (stop > 140 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`).trim();
}

function mergeDefs(parts: Array<Definition | null | undefined>): Definition | null {
  const live = parts.filter((p): p is Definition => !!p);
  if (!live.length) return null;
  const first = live[0];
  return {
    word: first.word,
    phonetic: live.find((p) => p.phonetic)?.phonetic,
    audio: live.find((p) => p.audio)?.audio,
    etymology: live.find((p) => p.etymology)?.etymology,
    senses: first.senses,
  };
}

async function fromDictionaryApi(word: string): Promise<Definition | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DictApiEntry[] | { title?: string };
    if (!Array.isArray(data) || !data[0]?.meanings?.length) return null;
    const entry = data[0];
    const senses: Definition["senses"] = [];
    for (const meaning of entry.meanings ?? []) {
      const pos = meaning.partOfSpeech ?? "";
      for (const d of meaning.definitions ?? []) {
        if (!d.definition) continue;
        senses.push({ pos, text: d.definition });
        if (senses.length >= 3) break;
      }
      if (senses.length >= 3) break;
    }
    if (!senses.length) return null;
    const phonetic =
      entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || undefined;
    const audio =
      entry.phonetics?.find((p) => p.audio && p.audio.endsWith(".mp3"))?.audio ||
      entry.phonetics?.find((p) => p.audio)?.audio ||
      undefined;
    const etymology = entry.origin ? clipEtymology(entry.origin) : undefined;
    return { word: entry.word ?? word, phonetic, audio, etymology, senses };
  } catch {
    return null;
  }
}

async function fromDatamuse(word: string): Promise<Definition | null> {
  try {
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=8`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as DatamuseRow[];
    const row = data.find((r) => r.word?.toLowerCase() === word && r.defs?.length);
    if (!row?.defs?.length) return null;
    const senses = row.defs.slice(0, 3).map((raw) => {
      const tab = raw.indexOf("\t");
      if (tab === -1) return { pos: "", text: raw.trim() };
      return { pos: raw.slice(0, tab).trim(), text: raw.slice(tab + 1).trim() };
    });
    return { word, senses };
  } catch {
    return null;
  }
}

async function fromWiktionarySenses(word: string): Promise<Definition | null> {
  try {
    const res = await fetch(
      `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { en?: WikiSense[] };
    const senses: Definition["senses"] = [];
    for (const meaning of data.en ?? []) {
      const pos = (meaning.partOfSpeech ?? "").toLowerCase();
      for (const d of meaning.definitions ?? []) {
        const text = stripHtml(d.definition ?? "");
        if (text.length < 8) continue;
        senses.push({ pos, text });
        if (senses.length >= 3) break;
      }
      if (senses.length >= 3) break;
    }
    if (!senses.length) return null;
    return { word, senses };
  } catch {
    return null;
  }
}

async function fromWiktionaryEtymology(word: string): Promise<string | undefined> {
  try {
    const base = "https://en.wiktionary.org/w/api.php";
    const sectionsRes = await fetch(
      `${base}?action=parse&page=${encodeURIComponent(word)}&prop=sections&format=json&origin=*`,
    );
    if (!sectionsRes.ok) return undefined;
    const sectionsJson = (await sectionsRes.json()) as WikiParse;
    const section = sectionsJson.parse?.sections?.find((s) =>
      s.line.toLowerCase().startsWith("etymolog"),
    );
    if (!section) return undefined;
    const textRes = await fetch(
      `${base}?action=parse&page=${encodeURIComponent(word)}&prop=text&section=${encodeURIComponent(section.index)}&format=json&origin=*`,
    );
    if (!textRes.ok) return undefined;
    const textJson = (await textRes.json()) as WikiParse;
    const html = textJson.parse?.text?.["*"];
    if (!html) return undefined;
    const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripHtml(m[1]));
    const text = paras.filter(Boolean).join(" ");
    if (text.length < 12) return undefined;
    return clipEtymology(text);
  } catch {
    return undefined;
  }
}

export function peekDefinition(word: string): Definition | null | undefined {
  const key = word.trim().toLowerCase();
  if (!key) return null;
  if (!cache.has(key)) return undefined;
  return cache.get(key) ?? null;
}

export function defineWord(word: string): Promise<Definition | null> {
  const key = word.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const existing = inflight.get(key);
  if (existing) return existing;
  const job = (async () => {
    const [dict, datamuse, wiki, wikiEtym] = await Promise.all([
      fromDictionaryApi(key),
      fromDatamuse(key),
      fromWiktionarySenses(key),
      fromWiktionaryEtymology(key),
    ]);
    const result = mergeDefs([dict, datamuse, wiki]);
    const next = result
      ? { ...result, etymology: result.etymology || wikiEtym }
      : null;
    cache.set(key, next);
    return next;
  })();
  inflight.set(key, job);
  return job.finally(() => inflight.delete(key));
}

export function speakWord(word: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const text = word.trim();
  if (!text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const en =
    voices.find((v) => v.lang.toLowerCase() === "en-us") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("en"));
  if (en) utter.voice = en;
  window.speechSynthesis.speak(utter);
}

export function playPronunciation(word: string, audioUrl?: string) {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    const fallback = window.setTimeout(() => speakWord(word), 700);
    audio.addEventListener("playing", () => window.clearTimeout(fallback), { once: true });
    audio.addEventListener("error", () => {
      window.clearTimeout(fallback);
      speakWord(word);
    });
    void audio.play().catch(() => {
      window.clearTimeout(fallback);
      speakWord(word);
    });
    return;
  }
  speakWord(word);
}
