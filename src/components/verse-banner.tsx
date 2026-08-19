import { useEffect, useState } from "react";
import { VERSES } from "@/lib/verses";

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
      }, 280);
    }, 14000);
    return () => window.clearInterval(id);
  }, []);

  const v = VERSES[i] ?? VERSES[0];

  return (
    <div className="border-b border-border/70 bg-surface/40 px-4 py-2 sm:px-6">
      <p
        className={`mx-auto max-w-3xl text-center transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}
      >
        <span className="mr-2 text-[10px] font-medium uppercase tracking-[0.16em] text-accent">
          {v.theme}
        </span>
        <span className="font-display text-[13px] italic text-muted sm:text-sm">“{v.text}”</span>
        <span className="ml-2 text-[11px] text-subtle">{v.ref}</span>
      </p>
    </div>
  );
}
