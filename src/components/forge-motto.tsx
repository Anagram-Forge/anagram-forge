import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FORGE_MOTTOS } from "@/lib/forge-mottos";

const HOLD_MS = 15_000;
const SHIMMER_MS = 520;
const MOVE_MS = 820;

function keysOf(phrase: string) {
  const seen: Record<string, number> = {};
  return [...phrase].map((ch) => {
    if (ch === " ") {
      seen.sp = (seen.sp || 0) + 1;
      return `sp-${seen.sp}`;
    }
    seen[ch] = (seen[ch] || 0) + 1;
    return `${ch}-${seen[ch]}`;
  });
}

export function ForgeMotto() {
  const [i, setI] = useState(0);
  const [glow, setGlow] = useState(false);
  const row = useRef<HTMLParagraphElement>(null);
  const first = useRef<Map<string, DOMRect>>(new Map());
  const phrase = FORGE_MOTTOS[i];
  const keys = keysOf(phrase);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setInterval(() => {
      if (reduce) {
        setI((n) => (n + 1) % FORGE_MOTTOS.length);
        return;
      }
      const map = new Map<string, DOMRect>();
      row.current?.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => {
        map.set(el.dataset.k || "", el.getBoundingClientRect());
      });
      first.current = map;
      setGlow(true);
      window.setTimeout(() => {
        setI((n) => (n + 1) % FORGE_MOTTOS.length);
      }, SHIMMER_MS);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, []);

  useLayoutEffect(() => {
    if (glow) setGlow(false);
    const prev = first.current;
    if (!prev.size) return;
    row.current?.querySelectorAll<HTMLElement>("[data-k]").forEach((el) => {
      const k = el.dataset.k || "";
      const a = prev.get(k);
      const b = el.getBoundingClientRect();
      if (!a) {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease-out" });
        return;
      }
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, filter: "brightness(1.65)" },
          { transform: "translate(0, 0)", filter: "brightness(1)" },
        ],
        { duration: MOVE_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    });
    first.current = new Map();
  }, [i]);

  return (
    <p
      ref={row}
      className="mt-5 flex flex-wrap items-baseline justify-center gap-x-[0.18em] text-[11px] font-medium uppercase tracking-[0.14em] text-accent"
      aria-live="polite"
    >
      <span className="mr-1 text-accent/70">—</span>
      {[...phrase].map((ch, n) =>
        ch === " " ? (
          <span key={keys[n]} data-k={keys[n]} className="inline-block w-[0.45em]" />
        ) : (
          <span
            key={keys[n]}
            data-k={keys[n]}
            className={glow ? "inline-block animate-[motto-shimmer_0.52s_ease-in-out]" : "inline-block"}
          >
            {ch}
          </span>
        ),
      )}
      <span className="ml-1 text-accent/70">—</span>
    </p>
  );
}
