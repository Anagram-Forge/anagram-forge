import type { DictTier } from "./types";

export type DictWord = {
  word: string;
  counts: Uint8Array;
  score: number;
  freq: number;
};

export type Loaded = {
  all: DictWord[];
  byLen: Map<number, DictWord[]>;
  commonSet: Set<string>;
  wordSet: Set<string>;
};

let cache: Loaded | null = null;
let inflight: Promise<Loaded> | null = null;

function parseList(text: string): string[] {
  const words: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (w.length < 2 || w.length > 21) continue;
    let ok = true;
    for (let i = 0; i < w.length; i++) {
      const c = w.charCodeAt(i);
      if (c < 97 || c > 122) {
        ok = false;
        break;
      }
    }
    if (ok) words.push(w);
  }
  return words;
}

export async function loadDictionary(): Promise<Loaded> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { countsOf } = await import("./letters");
    const { scrabbleScore } = await import("./scores");
    const [fullRes, commonRes] = await Promise.all([
      fetch("/dict/enable1.txt"),
      fetch("/dict/common.txt"),
    ]);
    if (!fullRes.ok) throw new Error("Could not load dictionary");
    const fullText = await fullRes.text();
    const commonText = commonRes.ok ? await commonRes.text() : "";
    const commonWords = parseList(commonText);
    const commonSet = new Set(commonWords);
    const freq = new Map<string, number>();
    commonWords.forEach((w, i) => freq.set(w, commonWords.length - i));

    const seen = new Set<string>();
    const all: DictWord[] = [];
    for (const word of parseList(fullText)) {
      if (seen.has(word)) continue;
      seen.add(word);
      all.push({
        word,
        counts: countsOf(word),
        score: scrabbleScore(word),
        freq: freq.get(word) ?? 0,
      });
    }
    for (const one of ["a", "i"] as const) {
      if (seen.has(one)) continue;
      seen.add(one);
      commonSet.add(one);
      all.push({
        word: one,
        counts: countsOf(one),
        score: scrabbleScore(one),
        freq: 10000,
      });
    }
    const byLen = new Map<number, DictWord[]>();
    for (const dw of all) {
      const list = byLen.get(dw.word.length);
      if (list) list.push(dw);
      else byLen.set(dw.word.length, [dw]);
    }
    cache = { all, byLen, commonSet, wordSet: seen };
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function wordsForTier(loaded: Loaded, tier: DictTier): DictWord[] {
  if (tier === "full") return loaded.all;
  if (tier === "common") return loaded.all.filter((w) => loaded.commonSet.has(w.word));
  // Standard: common + every tournament word of length 2–8 (playable rack words)
  return loaded.all.filter((w) => loaded.commonSet.has(w.word) || w.word.length <= 8);
}

export function dictStats(loaded: Loaded) {
  return {
    full: loaded.all.length,
    common: loaded.commonSet.size,
  };
}
