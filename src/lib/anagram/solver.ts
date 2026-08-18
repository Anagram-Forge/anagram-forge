import {
  canSpell,
  consume,
  leftoverLetters,
  patternToRegex,
  totalCount,
  isOneLetterWord,
} from "./letters";
import { countsOf } from "./letters";
import type { DictWord } from "./dict";
import { phraseThemeScore, wordInTheme, type ThemeId } from "./themes";
import type { Filters, PhraseHit, SolveMode, SortKey, WordHit } from "./types";

const MAX_SINGLE = 800;
const MAX_PHRASE = 160;

export function parseMustInclude(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.toLowerCase().split(/[\s,+/]+/)) {
    let w = "";
    for (const ch of part) {
      const n = ch.charCodeAt(0) - 97;
      if (n >= 0 && n < 26) w += ch;
    }
    if (w.length >= 2 && !seen.has(w)) {
      seen.add(w);
      out.push(w);
    }
  }
  return out;
}

function passesFilters(word: string, score: number, f: Filters, must: string[]): boolean {
  if (word.length < f.minLen && !isOneLetterWord(word)) return false;
  if (word.length > f.maxLen) return false;
  if (score < f.minScore) return false;
  if (f.startsWith && !word.startsWith(f.startsWith)) return false;
  if (f.endsWith && !word.endsWith(f.endsWith)) return false;
  if (f.contains && !word.includes(f.contains)) return false;
  if (f.exclude) {
    for (const ch of f.exclude) {
      if (word.includes(ch)) return false;
    }
  }
  for (const token of must) {
    if (!word.includes(token)) return false;
  }
  return true;
}

function sortHits(hits: WordHit[], sort: SortKey): WordHit[] {
  const copy = hits.slice();
  if (sort === "alpha") copy.sort((a, b) => a.word.localeCompare(b.word));
  else if (sort === "score")
    copy.sort((a, b) => b.score - a.score || b.word.length - a.word.length || a.word.localeCompare(b.word));
  else if (sort === "common")
    copy.sort((a, b) => b.freq - a.freq || b.word.length - a.word.length || a.word.localeCompare(b.word));
  else if (sort === "rare")
    copy.sort((a, b) => a.freq - b.freq || b.word.length - a.word.length || a.word.localeCompare(b.word));
  else if (sort === "theme")
    copy.sort(
      (a, b) =>
        Number(b.themeHit) - Number(a.themeHit) ||
        b.freq - a.freq ||
        b.word.length - a.word.length ||
        a.word.localeCompare(b.word),
    );
  else
    copy.sort((a, b) => b.word.length - a.word.length || b.score - a.score || a.word.localeCompare(b.word));
  return copy;
}

export function solveWords(opts: {
  pool: DictWord[];
  have: Uint8Array;
  blanks: number;
  mode: Extract<SolveMode, "from-rack" | "exact" | "pattern">;
  pattern: string;
  filters: Filters;
  sort: SortKey;
  mustInclude?: string[];
  theme?: ThemeId | null;
  themeOnly?: boolean;
}): { hits: WordHit[]; truncated: boolean } {
  const { pool, have, blanks, mode, filters, sort } = opts;
  const must = opts.mustInclude ?? [];
  const rackLen = totalCount(have) + blanks;
  const re = mode === "pattern" ? patternToRegex(opts.pattern) : null;
  const hits: WordHit[] = [];

  for (const dw of pool) {
    if (mode === "exact" && dw.word.length !== rackLen) continue;
    if (mode === "pattern") {
      if (!re || !re.test(dw.word)) continue;
      if (rackLen > 0 && !canSpell(dw.counts, have, blanks)) continue;
    } else if (!canSpell(dw.counts, have, blanks)) {
      continue;
    }
    if (!passesFilters(dw.word, dw.score, filters, must)) continue;
    const themeHit = wordInTheme(dw.word, opts.theme ?? null);
    if (opts.themeOnly && opts.theme && !themeHit) continue;
    hits.push({
      word: dw.word,
      score: dw.score,
      freq: dw.freq,
      leftover: leftoverLetters(have, dw.counts),
      themeHit,
    });
  }

  const sorted = sortHits(hits, sort);
  return {
    hits: sorted.slice(0, MAX_SINGLE),
    truncated: sorted.length > MAX_SINGLE,
  };
}

