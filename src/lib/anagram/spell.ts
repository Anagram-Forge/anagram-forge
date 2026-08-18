import type { Loaded } from "./dict";

export type SpellToken = {
  raw: string;
  word: string;
  kind: "known" | "unknown" | "rack" | "skip";
  suggestions: string[];
};

/** Spell-check only — proper names / medical terms the tournament list omits. */
const EXTRA_WORDS = ["asperger", "aspergers"];

const BLOCKED_SUGGESTIONS = new Set([
  "assburger",
  "assburgers",
  "assburgersyndrome",
]);

const extraSet = new Set(EXTRA_WORDS);

function sharedAffix(a: string, b: string): number {
  let pre = 0;
  const n = Math.min(a.length, b.length);
  while (pre < n && a[pre] === b[pre]) pre += 1;
  let suf = 0;
  while (suf < n && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf += 1;
  return Math.max(pre, suf);
}

function editDistanceAtMost(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  let prev = new Uint8Array(n + 1);
  let curr = new Uint8Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = Math.min(del, ins, sub);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

export function isNearSuggestion(input: string, suggestion: string): boolean {
  return editDistanceAtMost(input, suggestion, 2) <= 2;
}

export function isKnownSpelling(word: string, loaded: Loaded | null): boolean {
  const w = word.toLowerCase();
  if (extraSet.has(w)) return true;
  return !!loaded?.wordSet.has(w);
}

export function suggestWords(
  loaded: Loaded,
  word: string,
  limit = 6,
): { word: string; dist: number }[] {
  const w = word.toLowerCase();
  if (w.length < 2) return [];
  const ranked: { word: string; dist: number; freq: number }[] = [];

  for (const extra of EXTRA_WORDS) {
    const dist = editDistanceAtMost(w, extra, 2);
    if (dist > 0 && dist <= 2) ranked.push({ word: extra, dist, freq: 8000 });
  }

  for (let len = Math.max(2, w.length - 2); len <= w.length + 2; len++) {
    const bucket = loaded.byLen.get(len);
    if (!bucket) continue;
    for (const dw of bucket) {
      const dist = editDistanceAtMost(w, dw.word, 2);
      if (dist === 0 || dist > 2) continue;
      if (dist === 2 && dw.freq <= 0 && sharedAffix(w, dw.word) < 7) continue;
      ranked.push({ word: dw.word, dist, freq: dw.freq });
    }
  }
  ranked.sort((a, b) => a.dist - b.dist || b.freq - a.freq || a.word.localeCompare(b.word));
  const out: { word: string; dist: number }[] = [];
  const seen = new Set<string>();
  for (const r of ranked) {
    if (seen.has(r.word) || BLOCKED_SUGGESTIONS.has(r.word)) continue;
    seen.add(r.word);
    out.push({ word: r.word, dist: r.dist });
    if (out.length >= limit) break;
  }
  return out;
}

export function tokenizeField(raw: string): string[] {
  return raw
    .split(/[\s+/|,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkTokens(raw: string, loaded: Loaded | null): SpellToken[] {
  const parts = tokenizeField(raw);
  const multi = parts.length > 1;
  return parts.map((rawPart) => {
    let word = "";
    let skip = false;
    for (const ch of rawPart.toLowerCase()) {
      if (ch === "?" || ch === "." || ch === "_") {
        skip = true;
        continue;
      }
      const n = ch.charCodeAt(0) - 97;
      if (n >= 0 && n < 26) word += ch;
    }
    if (skip || word.length < 2) {
      return { raw: rawPart, word, kind: "skip" as const, suggestions: [] };
    }
    if (!loaded) {
      return { raw: rawPart, word, kind: "skip" as const, suggestions: [] };
    }
    if (isKnownSpelling(word, loaded)) {
      return { raw: rawPart, word, kind: "known" as const, suggestions: [] };
    }
    const found = suggestWords(loaded, word, 6);
    const suggestions = found.map((s) => s.word);
    const closeTypo = found.some((s) => s.dist === 1);
    const nearTypo = found.some((s) => s.dist === 2);
    if (!multi && !closeTypo && !nearTypo) {
      return { raw: rawPart, word, kind: "rack" as const, suggestions };
    }
    if (!multi && (closeTypo || (nearTypo && word.length >= 5))) {
      return { raw: rawPart, word, kind: "unknown" as const, suggestions };
    }
    if (multi) {
      return { raw: rawPart, word, kind: "unknown" as const, suggestions };
    }
    return { raw: rawPart, word, kind: "rack" as const, suggestions };
  });
}

export function mergeSuggestions(base: string[], extra: string[], limit = 6): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of [...base, ...extra]) {
    const n = w.toLowerCase().replace(/[^a-z]/g, "");
    if (n.length < 3 || seen.has(n) || BLOCKED_SUGGESTIONS.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

export function filterRemoteSuggestions(
  input: string,
  list: string[],
  loaded: Loaded,
): string[] {
  const q = input.toLowerCase();
  const out: string[] = [];
  for (const raw of list) {
    const s = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (s.length < 3 || s === q || BLOCKED_SUGGESTIONS.has(s)) continue;
    if (extraSet.has(s)) {
      out.push(s);
      continue;
    }
    if (!loaded.wordSet.has(s)) continue;
    const dist = editDistanceAtMost(q, s, 2);
    if (dist === 1 || (dist === 2 && sharedAffix(q, s) >= 7)) out.push(s);
  }
  return out;
}

export async function fetchRemoteSuggestions(word: string): Promise<string[]> {
  const q = word.toLowerCase().replace(/[^a-z]/g, "");
  if (q.length < 4) return [];
  try {
    const res = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=10`);
    if (!res.ok) return [];
    const rows = (await res.json()) as { word?: string }[];
    const out: string[] = [];
    for (const row of rows) {
      const n = (row.word ?? "").toLowerCase().replace(/[^a-z]/g, "");
      if (n.length < 3 || n === q || BLOCKED_SUGGESTIONS.has(n)) continue;
      if (n.startsWith("ass") && n.includes("burger")) continue;
      const dist = editDistanceAtMost(q, n, 3);
      if (dist > 3) continue;
      out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

export function replaceToken(raw: string, fromRaw: string, nextWord: string): string {
  const parts = tokenizeField(raw);
  const idx = parts.findIndex((p) => p === fromRaw);
  if (idx === -1) return raw;
  parts[idx] = nextWord;
  return parts.join(" ");
}
