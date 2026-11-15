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

const MAX_PERFECT = 240;
const TRIPLE_LIMIT = 800;

function signature(counts: Uint8Array): string {
  let s = "";
  for (let i = 0; i < 26; i++) {
    const n = counts[i];
    if (n) s += String.fromCharCode(97 + i).repeat(n);
  }
  return s;
}

function fitsExact(have: Uint8Array, need: Uint8Array): boolean {
  for (let i = 0; i < 26; i++) if (need[i] > have[i]) return false;
  return true;
}

/** One to five words that use the rack exactly. Pairs, and triples when the list is small, are complete. */
export function solvePerfect(opts: {
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
}): {
  hits: PhraseHit[];
  truncated: boolean;
  timedOut: boolean;
  candidateCount: number;
  depthComplete: number;
} {
  const have0 = opts.have;
  const blanks0 = opts.blanks;
  const maxWords = Math.min(5, Math.max(1, opts.maxWords));
  const minLen = Math.min(8, Math.max(2, opts.phraseMinLen));
  const must = opts.mustInclude ?? [];
  const sort = opts.sort ?? "score";
  const remaining = have0.slice();
  let blanksLeft = blanks0;
  const locked: DictWord[] = [];
  const substringNeed: string[] = [];

  for (const token of must) {
    const need = countsOf(token);
    if (canSpell(need, remaining, blanksLeft)) {
      blanksLeft -= consume(remaining, need);
      const fromPool = opts.pool.find((w) => w.word === token);
      locked.push(
        fromPool ?? { word: token, counts: need, score: 0, freq: 0 },
      );
    } else {
      substringNeed.push(token);
    }
  }

  const hits: PhraseHit[] = [];
  const seen = new Set<string>();
  let truncated = false;
  let timedOut = false;

  function push(extra: DictWord[]) {
    const words = [...locked.map((w) => w.word), ...extra.map((w) => w.word)];
    if (words.length < 1 || words.length > maxWords) return;
    for (const token of substringNeed) {
      if (!words.some((w) => w.includes(token))) return;
    }
    const themeScore = phraseThemeScore(words, opts.theme ?? null);
    if (opts.themeOnly && opts.theme && themeScore === 0) return;
    const key = words.slice().sort().join("\0");
    if (seen.has(key)) return;
    seen.add(key);
    const rest = extra
      .map((w) => w.word)
      .sort((a, b) => b.length - a.length || a.localeCompare(b));
    hits.push({
      words: [...locked.map((w) => w.word), ...rest],
      score: extra.reduce((n, w) => n + w.score, 0) + locked.reduce((n, w) => n + w.score, 0),
      leftover: "",
      locked: locked.length ? locked.map((w) => w.word) : undefined,
      themeScore,
    });
  }

  const lettersLeft0 = totalCount(remaining) + blanksLeft;
  if (lettersLeft0 === 0) {
    if (locked.length) push([]);
    return { hits, truncated: false, timedOut: false, candidateCount: 0, depthComplete: locked.length };
  }

  const slots = maxWords - locked.length;
  if (slots < 1) return { hits, truncated: false, timedOut: false, candidateCount: 0, depthComplete: locked.length };

  const pieces: DictWord[] = [];
  for (const dw of opts.pool) {
    if (opts.commonOnly && dw.freq <= 0) continue;
    if (dw.word.length < minLen || dw.word.length > lettersLeft0) continue;
    if (opts.filters.maxLen && dw.word.length > opts.filters.maxLen) continue;
    if (dw.score < opts.filters.minScore) continue;
    if (!canSpell(dw.counts, remaining, blanksLeft)) continue;
    if (opts.filters.exclude) {
      let skip = false;
      for (const ch of opts.filters.exclude) {
        if (dw.word.includes(ch)) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
    }
    pieces.push(dw);
  }

  const bySig = new Map<string, DictWord[]>();
  for (const dw of pieces) {
    const sig = signature(dw.counts);
    const list = bySig.get(sig);
    if (list) list.push(dw);
    else bySig.set(sig, [dw]);
  }

  if (slots >= 1) {
    for (const dw of opts.pool) {
      if (dw.word.length !== lettersLeft0) continue;
      if (opts.commonOnly && dw.freq <= 0) continue;
      if (dw.score < opts.filters.minScore) continue;
      if (blanksLeft === 0) {
        if (!fitsExact(remaining, dw.counts)) continue;
      } else {
        const tmp = remaining.slice();
        const used = consume(tmp, dw.counts);
        if (totalCount(tmp) !== 0 || blanksLeft - used !== 0) continue;
      }
      if (passesFilters(dw.word, dw.score, { ...opts.filters, minLen: 2 }, [])) push([dw]);
    }
  }

  const room = pieces.filter((dw) => dw.word.length <= lettersLeft0 - minLen);

  if (slots >= 2 && blanksLeft === 0) {
    for (const a of room) {
      const rem = remaining.slice();
      for (let i = 0; i < 26; i++) rem[i] -= a.counts[i];
      const partners = bySig.get(signature(rem));
      if (!partners) continue;
      for (const b of partners) {
        if (b.word.length < minLen) continue;
        if (a.word > b.word) continue;
        if (slots < 2) continue;
        push([a, b]);
      }
    }
  }

  let triplesDone = slots < 3 || blanksLeft > 0;
  if (slots >= 3 && blanksLeft === 0 && room.length <= TRIPLE_LIMIT) {
    const t0 = performance.now();
    triplesDone = true;
    outer: for (let i = 0; i < room.length; i++) {
      if (performance.now() - t0 > 450) {
        timedOut = true;
        triplesDone = false;
        break;
      }
      const a = room[i];
      const rem1 = remaining.slice();
      for (let k = 0; k < 26; k++) rem1[k] -= a.counts[k];
      const left1 = totalCount(rem1);
      if (left1 < minLen * 2) continue;
      for (let j = i; j < room.length; j++) {
        if (hits.length > 8000) {
          truncated = true;
          triplesDone = false;
          break outer;
        }
        const b = room[j];
        if (b.word.length > left1 - minLen) continue;
        if (!fitsExact(rem1, b.counts)) continue;
        const rem2 = rem1.slice();
        for (let k = 0; k < 26; k++) rem2[k] -= b.counts[k];
        const partners = bySig.get(signature(rem2));
        if (!partners) continue;
        for (const c of partners) {
          if (c.word < b.word) continue;
          push([a, b, c]);
        }
      }
    }
  }

  const needWalk = blanksLeft > 0 || slots >= 4 || (slots >= 3 && !triplesDone) || (slots >= 2 && blanksLeft > 0);
  if (needWalk && slots >= 2) {
    const lists: DictWord[][] = Array.from({ length: 26 }, () => []);
    for (const dw of room) {
      for (let i = 0; i < 26; i++) if (dw.counts[i]) lists[i].push(dw);
    }
    const have = remaining.slice();
    let blanks = blanksLeft;
    const stack: DictWord[] = [];
    const start = performance.now();
    const budget = Math.min(1100, 320 + lettersLeft0 * 28);
    const minDepth = blanksLeft > 0 ? 2 : !triplesDone && slots >= 3 ? 3 : 4;

    function walk() {
      if (timedOut || truncated) return;
      const lettersLeft = totalCount(have);
      if (lettersLeft === 0 && blanks === 0) {
        if (stack.length >= minDepth && stack.length <= slots) push(stack);
        return;
      }
      if (stack.length >= slots) return;
      if (lettersLeft > 0 && lettersLeft < minLen && blanks === 0) return;
      if (performance.now() - start > budget) {
        timedOut = true;
        return;
      }
      let rare = -1;
      let best = Infinity;
      for (let i = 0; i < 26; i++) {
        if (have[i] === 0) continue;
        const n = lists[i].length;
        if (n < best) {
          best = n;
          rare = i;
        }
      }
      const list = rare >= 0 ? lists[rare] : room;
      for (let i = 0; i < list.length; i++) {
        const dw = list[i];
        if (dw.word.length > lettersLeft + blanks) continue;
        if (!canSpell(dw.counts, have, blanks)) continue;
        const before = have.slice();
        const b0 = blanks;
        blanks -= consume(have, dw.counts);
        stack.push(dw);
        walk();
        stack.pop();
        blanks = b0;
        have.set(before);
        if (timedOut || truncated) return;
      }
    }
    walk();
  }

  hits.sort((a, b) => {
    if (a.words.length !== b.words.length) return a.words.length - b.words.length;
    if (sort === "alpha") return a.words.join(" ").localeCompare(b.words.join(" "));
    if (sort === "theme") return (b.themeScore ?? 0) - (a.themeScore ?? 0) || b.score - a.score;
    if (sort === "rare") return a.score - b.score || a.words.join(" ").localeCompare(b.words.join(" "));
    return b.score - a.score || a.words.join(" ").localeCompare(b.words.join(" "));
  });

  const depthComplete = blanksLeft > 0 ? 1 : triplesDone ? Math.min(3, Math.max(slots, 1)) : Math.min(2, slots);

  return {
    hits: hits.slice(0, MAX_PERFECT),
    truncated: truncated || hits.length > MAX_PERFECT,
    timedOut,
    candidateCount: pieces.length,
    depthComplete,
  };
}
