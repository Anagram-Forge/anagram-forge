import { Link } from "@tanstack/react-router";
import { WEEK } from "@/lib/challenge";

export function WeekCard() {
  return (
    <aside className="mt-8 rounded-md border border-border/80 bg-surface/60 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">{WEEK.label}</p>
      <p className="mt-1.5 font-display text-sm leading-relaxed text-fg">{WEEK.blurb}</p>
      <p className="mt-2 font-mono text-sm uppercase tracking-wide text-muted">{WEEK.rack}</p>
      <Link
        to="/"
        search={{ q: WEEK.rack, mode: WEEK.mode }}
        className="mt-3 inline-block text-xs text-subtle hover:text-muted"
      >
        Use this rack
      </Link>
    </aside>
  );
}
