import { useEffect, useState } from "react";
import { ForgeAnvil } from "@/components/forge-anvil";
import { fetchStats, pingStats, type Stats } from "@/lib/stats";

const VISIT_KEY = "af-visit";

function bits(s: Stats) {
  const v = `${s.visits.toLocaleString()} visit${s.visits === 1 ? "" : "s"}`;
  const a = `${s.anagrams.toLocaleString()} anagram${s.anagrams === 1 ? "" : "s"} forged`;
  return { v, a };
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

  const { v, a } = stats ? bits(stats) : { v: "", a: "" };

  return (
    <div className="mb-3 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-3">
      {stats ? (
        <p className="text-right text-[11px] tabular-nums tracking-wide text-subtle/80">{v}</p>
      ) : (
        <span />
      )}
      <ForgeAnvil />
      {stats ? (
        <p className="text-left text-[11px] tabular-nums tracking-wide text-subtle/80">{a}</p>
      ) : (
        <span />
      )}
    </div>
  );
}
