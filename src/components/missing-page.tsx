import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { LetterRack } from "@/components/letter-rack";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { loadDictionary, wordsForTier } from "@/lib/anagram/dict";
import { countsOf, leftoverLetters, normalizeLetters } from "@/lib/anagram/letters";
import { solvePhrases, solveWords } from "@/lib/anagram/solver";
import { defaultFilters } from "@/lib/anagram/types";

type Tease = {
  words: string[];
  leftover: string;
  kind: "exact" | "phrase" | "partial" | "none";
};

function teaseFrom(letters: string, pool: { word: string; counts: Uint8Array; score: number; freq: number }[]): Tease {
  const have = countsOf(letters);
  const filters = defaultFilters();
  const exact = solveWords({
    pool,
    have,
    blanks: 0,
    mode: "exact",
    pattern: "",
    filters,
    sort: "common",
  });
  const cleanExact = exact.hits.find((h) => !h.leftover);
  if (cleanExact) return { kind: "exact", words: [cleanExact.word], leftover: "" };

  if (letters.length >= 4) {
    const phrases = solvePhrases({
      pool,
      have,
      blanks: 0,
      filters,
      maxWords: 3,
      phraseMinLen: 2,
      commonOnly: true,
      sort: "common",
    });
    const hit = phrases.hits[0];
    if (hit) return { kind: "phrase", words: hit.words, leftover: hit.leftover };
  }

  const rack = solveWords({
    pool,
    have,
    blanks: 0,
    mode: "from-rack",
    pattern: "",
    filters,
    sort: "length",
  });
  const best = rack.hits[0];
  if (best) return { kind: "partial", words: [best.word], leftover: best.leftover };
  return { kind: "none", words: [], leftover: leftoverLetters(have, new Uint8Array(26)) };
}

export function MissingPage() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const letters = normalizeLetters(path).letters;
  const [two, setTwo] = useState(false);
  const [tease, setTease] = useState<Tease | null>(null);

  useEffect(() => {
    let live = true;
    setTease(null);
    if (letters.length < 2) return;
    loadDictionary()
      .then((dict) => {
        if (!live) return;
        setTease(teaseFrom(letters, wordsForTier(dict, "common")));
      })
      .catch(() => {
        if (live) setTease({ kind: "none", words: [], leftover: letters });
      });
    return () => {
      live = false;
    };
  }, [letters]);

  return (
    <div className="min-h-dvh">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">404</p>
        <h1 className="mt-2 font-display text-4xl text-fg sm:text-5xl">
          The page isn’t missing. The letters are.
        </h1>
        <p className="mt-3 text-base text-muted">No exact anagram for this address.</p>

        <div className="mt-8 rounded-lg border border-border bg-surface px-4 py-4">
          <p className="font-mono text-xs uppercase tracking-wide text-subtle">{path}</p>
          <div className="mt-3">
            {letters ? (
              <LetterRack letters={letters} blanks={0} />
            ) : (
              <p className="text-sm text-subtle">No letters in that URL to work with.</p>
            )}
          </div>
        </div>

        {tease && tease.words.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wide text-subtle">Closest we could forge</p>
            <p className="mt-1 font-mono text-xl uppercase tracking-wide text-fg">
              {tease.words.join(" · ")}
            </p>
            {tease.leftover ? (
              <p className="mt-2 font-mono text-xs uppercase text-subtle">
                left {tease.leftover}
              </p>
            ) : (
              <p className="mt-2 text-xs uppercase tracking-wide text-muted">fills the rack — still not a page</p>
            )}
          </div>
        ) : null}

        <Link
          to="/"
          className="mt-10 inline-flex h-11 items-center rounded-md border border-border bg-raised px-4 text-sm text-fg hover:bg-surface"
        >
          Back to the forge
        </Link>
      </main>
    </div>
  );
}