export function solvePhrases(opts: {
  pool: DictWord[];
  have: Uint8Array;
  blanks: number;
  filters: Filters;
  maxWords: number;
  phraseMinLen: number;
  commonOnly?: boolean;
  mustInclude?: string[];
  theme?: ThemeId | null;
  themeOnly?: boolean;
  sort?: SortKey;
}): { hits: PhraseHit[]; truncated: boolean; timedOut: boolean; candidateCount: number } {
  const { have, blanks, filters, phraseMinLen } = opts;
  const maxWords = Math.min(Math.max(opts.maxWords, 2), 5);
  const rackForBudget = totalCount(have) + blanks;
  const budget = Math.min(1600, 380 + rackForBudget * 40);
  const must = opts.mustInclude ?? [];
  const remaining = have.slice();
  let blanksLeft = blanks;
  const lockedWords: string[] = [];
  const substringNeed: string[] = [];

  for (const token of must) {
    const need = countsOf(token);
    if (canSpell(need, remaining, blanksLeft)) {
      blanksLeft -= consume(remaining, need);
      lockedWords.push(token);
    } else {
      substringNeed.push(token);
    }
  }

  const lettersLeft0 = totalCount(remaining) + blanksLeft;
  const slotsLeft = Math.max(0, maxWords - lockedWords.length);

  if (lettersLeft0 === 0) {
    if (lockedWords.length === 0) {
      return { hits: [], truncated: false, timedOut: false, candidateCount: 0 };
    }
    if (substringNeed.some((t) => !lockedWords.some((w) => w.includes(t)))) {
      return { hits: [], truncated: false, timedOut: false, candidateCount: 0 };
    }
    const themeScore = phraseThemeScore(lockedWords, opts.theme ?? null);
    if (opts.themeOnly && opts.theme && themeScore === 0) {
      return { hits: [], truncated: false, timedOut: false, candidateCount: 0 };
    }
    return {
      hits: [
        {
          words: lockedWords,
          score: 0,
          leftover: "",
          locked: lockedWords,
          themeScore,
        },
      ],
      truncated: false,
      timedOut: false,
      candidateCount: 0,
    };
  }

  if (slotsLeft < 1) {
    return { hits: [], truncated: false, timedOut: false, candidateCount: 0 };
  }

  const minRest = lockedWords.length > 0 ? 1 : 2;
  const minLen = lockedWords.length > 0 ? Math.min(phraseMinLen, 2) : phraseMinLen;

  const candidates = opts.pool
    .filter((dw) => {
      if (opts.commonOnly && dw.freq <= 0) return false;
      if (dw.word.length < minLen && !isOneLetterWord(dw.word)) return false;
      if (dw.word.length > lettersLeft0) return false;
      if (!canSpell(dw.counts, remaining, blanksLeft)) return false;
      if (filters.exclude) {
        for (const ch of filters.exclude) {
          if (dw.word.includes(ch)) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const ac = a.freq > 0 ? 1 : 0;
      const bc = b.freq > 0 ? 1 : 0;
      if (bc !== ac) return bc - ac;
      return b.word.length - a.word.length || b.freq - a.freq;
    });

  const hits: PhraseHit[] = [];
  const seen = new Set<string>();
  const start = performance.now();
  let timedOut = false;
  let truncated = false;
  const stack: DictWord[] = [];
  const walkHave = remaining.slice();
  let walkBlanks = blanksLeft;

  function keyOf(words: string[]) {
    return words.slice().sort().join(" ");
  }

  function accept(extra: string[]) {
    const words = [...lockedWords, ...extra];
    if (words.length < minRest && lockedWords.length === 0) return;
    if (words.length < 1) return;
    for (const token of substringNeed) {
      if (!words.some((w) => w.includes(token))) return;
    }
    const themeScore = phraseThemeScore(words, opts.theme ?? null);
    if (opts.themeOnly && opts.theme && themeScore === 0) return;
    const k = keyOf(words);
    if (seen.has(k)) return;
    seen.add(k);
    hits.push({
      words,
      score: extra.reduce((n, w) => {
        const dw = candidates.find((c) => c.word === w);
        return n + (dw?.score ?? 0);
      }, 0),
      leftover: "",
      locked: lockedWords.length ? lockedWords : undefined,
      themeScore,
    });
  }

  function walk(startIdx: number, lettersLeft: number) {
    if (hits.length >= MAX_PHRASE) {
      truncated = true;
      return;
    }
    if (performance.now() - start > budget) {
      timedOut = true;
      return;
    }
    if (lettersLeft === 0) {
      if (stack.length >= (lockedWords.length > 0 ? 1 : 2) || lockedWords.length >= 1) {
        accept(stack.map((w) => w.word));
      }
      return;
    }
    if (stack.length >= slotsLeft) return;

    for (let i = startIdx; i < candidates.length; i++) {
      if (timedOut || truncated) return;
      const dw = candidates[i];
      if (dw.word.length > lettersLeft) continue;
      if (!canSpell(dw.counts, walkHave, walkBlanks)) continue;

      const before = walkHave.slice();
      const usedBlanks = consume(walkHave, dw.counts);
      walkBlanks -= usedBlanks;
      stack.push(dw);
      walk(i, lettersLeft - dw.word.length);
      stack.pop();
      walkBlanks += usedBlanks;
      walkHave.set(before);
    }
  }

  walk(0, lettersLeft0);

  const sort = opts.sort ?? "score";
  hits.sort((a, b) => {
    if (sort === "theme") {
      return (
        (b.themeScore ?? 0) - (a.themeScore ?? 0) ||
        b.score - a.score ||
        a.words.join(" ").localeCompare(b.words.join(" "))
      );
    }
    if (sort === "common") {
      return a.words.length - b.words.length || b.score - a.score;
    }
    if (sort === "rare") {
      return (a.themeScore ?? 0) - (b.themeScore ?? 0) || a.score - b.score;
    }
    if (sort === "alpha") return a.words.join(" ").localeCompare(b.words.join(" "));
    if (sort === "length") return b.words.join("").length - a.words.join("").length || b.score - a.score;
    return b.score - a.score || a.words.length - b.words.length || a.words.join(" ").localeCompare(b.words.join(" "));
  });
  return { hits, truncated, timedOut, candidateCount: candidates.length };
}

export function groupByLength(hits: WordHit[]): { len: number; words: WordHit[] }[] {
  const map = new Map<number, WordHit[]>();
  for (const h of hits) {
    const list = map.get(h.word.length);
    if (list) list.push(h);
    else map.set(h.word.length, [h]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([len, words]) => ({ len, words }));
}
