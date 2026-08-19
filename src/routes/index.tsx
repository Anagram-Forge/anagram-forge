import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, ChevronDown, Copy, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { DefinedWord } from "@/components/defined-word";
import { LetterRack } from "@/components/letter-rack";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnagramCardButton, PickChips } from "@/components/anagram-card";
import { SpellLine } from "@/components/spell-line";
import { SupportSlot } from "@/components/support-slot";
import { dictStats, loadDictionary, wordsForTier, type DictWord, type Loaded } from "@/lib/anagram/dict";
import { consumePicks, countsOf, canSpell, normalizeLetters, onlyLetters } from "@/lib/anagram/letters";
import { scrabbleScore } from "@/lib/anagram/scores";
import { groupByLength, parseMustInclude, solvePhrases, solveWords } from "@/lib/anagram/solver";
import { tokenizeField } from "@/lib/anagram/spell";
import { THEMES, isThemeId, type ThemeId } from "@/lib/anagram/themes";
import {
  defaultFilters,
  type DictTier,
  type Filters,
  type PhraseHit,
  type SolveMode,
  type SortKey,
  type WordHit,
} from "@/lib/anagram/types";
import { cn } from "@/lib/utils";

type Search = {
  q?: string;
  mode?: string;
  pattern?: string;
  dict?: string;
  inc?: string;
  theme?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
    mode: typeof raw.mode === "string" ? raw.mode : undefined,
    pattern: typeof raw.pattern === "string" ? raw.pattern : undefined,
    dict: typeof raw.dict === "string" ? raw.dict : undefined,
    inc: typeof raw.inc === "string" ? raw.inc : undefined,
    theme: typeof raw.theme === "string" ? raw.theme : undefined,
  }),
  component: Home,
});

const MODES: { id: SolveMode; label: string; hint: string }[] = [
  { id: "from-rack", label: "From rack", hint: "Every word you can spell with these letters" },
  { id: "exact", label: "Exact", hint: "Uses every letter (classic anagram)" },
  { id: "phrase", label: "Phrases", hint: "Two to five words that consume the rack" },
  { id: "pattern", label: "Pattern", hint: "? is any letter, * is any run" },
];

const DICTS: { id: DictTier; label: string }[] = [
  { id: "common", label: "Common" },
  { id: "standard", label: "Standard" },
  { id: "full", label: "Full" },
];

const SORTS: { id: SortKey; label: string }[] = [
  { id: "length", label: "Length" },
  { id: "score", label: "Score" },
  { id: "common", label: "Common" },
  { id: "rare", label: "Rare" },
  { id: "theme", label: "Theme" },
  { id: "alpha", label: "A–Z" },
];

function asMode(v: string): SolveMode {
  return MODES.some((m) => m.id === v) ? (v as SolveMode) : "from-rack";
}
function asDict(v: string): DictTier {
  return DICTS.some((d) => d.id === v) ? (v as DictTier) : "standard";
}

function cleanFilters(filters: Filters): Filters {
  return {
    ...filters,
    startsWith: onlyLetters(filters.startsWith),
    endsWith: onlyLetters(filters.endsWith),
    contains: onlyLetters(filters.contains),
    exclude: onlyLetters(filters.exclude),
  };
}

