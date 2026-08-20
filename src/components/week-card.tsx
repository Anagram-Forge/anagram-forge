import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WEEK, type Week } from "@/lib/challenge";

export function WeekCard() {
  const [week, setWeek] = useState<Week>(WEEK);
  useEffect(() => {
    void fetch("/api/forge/challenge")
      .then((r) => r.json())
      .then((d: { challenge?: Week }) => {
        if (d.challenge?.rack) setWeek(d.challenge);
      })
      .catch(() => {
        /* keep fallback */
      });
  }, []);
  return (
    <aside className="mt-8 rounded-md border border-border/80 bg-surface/60 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">{week.label}</p>
      <p className="mt-1.5 font-display text-sm leading-relaxed text-fg">{week.blurb}</p>
      <p className="mt-2 font-mono text-sm uppercase tracking-wide text-muted">{week.rack}</p>
      <Link
        to="/"
        search={{ q: week.rack, mode: week.mode }}
        className="mt-3 inline-block text-xs text-subtle hover:text-muted"
      >
        Use this rack
      </Link>
    </aside>
  );
}
