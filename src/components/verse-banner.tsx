import { useEffect, useState } from "react";
import { VERSES, type Verse } from "@/lib/verses";

const HOLD_MS = 60_000;
const FADE_MS = 500;

function Line({ v }: { v: Verse }) {
  return (
    <>
      <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.16em] text-accent">
        {v.theme}
      </span>
      <span className="font-display text-[13px] italic text-muted sm:text-sm">“{v.text}”</span>
      <span className="ml-2 text-[11px] text-subtle">{v.ref}</span>
    </>
  );
}

export function VerseBanner() {
  const [i, setI] = useState(() => Math.floor(Math.random() * VERSES.length));
  const [on, setOn] = useState(true);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setOn(false);
      window.setTimeout(() => {
        setI((n) => (n + 1) % VERSES.length);
        setOn(true);
      }, FADE_MS);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, []);

  const current = VERSES[i] ?? VERSES[0];

  return (
    <div className="border-b border-border/70 bg-surface/40 px-4 py-2 sm:px-6">
      <div className="mx-auto grid max-w-3xl">
        {VERSES.map((v) => (
          <p
            key={`${v.theme}-${v.ref}`}
            aria-hidden
            className="invisible col-start-1 row-start-1 text-center"
          >
            <Line v={v} />
          </p>
        ))}
        <p
          className="col-start-1 row-start-1 text-center transition-opacity ease-out"
          style={{ opacity: on ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          <Line v={current} />
        </p>
      </div>
    </div>
  );
}
