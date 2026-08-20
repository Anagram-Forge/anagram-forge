import { useEffect, useState } from "react";
import { ForgeAnvil } from "@/components/forge-anvil";
import { fetchStats, pingStats, type Stats } from "@/lib/stats";

const VISIT_KEY = "af-visit";

function line(s: Stats) {
  const v = s.visits.toLocaleString();
  const a = s.anagrams.toLocaleString();
  return `${v} visit${s.visits === 1 ? "" : "s"} · ${a} anagram${s.anagrams === 1 ? "" : "s"} forged`;
}

export function SiteStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let live = true;
    const seen = sessionStorage.getItem(VISIT_KEY);
    const run = seen ? fetchStats() : pingStats("visit").then((s) => {
      sessionStorage.setItem(VISIT_KEY, "1");
      return s;
    });
    run.then((s) => {
      if (live && s) setStats(s);
    });
    function onForged(e: Event) {
      const next = (e as CustomEvent<Stats>).detail;
      if (next) setStats(next);
    }
    window.addEventListener("af-stats", onForged);
    return () => {
      live = false;
      window.removeEventListener("af-stats", onForged);
    };
  }, []);

  return (
    <div className="mb-3 flex items-end justify-center gap-2.5">
      {stats ? (
        <p className="text-[11px] tabular-nums tracking-wide text-subtle/80">{line(stats)}</p>
      ) : null}
      <ForgeAnvil />
      <span className="inline-block h-14 w-8" aria-hidden />
    </div>
  );
}
