import { useEffect, useState } from "react";
import { VERSES } from "@/lib/verses";

const HOLD_MS = 60_000;
const FADE_MS = 500;

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

  return (
    <div className="border-b border-border/70 bg-surface/40 px-4 py-2 sm:px-6">
      <div className="mx-auto grid max-w-3xl">
        {VERSES.map((v, n) => {
          const current = n === i;
          return (
            <p
              key={`${v.theme}-${v.ref}`}
              aria-hidden={!current}
              className="col-start-1 row-start-1 text-center transition-opacity ease-out"
              style={{
                opacity: current && on ? 1 : 0,
                transitionDuration: `${FADE_MS}ms`,
              }}
            >
              <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.16em] text-accent">
                {v.theme}
              </span>
              <span className="font-display text-[13px] italic text-muted sm:text-sm">“{v.text}”</span>
              <span className="ml-2 text-[11px] text-subtle">{v.ref}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