function totalLeft(p: { leftover: string }): number {
  return p.leftover.length;
}

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });

  const [letters, setLetters] = useState(search.q ?? "");
  const [mode, setMode] = useState<SolveMode>(asMode(search.mode ?? "from-rack"));
  const [pattern, setPattern] = useState(search.pattern ?? "");
  const [dict, setDict] = useState<DictTier>(asDict(search.dict ?? "standard"));
  const [mustRaw, setMustRaw] = useState(search.inc ?? "");
  const [theme, setTheme] = useState<ThemeId | null>(isThemeId(search.theme) ? search.theme : null);
  const [themeOnly, setThemeOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("length");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [maxWords, setMaxWords] = useState(3);
  const [phraseMinLen, setPhraseMinLen] = useState(3);
  const [two, setTwo] = useState(false);
  const [poolReady, setPoolReady] = useState(false);
  const [pool, setPool] = useState<DictWord[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [stats, setStats] = useState({ full: 0, common: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    let live = true;
    loadDictionary()
      .then((loadedDict) => {
        if (!live) return;
        setStats(dictStats(loadedDict));
        setLoaded(loadedDict);
        setPool(wordsForTier(loadedDict, dict));
        setPoolReady(true);
      })
      .catch(() => {
        if (live) setLoadError("Dictionary failed to load.");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!poolReady) return;
    loadDictionary().then((next) => setPool(wordsForTier(next, dict)));
  }, [dict, poolReady]);

  const parsed = useMemo(() => normalizeLetters(letters), [letters]);
  const mustInclude = useMemo(() => parseMustInclude(mustRaw), [mustRaw]);
  const seedTokens = useMemo(
    () =>
      tokenizeField(letters)
        .map((t) => onlyLetters(t))
        .filter((w) => w.length >= 2 && w.length <= 21),
    [letters],
  );
  const solvePool = useMemo(() => {
    if (!seedTokens.length) return pool;
    const have = new Set(pool.map((p) => p.word));
    const extra: DictWord[] = [];
    for (const word of seedTokens) {
      if (have.has(word)) continue;
      extra.push({
        word,
        counts: countsOf(word),
        score: scrabbleScore(word),
        freq: 6000,
      });
    }
    return extra.length ? extra.concat(pool) : pool;
  }, [pool, seedTokens]);
  const picked = useMemo(
    () => consumePicks(parsed.letters, parsed.blanks, picks),
    [parsed, picks],
  );

  useEffect(() => {
    setPicks([]);
    setCollapsed(new Set());
  }, [parsed.letters, parsed.blanks]);

  const result = useMemo(() => {
    if (!poolReady) return null;
    const have = picked.have;
    const blanks = picked.blanks;
    const remaining = totalLeft(picked);
    if (mode === "phrase" && picks.length === 0) {
      if (parsed.letters.length + parsed.blanks < 4) return { kind: "empty" as const };
      const r = solvePhrases({
        pool: solvePool,
        have: countsOf(parsed.letters),
        blanks: parsed.blanks,
        filters: cleanFilters(filters),
        maxWords,
        phraseMinLen,
        commonOnly: dict === "common",
        mustInclude,
        theme,
        themeOnly,
        sort,
      });
      return { kind: "phrase" as const, ...r };
    }
    if (picks.length > 0 && remaining === 0) {
      return { kind: "complete" as const };
    }
    if (mode === "pattern" && picks.length === 0 && !pattern.trim()) {
      return { kind: "need-pattern" as const };
    }
    if (remaining < 1 && picks.length === 0) {
      return { kind: "empty" as const };
    }
    if (remaining < 1 && picks.length > 0) {
      return { kind: "complete" as const };
    }
    const r = solveWords({
      pool: solvePool,
      have,
      blanks,
      mode: picks.length > 0 ? "from-rack" : mode === "phrase" ? "from-rack" : mode,
      pattern: picks.length > 0 ? "" : pattern,
      filters: cleanFilters(filters),
      sort,
      mustInclude: picks.length > 0 ? [] : mustInclude,
      theme,
      themeOnly,
    });
    if (picks.length > 0) {
      r.hits.sort((a, b) => Number(!b.leftover) - Number(!a.leftover));
    }
    return { kind: "words" as const, ...r };
  }, [poolReady, solvePool, parsed, mode, pattern, filters, sort, maxWords, phraseMinLen, dict, mustInclude, theme, themeOnly, picked, picks.length]);

  const grouped = result?.kind === "words" && sort === "length" ? groupByLength(result.hits) : [];
  const flatWords = result?.kind === "words" && sort !== "length" ? result.hits : [];

  function pushSearch(next: Partial<Search>) {
    void navigate({
      search: (prev) => ({
        q: next.q ?? prev.q,
        mode: next.mode ?? prev.mode,
        pattern: next.pattern ?? prev.pattern,
        dict: next.dict ?? prev.dict,
        inc: next.inc ?? prev.inc,
        theme: next.theme ?? prev.theme,
      }),
      replace: true,
    });
  }

  const leftoverWords =
    result?.kind === "words"
      ? [
          ...result.hits.filter((h) => !h.leftover).map((h) => h.word),
          ...result.hits.filter((h) => !!h.leftover).map((h) => h.word).slice(0, 8),
        ].filter((w, i, arr) => arr.indexOf(w) === i)
      : [];
  const leftoverTiles = [...picked.leftover.replace(/\?/g, "")];
  const leftoverAdds = leftoverWords.length ? leftoverWords : leftoverTiles;

  function addLeftoverTiles() {
    if (!leftoverTiles.length) return;
    setPicks((cur) => [...cur, ...leftoverTiles]);
  }

  function canAddPick(word: string): boolean {
    return canSpell(countsOf(word), picked.have, picked.blanks);
  }

  function togglePick(word: string) {
    setPicks((cur) => {
      const trial = consumePicks(parsed.letters, parsed.blanks, [...cur, word]);
      if (trial.ok) return [...cur, word];
      const i = cur.lastIndexOf(word);
      if (i >= 0) return cur.filter((_, j) => j !== i);
      return cur;
    });
  }

  async function copyWords(words: string[]) {
    await navigator.clipboard.writeText(words.join("\n"));
    toast("Copied to clipboard");
  }

  const activeHint = MODES.find((m) => m.id === mode)?.hint ?? "";

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl tracking-tight text-fg sm:text-5xl">
            Make words from a rack.
          </h1>
          <p className="mt-3 max-w-xl text-base text-muted">
            Exact anagrams, leftover-aware rack words, multi-word phrases, and crossword
            patterns. Blanks, filters, and Scrabble scores included.
          </p>
        </div>

        <section className="mt-8 rounded-xl border border-border bg-surface p-4 sm:p-6">
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  pushSearch({ mode: m.id });
                }}
                className={cn(
                  "h-10 rounded-md px-3 text-sm",
                  mode === m.id ? "bg-primary text-primary-fg" : "bg-raised text-muted hover:text-fg",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-subtle">{activeHint}</p>

          <label className="mt-5 block">
            <span className="text-xs font-medium uppercase tracking-wide text-subtle">Letters</span>
            <Input
              value={letters}
              onChange={(e) => {
                setLetters(e.target.value);
                pushSearch({ q: e.target.value });
              }}
              placeholder="listen  or  c?t  —  ? . _ are blanks"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1.5 font-mono text-base uppercase tracking-widest"
            />
          </label>
          <SpellLine
            raw={letters}
            loaded={loaded}
            onChange={(next) => {
              setLetters(next);
              pushSearch({ q: next });
            }}
          />

          <label className="mt-4 block">
            <span className="text-xs font-medium uppercase tracking-wide text-subtle">
              Must include
            </span>
            <Input
              value={mustRaw}
              onChange={(e) => {
                setMustRaw(e.target.value);
                pushSearch({ inc: e.target.value });
              }}
              placeholder="even — lock a word, or a chunk that must appear"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1.5 font-mono text-base"
            />
            <p className="mt-1.5 text-xs text-subtle">
              {mode === "phrase"
                ? "Locked as a phrase word when it fits the rack; leftover letters are solved around it."
                : "Only keep results that contain this string (eleven matches even)."}
            </p>
          </label>

          {mode === "pattern" && (
            <label className="mt-4 block">
              <span className="text-xs font-medium uppercase tracking-wide text-subtle">
                Pattern
              </span>
              <Input
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value);
                  pushSearch({ pattern: e.target.value });
                }}
                placeholder="c?t   *ing   ??a??"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-1.5 font-mono text-base"
              />
            </label>
          )}

          <div className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-subtle">Theme</span>
              <button
                type="button"
                onClick={() => {
                  setTheme(null);
                  pushSearch({ theme: "" });
                }}
                className={cn(
                  "h-9 rounded-sm px-3 text-xs",
                  theme === null ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                Any
              </button>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.hint}
                  onClick={() => {
                    const next = theme === t.id ? null : t.id;
                    setTheme(next);
                    pushSearch({ theme: next ?? "" });
                    if (next && sort === "length") setSort("theme");
                  }}
                  className={cn(
                    "h-9 rounded-sm px-3 text-xs",
                    theme === t.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {theme && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={themeOnly}
                  onChange={(e) => setThemeOnly(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                Only show {THEMES.find((t) => t.id === theme)?.label.toLowerCase()} matches
              </label>
            )}
          </div>

          <div className="mt-5">
            <LetterRack letters={parsed.letters} blanks={parsed.blanks} />
            <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
              {parsed.letters.length} letters
              {parsed.blanks ? ` · ${parsed.blanks} blank${parsed.blanks === 1 ? "" : "s"}` : ""}
              {picks.length > 0 ? ` · ${totalLeft(picked)} left` : ""}
              {parsed.letters.length > 15 && parsed.letters.length < 30
                ? " · tournament list tops out at 15-letter words — use Phrases or pick leftovers"
                : ""}
            </p>
            {parsed.letters.length >= 30 ? (
              <p className="mt-2 max-w-xl text-sm text-muted">
                Your laptop is the kitchen. This rack is a lot of stove. Switch to Phrases, or start
                picking.
              </p>
            ) : null}
          </div>

          {(picks.length > 0 || result?.kind === "words") && (
            <div
              className={cn(
                "mt-4 rounded-lg border px-3 py-3",
                picks.length > 0 ? "border-accent/50 bg-accent-dim/40" : "border-border bg-raised",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-xs uppercase tracking-wide",
                    picks.length > 0 ? "text-accent" : "text-subtle",
                  )}
                >
                  Picked
                </span>
                {picks.length === 0 ? (
                  <span className="text-xs text-muted">
                    Check a word below to lock it and solve the leftover letters. A and I count.
                  </span>
                ) : (
                  <PickChips
                    picks={picks}
                    onReorder={setPicks}
                    onRemove={(i) => setPicks((cur) => cur.filter((_, j) => j !== i))}
                  />
                )}
                {picks.length > 0 && (
                  <button
                    type="button"
                    className="ml-auto h-8 text-xs text-muted hover:text-fg"
                    onClick={() => setPicks([])}
                  >
                    Clear picks
                  </button>
                )}
              </div>
              {picks.length > 1 && (
                <p className="mt-2 text-xs text-subtle">
                  Drag a chip or use the arrows to rearrange the phrase.
                </p>
              )}
              {picks.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs uppercase tracking-wide text-subtle">
                    {totalLeft(picked) === 0
                      ? "Rack filled"
                      : `Remaining · ${totalLeft(picked)}`}
                  </p>
                  {totalLeft(picked) > 0 ? (
                    <>
                      <LetterRack
                        letters={picked.leftover.replace(/\?/g, "")}
                        blanks={picked.blanks}
                      />
                      {(leftoverWords.length > 0 || leftoverTiles.length > 0) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs uppercase tracking-wide text-subtle">
                            Add leftover
                          </span>
                          {leftoverWords.map((w) => (
                            <button
                              key={`w-${w}`}
                              type="button"
                              onClick={() => togglePick(w)}
                              className="inline-flex h-9 items-center rounded-sm border border-dashed border-accent/60 px-2.5 font-mono text-xs uppercase tracking-wide text-accent hover:bg-accent hover:text-accent-fg"
                            >
                              + {w}
                            </button>
                          ))}
                          {leftoverTiles.map((ch, i) => (
                            <button
                              key={`t-${ch}-${i}`}
                              type="button"
                              onClick={() => togglePick(ch)}
                              className="inline-flex h-9 items-center rounded-sm border border-dashed border-accent/40 px-2.5 font-mono text-xs uppercase tracking-wide text-accent hover:bg-accent hover:text-accent-fg"
                            >
                              + {ch}
                            </button>
                          ))}
                          {leftoverTiles.length > 1 && (
                            <button
                              type="button"
                              onClick={addLeftoverTiles}
                              className="inline-flex h-9 items-center rounded-sm px-2 text-xs text-muted hover:text-fg"
                            >
                              Add all
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="font-mono text-sm uppercase tracking-wide text-fg">
                      {picks.join(" · ")}
                    </p>
                  )}
                  <div className="mt-3">
                    <AnagramCardButton
                      source={letters}
                      picks={picks}
                      leftoverAdds={[...leftoverWords, ...leftoverTiles]}
                      filled={totalLeft(picked) === 0}
                      onReorder={setPicks}
                      onAdd={togglePick}
                      onRemove={(i) => setPicks((cur) => cur.filter((_, j) => j !== i))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-subtle">Dictionary</span>
            {DICTS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDict(d.id);
                  pushSearch({ dict: d.id });
                }}
                className={cn(
                  "h-9 rounded-sm px-3 text-xs",
                  dict === d.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                {d.label}
              </button>
            ))}
            <span className="text-xs text-subtle">
              {dict === "common"
                ? `${stats.common || "10k"} everyday words`
                : dict === "full"
                  ? `${stats.full || "178k"} tournament words`
                  : "Common plus playable 2–8 letter words"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-subtle">Sort</span>
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSort(s.id)}
                className={cn(
                  "h-9 rounded-sm px-3 text-xs",
                  sort === s.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="ml-auto h-9 text-xs text-muted hover:text-fg"
            >
              {showFilters ? "Hide filters" : "Filters"}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Min length">
                <Input
                  type="number"
                  min={2}
                  max={21}
                  value={filters.minLen}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, minLen: Number(e.target.value) || 2 }))
                  }
                />
              </Field>
              <Field label="Max length">
                <Input
                  type="number"
                  min={2}
                  max={21}
                  value={filters.maxLen}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, maxLen: Number(e.target.value) || 21 }))
                  }
                />
              </Field>
              <Field label="Starts with">
                <Input
                  value={filters.startsWith}
                  onChange={(e) => setFilters((f) => ({ ...f, startsWith: e.target.value }))}
                  className="font-mono"
                />
              </Field>
              <Field label="Ends with">
                <Input
                  value={filters.endsWith}
                  onChange={(e) => setFilters((f) => ({ ...f, endsWith: e.target.value }))}
                  className="font-mono"
                />
              </Field>
              <Field label="Contains">
                <Input
                  value={filters.contains}
                  onChange={(e) => setFilters((f) => ({ ...f, contains: e.target.value }))}
                  className="font-mono"
                />
              </Field>
              <Field label="Exclude letters">
                <Input
                  value={filters.exclude}
                  onChange={(e) => setFilters((f) => ({ ...f, exclude: e.target.value }))}
                  className="font-mono"
                />
              </Field>
              {mode === "phrase" && (
                <>
                  <Field label="Max words">
                    <Input
                      type="number"
                      min={2}
                      max={5}
                      value={maxWords}
                      onChange={(e) =>
                        setMaxWords(Math.min(5, Math.max(2, Number(e.target.value) || 3)))
                      }
                    />
                  </Field>
                  <Field label="Min word size">
                    <Input
                      type="number"
                      min={2}
                      max={8}
                      value={phraseMinLen}
                      onChange={(e) =>
                        setPhraseMinLen(Math.min(8, Math.max(2, Number(e.target.value) || 3)))
                      }
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {result?.kind === "words" && result.hits.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyWords(result.hits.map((h) => h.word))}
              >
                <Copy /> Copy all
              </Button>
            )}
            {result?.kind === "phrase" && result.hits.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => copyWords(result.hits.map((h) => h.words.join(" ")))}
              >
                <Copy /> Copy phrases
              </Button>
            )}
          </div>
        </section>

        <section className="mt-8">
          {loadError && <p className="text-sm text-danger">{loadError}</p>}
          {!poolReady && !loadError && <p className="text-sm text-muted">Loading dictionary…</p>}
          {result?.kind === "empty" && poolReady && (
            <Empty
              title="Waiting on a rack"
              body="Enter at least two letters. Add ? for a blank. Try listen, or a longer phrase like eleven plus two."
            />
          )}
          {result?.kind === "need-pattern" && (
            <Empty
              title="Need a pattern"
              body="Use ? for one unknown letter and * for any sequence. Example: c?t or *tion."
            />
          )}
          {result?.kind === "complete" && (
            <Empty
              title="Rack filled"
              body={`${picks.join(" · ")} uses every letter. Copy the phrase or clear a pick to keep going.`}
            />
          )}
          {result?.kind === "words" &&
            result.hits.length === 0 &&
            poolReady &&
            !picks.length &&
            mode === "exact" &&
            parsed.letters.length + parsed.blanks > 15 && (
              <Empty
                title="No single word that long"
                body="The tournament list stops at 15 letters. Switch to From rack for pieces, or Phrases to use the whole name."
              />
            )}
          {result?.kind === "words" &&
            result.hits.length === 0 &&
            poolReady &&
            (picks.length > 0 || mode !== "exact" || parsed.letters.length + parsed.blanks <= 15) && (
              <Empty
                title={picks.length ? "No leftover words" : "No matches"}
                body={
                  picks.length
                    ? "That pick does not leave a playable remainder. Uncheck it and try another word."
                    : "Loosen filters, switch to Full dictionary, or add a blank."
                }
              />
            )}
          {result?.kind === "phrase" && result.hits.length === 0 && poolReady && (
            <Empty
              title="No phrases yet"
              body="Try more words (up to 5), a lower min word size, or From rack. Names you type are included even if they are not tournament words."
            />
          )}

          {result?.kind === "words" && result.hits.length > 0 && (
            <div>
              <p className="mb-3 text-sm tabular-nums text-muted">
                {result.hits.length} word{result.hits.length === 1 ? "" : "s"}
                {result.truncated ? " (capped)" : ""}
                <span className="text-subtle"> · hover a word for a definition</span>
              </p>
              {sort === "length" && grouped.length > 1 ? (
                <WordBanks
                  groups={grouped}
                  collapsed={collapsed}
                  onToggle={(len) =>
                    setCollapsed((cur) => {
                      const next = new Set(cur);
                      if (next.has(len)) next.delete(len);
                      else next.add(len);
                      return next;
                    })
                  }
                  onCollapseAll={() => setCollapsed(new Set(grouped.map((g) => g.len)))}
                  onExpandAll={() => setCollapsed(new Set())}
                  renderWord={(hit) => (
                    <WordRow
                      key={hit.word}
                      hit={hit}
                      picked={picks.includes(hit.word) && !canAddPick(hit.word)}
                      onToggle={() => togglePick(hit.word)}
                      onCopy={() => copyWords([hit.word])}
                    />
                  )}
                />
              ) : (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(sort === "length" ? grouped.flatMap((g) => g.words) : flatWords).map((hit) => (
                    <WordRow
                      key={hit.word}
                      hit={hit}
                      picked={picks.includes(hit.word) && !canAddPick(hit.word)}
                      onToggle={() => togglePick(hit.word)}
                      onCopy={() => copyWords([hit.word])}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {result?.kind === "phrase" && result.hits.length > 0 && (
            <div>
              <p className="mb-4 text-sm tabular-nums text-muted">
                {result.hits.length} phrase{result.hits.length === 1 ? "" : "s"}
                {result.timedOut ? " · search budget reached" : ""}
                {result.truncated ? " · capped" : ""}
              </p>
              <ul className="space-y-2">
                {result.hits.map((hit) => (
                  <PhraseRow
                    key={hit.words.join("-")}
                    hit={hit}
                    onCopy={() => copyWords([hit.words.join(" ")])}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
        <SupportSlot />
      </main>
    </div>
  );
}

function WordBanks({
  groups,
  collapsed,
  onToggle,
  onCollapseAll,
  onExpandAll,
  renderWord,
}: {
  groups: { len: number; words: WordHit[] }[];
  collapsed: Set<number>;
  onToggle: (len: number) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  renderWord: (hit: WordHit) => ReactNode;
}) {
  const allClosed = groups.every((g) => collapsed.has(g.len));
  return (
    <div>
      <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg/95 px-3 py-2 backdrop-blur-sm">
        <span className="mr-1 text-xs uppercase tracking-wide text-subtle">Jump</span>
        {groups.map((g) => (
          <a
            key={g.len}
            href={`#bank-${g.len}`}
            onClick={(e) => {
              e.preventDefault();
              if (collapsed.has(g.len)) onToggle(g.len);
              document.getElementById(`bank-${g.len}`)?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            }}
            className={cn(
              "inline-flex h-8 min-w-8 items-center justify-center rounded-sm px-2 font-mono text-xs tabular-nums",
              collapsed.has(g.len) ? "text-subtle hover:text-fg" : "bg-raised text-fg",
            )}
          >
            {g.len}
            <span className="ml-1 text-[10px] text-subtle">{g.words.length}</span>
          </a>
        ))}
        <button
          type="button"
          className="ml-auto h-8 px-2 text-xs text-muted hover:text-fg"
          onClick={allClosed ? onExpandAll : onCollapseAll}
        >
          {allClosed ? "Expand all" : "Collapse all"}
        </button>
      </div>
      <div className="space-y-3">
        {groups.map((g) => {
          const shut = collapsed.has(g.len);
          return (
            <section key={g.len} id={`bank-${g.len}`} className="scroll-mt-16">
              <button
                type="button"
                onClick={() => onToggle(g.len)}
                aria-expanded={!shut}
                className="flex w-full items-center gap-2 rounded-md px-1 py-2 text-left hover:bg-raised"
              >
                <ChevronDown
                  className={cn("size-4 text-subtle transition-transform", shut && "-rotate-90")}
                />
                <h2 className="text-xs font-medium uppercase tracking-wide text-subtle">
                  {g.len} letter{g.len === 1 ? "" : "s"} · {g.words.length}
                </h2>
              </button>
              {!shut && (
                <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.words.map((hit) => renderWord(hit))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-subtle">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-5 py-10">
      <Search className="size-5 text-subtle" />
      <p className="mt-3 font-display text-xl text-fg">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}

function WordRow({
  hit,
  picked,
  onToggle,
  onCopy,
}: {
  hit: WordHit;
  picked: boolean;
  onToggle: () => void;
  onCopy: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={picked}
        aria-label={picked ? `Remove ${hit.word} from picks` : `Pick ${hit.word}`}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-sm border",
          picked
            ? "border-accent bg-accent text-accent-fg"
            : "border-border text-muted hover:text-fg",
        )}
      >
        {picked ? <Check className="size-4" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <DefinedWord
          word={hit.word}
          className="block truncate font-mono text-sm uppercase tracking-wide text-fg"
        />
        {!hit.leftover ? (
          <span className="mt-0.5 inline-block rounded-sm bg-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            fills
          </span>
        ) : (
          <span
            title={`Letters left after this word: ${hit.leftover}`}
            className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wider text-subtle"
          >
            left {hit.leftover}
          </span>
        )}
      </div>
      {hit.themeHit ? (
        <span className="shrink-0 rounded-sm bg-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          theme
        </span>
      ) : null}
      <span title="Scrabble score" className="tabular-nums text-xs text-subtle">
        {hit.score}
      </span>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-sm text-muted hover:text-fg"
        onClick={onCopy}
        aria-label="Copy word"
      >
        <Copy className="size-4" />
      </button>
    </li>
  );
}

function PhraseRow({ hit, onCopy }: { hit: PhraseHit; onCopy: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm uppercase tracking-wide text-fg">
        {hit.words.map((w, i) => {
          const locked = hit.locked?.includes(w);
          return (
            <span key={`${w}-${i}`} className="inline-flex items-center gap-2">
              {i > 0 ? <span className="text-subtle">·</span> : null}
              <DefinedWord
                word={w}
                className={cn(
                  "font-mono text-sm uppercase tracking-wide",
                  locked ? "text-primary" : "text-fg",
                )}
              />
            </span>
          );
        })}
      </p>
      {(hit.themeScore ?? 0) > 0 ? (
        <span className="tabular-nums text-[10px] uppercase tracking-wide text-muted">
          {hit.themeScore} theme
        </span>
      ) : null}
      <span className="tabular-nums text-xs text-subtle">{hit.score}</span>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-sm text-muted hover:text-fg"
        onClick={onCopy}
        aria-label="Copy phrase"
      >
        <Copy className="size-4" />
      </button>
    </li>
  );
}
