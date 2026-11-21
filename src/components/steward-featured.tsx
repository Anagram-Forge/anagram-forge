import { useEffect, useState } from "react";
import { FeaturedFloat, type FloatFeatured } from "@/components/featured-float";
import { Button } from "@/components/ui/button";
import { easternStamp } from "@/lib/featured-png";

type Featured = FloatFeatured & { at: number };

/**
 * Steward-only home for the featured cipher until it goes public. Shows the
 * current render floating (draggable like the hammer), its caption, and a take-down button.
 */
export function StewardFeatured() {
  const [now, setNow] = useState<Featured | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/forge/featured?owner=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { now?: Featured | null } | null) => {
        if (!live) return;
        setNow(d?.now ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      live = false;
    };
  }, []);

  async function takeDown() {
    setBusy(true);
    try {
      const res = await fetch("/api/forge/featured", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (!res.ok || !data.ok) {
        setMsg(data.reason || "Couldn’t.");
        return;
      }
      setNow(null);
      setMsg("Taken down. Go back to earlier render on the cipher page brings it back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-md border border-border bg-surface px-4 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Featured cipher</p>
      <p className="mt-2 text-sm text-muted">
        Only you see it, here, until it goes public.
      </p>
      {loaded && !now ? <p className="mt-3 text-sm text-subtle">Nothing featured.</p> : null}
      {now ? (
        <>
          <p className="mt-3 text-sm text-fg">“{now.caption}”</p>
          <p className="mt-1 text-xs text-subtle">Since {easternStamp(now.at)}</p>
          <FeaturedFloat featured={now} />
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => void takeDown()} disabled={busy}>
            Take it down
          </Button>
        </>
      ) : null}
      <p className="mt-2 min-h-5 text-sm text-subtle" role="status" aria-live="polite">
        {msg}
      </p>
    </section>
  );
}
