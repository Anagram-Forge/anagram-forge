import { Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { defineWord, fillEtymology, peekDefinition, playPronunciation, type Definition } from "@/lib/anagram/define";
import { keepPing, tapTick } from "@/lib/forge-ring";
import { cn } from "@/lib/utils";

type GrokState =
  | { state: "idle" }
  | { state: "asking" }
  | { state: "error"; reason: string }
  | { state: "done"; pos: string; text: string; real: boolean };

export function DefinedWord({
  word,
  className,
  onSelect,
}: {
  word: string;
  className?: string;
  onSelect?: (word: string) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [def, setDef] = useState<Definition | null | undefined>(undefined);
  const [below, setBelow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [phone, setPhone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hideTimer = useRef<number>(0);
  const showTimer = useRef<number>(0);
  const lastTap = useRef(0);
  const [grok, setGrok] = useState<GrokState>({ state: "idle" });

  useEffect(() => {
    setGrok({ state: "idle" });
  }, [word]);

  async function askGrok() {
    setGrok({ state: "asking" });
    try {
      const res = await fetch("/api/forge/grok-define", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({ word }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
        definition?: { pos: string; text: string; real: boolean };
      };
      if (!res.ok || !data.ok || !data.definition) {
        setGrok({ state: "error", reason: data.reason || "Grok didn’t answer this time. Try again later." });
        return;
      }
      setGrok({ state: "done", ...data.definition });
    } catch {
      setGrok({ state: "error", reason: "Grok didn’t answer this time. Try again later." });
    }
  }

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const cached = peekDefinition(word);
    if (cached !== undefined) setDef(cached);
    else setDef(undefined);
    defineWord(word).then((d) => {
      if (!live) return;
      setDef(d);
      if (d && !d.etymology) {
        void fillEtymology(word).then((etym) => {
          if (live && etym) setDef({ ...d, etymology: etym });
        });
      }
    });
    return () => {
      live = false;
    };
  }, [open, word]);

  useEffect(() => {
    if (!pinned) return;
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setPinned(false);
        conceal();
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [pinned]);

  function reveal() {
    window.clearTimeout(hideTimer.current);
    setMounted(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpen(true));
    });
  }

  function conceal() {
    lastTap.current = 0;
    setOpen(false);
    setPinned(false);
    hideTimer.current = window.setTimeout(() => setMounted(false), 160);
  }

  function clearTimers() {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(showTimer.current);
  }

  function scheduleShow() {
    if (phone) return;
    clearTimers();
    showTimer.current = window.setTimeout(() => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setBelow(top < 240);
      reveal();
    }, 80);
  }

  function scheduleHide() {
    if (pinned || phone) return;
    clearTimers();
    hideTimer.current = window.setTimeout(() => conceal(), 160);
  }

  function stayOpen(e: FocusEvent) {
    const next = e.relatedTarget as Node | null;
    return !!(next && rootRef.current?.contains(next));
  }

  return (
    <span
      ref={rootRef}
      className="relative inline-block"
      onPointerEnter={scheduleShow}
      onPointerLeave={scheduleHide}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={onSelect ? `Keep ${word}` : undefined}
        className={cn(
          "touch-manipulation rounded-sm px-0.5 text-left underline decoration-border decoration-dotted underline-offset-4 hover:decoration-muted",
          className,
        )}
        onClick={() => {
          if (phone) {
            const now = Date.now();
            const again = lastTap.current !== 0 && (now - lastTap.current < 420 || open);
            if (again) {
              lastTap.current = 0;
              setPinned(true);
              reveal();
              if (onSelect) {
                keepPing();
                onSelect(word);
              }
              return;
            }
            lastTap.current = now;
            setPinned(true);
            reveal();
            tapTick();
            return;
          }
          if (onSelect) {
            onSelect(word);
            return;
          }
          setPinned((p) => !p);
          reveal();
        }}
        onFocus={scheduleShow}
        onBlur={(e) => {
          if (stayOpen(e)) return;
          scheduleHide();
        }}
      >
        {word}
      </button>
      {mounted && (
        <span
          id={id}
          role={phone ? "dialog" : "tooltip"}
          aria-label={phone ? `Definition of ${word}` : undefined}
          className={cn(
            "z-40 rounded-md border border-border bg-raised p-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-[opacity,transform] ease-out-soft",
            open ? "translate-y-0 opacity-100 duration-200" : "opacity-0 duration-150",
            phone
              ? "fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] mx-auto w-auto max-w-md"
              : "absolute left-0 w-80 max-w-[min(20rem,calc(100vw-2rem))]",
            !open && (phone ? "translate-y-4" : "translate-y-2"),
            !phone && (below ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]"),
          )}
          onPointerEnter={clearTimers}
          onPointerLeave={scheduleHide}
        >
          <span className="block font-mono text-xs uppercase tracking-wide text-fg">{word}</span>
          {def === undefined && <span className="mt-1 block text-xs text-subtle">Looking up…</span>}
          {def === null && (
            <span className="mt-1 block text-xs text-muted">No definition on file for this word.</span>
          )}
          {def === null && (
            <span className="mt-2 block" aria-live="polite">
              {grok.state === "idle" ? (
                <button
                  type="button"
                  className="rounded-sm border border-border bg-surface px-2.5 py-1 text-xs text-fg hover:bg-raised"
                  onPointerDown={() => setPinned(true)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinned(true);
                    void askGrok();
                  }}
                >
                  Ask Grok
                </button>
              ) : null}
              {grok.state === "asking" ? <span className="block text-xs text-subtle">Asking Grok…</span> : null}
              {grok.state === "error" ? <span className="block text-xs text-subtle">{grok.reason}</span> : null}
              {grok.state === "done" ? (
                <span className="block border-t border-border pt-2">
                  <span className="block text-[10px] uppercase tracking-wide text-subtle">Grok’s answer</span>
                  <span className="mt-1 block text-sm leading-snug text-muted">
                    {grok.pos ? <span className="mr-1.5 text-xs italic text-subtle">{grok.pos}</span> : null}
                    {grok.text}
                  </span>
                </span>
              ) : null}
            </span>
          )}
          {def && (
            <>
              <span className="mt-1 flex items-center gap-2">
                {def.phonetic ? (
                  <span className="text-xs text-subtle">{def.phonetic}</span>
                ) : (
                  <span className="text-xs text-subtle">Pronounce</span>
                )}
                <button
                  type="button"
                  className={cn(
                    "grid size-7 place-items-center rounded-sm hover:bg-surface hover:text-fg",
                    playing ? "text-fg" : "text-muted",
                  )}
                  aria-label={`Play pronunciation of ${word}`}
                  aria-pressed={playing}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPinned(true);
                    setPlaying(true);
                    playPronunciation(word, def.audio);
                    window.setTimeout(() => setPlaying(false), 1600);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Volume2 className="size-3.5" />
                </button>
              </span>
              <ul className="mt-2 space-y-2">
                {def.senses.map((s, i) => (
                  <li key={`${s.pos}-${i}`} className="text-sm leading-snug text-muted">
                    {s.pos ? (
                      <span className="mr-1.5 text-xs italic text-subtle">{s.pos}</span>
                    ) : null}
                    {s.text}
                  </li>
                ))}
              </ul>
              {def.etymology ? (
                <span className="mt-3 block border-t border-border pt-2">
                  <span className="block text-[10px] uppercase tracking-wide text-subtle">Etymology</span>
                  <span className="mt-1 block text-xs leading-snug text-muted">{def.etymology}</span>
                </span>
              ) : null}
              {phone && onSelect ? (
                <span className="mt-3 block text-[10px] uppercase tracking-wide text-subtle">Tap again to keep</span>
              ) : null}
            </>
          )}
        </span>
      )}
    </span>
  );
}
