import { useEffect, useMemo, useState } from "react";
import { DefinedWord } from "@/components/defined-word";
import { defineWord, type Definition } from "@/lib/anagram/define";
import type { Loaded } from "@/lib/anagram/dict";
import {
  checkTokens,
  fetchRemoteSuggestions,
  filterRemoteSuggestions,
  isNearSuggestion,
  mergeSuggestions,
  replaceToken,
  type SpellToken,
} from "@/lib/anagram/spell";
import { cn } from "@/lib/utils";

export function SpellLine({
  raw,
  loaded,
  onChange,
}: {
  raw: string;
  loaded: Loaded | null;
  onChange: (next: string) => void;
}) {
  const local = useMemo(() => checkTokens(raw, loaded), [raw, loaded]);
  const [remote, setRemote] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let live = true;
    const need = local.filter(
      (t) => t.kind === "unknown" || (t.kind === "rack" && t.word.length >= 6),
    );
    if (need.length === 0) {
      setRemote({});
      return;
    }
    const id = window.setTimeout(() => {
      void Promise.all(
        need.map(async (t) => [t.word, await fetchRemoteSuggestions(t.word)] as const),
      ).then((pairs) => {
        if (!live) return;
        const next: Record<string, string[]> = {};
        for (const [w, list] of pairs) next[w] = list;
        setRemote(next);
      });
    }, 180);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [local.map((t) => t.word + t.kind).join("|")]);

  const tokens: SpellToken[] = local.map((t) => {
    const extra = filterRemoteSuggestions(t.word, remote[t.word] ?? [], loaded ?? ({ wordSet: new Set() } as Loaded));
    const suggestions = mergeSuggestions(t.suggestions, extra);
    if (t.kind === "rack" && suggestions.some((s) => isNearSuggestion(t.word, s)) && t.word.length >= 6) {
      return { ...t, kind: "unknown", suggestions };
    }
    if (t.kind === "unknown") return { ...t, suggestions };
    return t;
  });

  const known = tokens.filter((t) => t.kind === "known");

  useEffect(() => {
    const id = window.setTimeout(() => {
      for (const t of known) void defineWord(t.word);
    }, 200);
    return () => window.clearTimeout(id);
  }, [known.map((t) => t.word).join(" ")]);

  if (!raw.trim() || tokens.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <ul className="flex flex-wrap gap-2">
        {tokens.map((t, i) => (
          <TokenChip key={`${t.raw}-${i}`} token={t} />
        ))}
      </ul>
      {tokens.some((t) => t.kind === "unknown") && (
        <div className="space-y-1">
          {tokens
            .filter((t) => t.kind === "unknown")
            .map((t) => (
              <p key={t.word} className="text-xs text-muted">
                <span className="font-mono uppercase text-fg">{t.word}</span>
                {" is not in the word list."}
                {t.suggestions.length > 0 ? " Did you mean " : ""}
                {t.suggestions.map((s, i) => (
                  <span key={s}>
                    {i > 0 ? ", " : ""}
                    <button
                      type="button"
                      className="font-mono uppercase text-fg underline decoration-border underline-offset-2 hover:decoration-muted"
                      onClick={() => onChange(replaceToken(raw, t.raw, s))}
                    >
                      {s}
                    </button>
                  </span>
                ))}
                {t.suggestions.length > 0 ? "?" : ""}
              </p>
            ))}
        </div>
      )}
      {known.length === 1 && tokens.length === 1 && <FirstSense word={known[0].word} />}
    </div>
  );
}

function TokenChip({ token }: { token: SpellToken }) {
  if (token.kind === "skip") {
    return (
      <li className="rounded-sm border border-dashed border-border px-2 py-1 font-mono text-xs uppercase text-subtle">
        {token.raw}
      </li>
    );
  }
  return (
    <li
      className={cn(
        "rounded-sm px-2 py-1",
        token.kind === "known" && "bg-raised",
        token.kind === "unknown" && "bg-raised ring-1 ring-danger/50",
        token.kind === "rack" && "bg-raised",
      )}
    >
      <DefinedWord
        word={token.word}
        className={cn(
          "font-mono text-xs uppercase tracking-wide",
          token.kind === "unknown" && "text-danger",
          token.kind !== "unknown" && "text-fg",
        )}
      />
    </li>
  );
}

function FirstSense({ word }: { word: string }) {
  const [def, setDef] = useState<Definition | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setDef(undefined);
    defineWord(word).then((d) => {
      if (live) setDef(d);
    });
    return () => {
      live = false;
    };
  }, [word]);
  if (!def?.senses[0]) return null;
  const s = def.senses.find((x) => x.pos === "verb") ?? def.senses[0];
  return (
    <p className="text-sm text-muted">
      {s.pos ? <span className="mr-1.5 italic text-subtle">{s.pos}</span> : null}
      {s.text}
    </p>
  );
}
