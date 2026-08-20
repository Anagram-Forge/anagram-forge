import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { MissingPage } from "@/components/missing-page";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEEK, type Week } from "@/lib/challenge";
import type { Find } from "@/lib/forge-db";

export const Route = createFileRoute("/steward")({ component: StewardPage });

type Snap = {
  you?: string;
  challenge: Week;
  visits: number;
  anagrams: number;
  handles: { handle: string; created: number; finds: number; lastPosted: number }[];
  finds: Find[];
  reported: Find[];
  bans: { handle: string; created: number }[];
};

function when(n: number) {
  if (!n) return "—";
  return new Date(n).toLocaleString();
}

function StewardPage() {
  const [two, setTwo] = useState(false);
  const [denied, setDenied] = useState(false);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [label, setLabel] = useState(WEEK.label);
  const [blurb, setBlurb] = useState(WEEK.blurb);
  const [rack, setRack] = useState(WEEK.rack);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/forge/steward");
    if (res.status === 404) {
      setDenied(true);
      return;
    }
    const data = (await res.json()) as Snap;
    setSnap(data);
    setLabel(data.challenge.label);
    setBlurb(data.challenge.blurb);
    setRack(data.challenge.rack);
  }

  useEffect(() => {
    void load();
  }, []);

  if (denied) return <MissingPage />;
  if (!snap) {
    return (
      <div className="min-h-dvh bg-bg">
        <AppHeader onTwoLetter={() => setTwo(true)} />
        <p className="p-8 text-sm text-muted">Looking…</p>
      </div>
    );
  }

  async function saveChallenge(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/forge/steward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challenge: { label, blurb, rack } }),
    });
    const data = (await res.json()) as { ok?: boolean; reason?: string };
    if (!res.ok || !data.ok) setMsg(data.reason || "Couldn’t save.");
    else {
      setMsg("Challenge updated.");
      void load();
    }
  }

  async function unban(h: string) {
    await fetch("/api/forge/steward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ unban: h }),
    });
    void load();
  }

  async function removeFind(id: string) {
    await fetch("/api/forge/finds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remove: id }),
    });
    void load();
  }

  async function ban(h: string) {
    await fetch("/api/forge/finds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ban: h }),
    });
    void load();
  }

  async function wipe(h: string) {
    await fetch("/api/forge/steward", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wipe: h }),
    });
    void load();
  }

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl text-fg">Steward</h1>
        <p className="mt-2 text-sm text-muted">Quiet on purpose. Password hashes stay in the dark.</p>
        <p className="mt-4 text-sm tabular-nums text-subtle">
          {snap.visits} visits · {snap.anagrams} anagrams forged · {snap.handles.length} handles · {snap.finds.length} finds
        </p>

        <form onSubmit={saveChallenge} className="mt-10 space-y-3 rounded-md border border-border bg-surface px-4 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Challenge</p>
          <label className="block">
            <span className="text-xs text-subtle">Label</span>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-subtle">Blurb</span>
            <Input value={blurb} onChange={(e) => setBlurb(e.target.value)} className="mt-1" />
          </label>
          <label className="block">
            <span className="text-xs text-subtle">Rack</span>
            <Input value={rack} onChange={(e) => setRack(e.target.value)} className="mt-1 font-mono" />
          </label>
          {msg ? <p className="text-sm text-muted">{msg}</p> : null}
          <Button type="submit">Save challenge</Button>
        </form>

        <section className="mt-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Reported</p>
          {snap.reported.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">None waiting.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {snap.reported.map((f) => (
                <li key={f.id} className="font-mono text-fg">
                  {f.phrase} <span className="text-subtle">· {f.handle}</span>{" "}
                  <button type="button" className="font-sans text-xs text-subtle hover:text-muted" onClick={() => void removeFind(f.id)}>
                    remove
                  </button>
                  {" · "}
                  <button type="button" className="font-sans text-xs text-subtle hover:text-muted" onClick={() => void ban(f.handle)}>
                    ban
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Bans</p>
          {snap.bans.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Nobody.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {snap.bans.map((b) => (
                <li key={b.handle} className="text-fg">
                  {b.handle}{" "}
                  <button type="button" className="text-xs text-subtle hover:text-muted" onClick={() => void unban(b.handle)}>
                    unban
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Handles</p>
          <ul className="mt-2 space-y-1 text-sm">
            {snap.handles.length === 0 ? (
              <li className="text-subtle">None yet.</li>
            ) : (
              snap.handles.map((h) => (
                <li key={h.handle} className="text-fg">
                  {h.handle}{" "}
                  <span className="text-subtle">
                    · {h.finds} find{h.finds === 1 ? "" : "s"} · last {when(h.lastPosted)} · joined {when(h.created)}
                  </span>
                  {h.handle.toLowerCase() === (snap.you || "").toLowerCase() ? null : (
                    <>
                      {" · "}
                      <button type="button" className="text-xs text-subtle hover:text-muted" onClick={() => void ban(h.handle)}>
                        ban
                      </button>
                      {" · "}
                      <button type="button" className="text-xs text-subtle hover:text-muted" onClick={() => void wipe(h.handle)}>
                        wipe
                      </button>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="mt-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Finds on this rack</p>
          <ul className="mt-2 space-y-1 text-sm">
            {snap.finds.length === 0 ? (
              <li className="text-subtle">Empty board.</li>
            ) : (
              snap.finds.map((f) => (
                <li key={f.id} className="font-mono text-fg">
                  {f.phrase}{" "}
                  <span className="font-sans text-subtle">
                    · {f.handle} · updoots {f.votes}{" "}
                    <button type="button" className="text-subtle hover:text-muted" onClick={() => void removeFind(f.id)}>
                      remove
                    </button>
                    {" · "}
                    <button type="button" className="text-subtle hover:text-muted" onClick={() => void ban(f.handle)}>
                      ban
                    </button>
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
