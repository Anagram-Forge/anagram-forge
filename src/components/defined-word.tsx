import { Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { defineWord, peekDefinition, playPronunciation, type Definition } from "@/lib/anagram/define";
import { cn } from "@/lib/utils";

export function DefinedWord({
  word,
  className,
}: {
  word: string;
  className?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [def, setDef] = useState<Definition | null | undefined>(undefined);
  const [below, setBelow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const hideTimer = useRef<number>(0);
  const showTimer = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const cached = peekDefinition(word);
    if (cached !== undefined) setDef(cached);
    else setDef(undefined);
    defineWord(word).then((d) => {
      if (live) setDef(d);
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
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [pinned]);

  function clearTimers() {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(showTimer.current);
  }

  function scheduleShow() {
    clearTimers();
    showTimer.current = window.setTimeout(() => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setBelow(top < 240);
      setOpen(true);
    }, 80);
  }

  function scheduleHide() {
    if (pinned) return;
    clearTimers();
    hideTimer.current = window.setTimeout(() => setOpen(false), 160);
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
        className={cn(
          "rounded-sm px-0.5 text-left underline decoration-border decoration-dotted underline-offset-4 hover:decoration-muted",
          className,
        )}
        onClick={() => {
          setPinned((p) => !p);
          setOpen(true);
        }}
        onFocus={scheduleShow}
        onBlur={(e) => {
          if (stayOpen(e)) return;
          scheduleHide();
        }}
      >
        {word}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "absolute left-0 z-30 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-raised p-3 text-left shadow-[0_12px_32px_rgba(0,0,0,0.35)]",
            below ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]",
          )}
          onPointerEnter={clearTimers}
          onPointerLeave={scheduleHide}
        >
          <span className="block font-mono text-xs uppercase tracking-wide text-fg">{word}</span>
          {def === undefined && <span className="mt-1 block text-xs text-subtle">Looking up…</span>}
          {def === null && (
            <span className="mt-1 block text-xs text-muted">No definition on file for this word.</span>
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
            </>
          )}
        </span>
      )}
    </span>
  );
}
