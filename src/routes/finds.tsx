import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { WeekCard } from "@/components/week-card";
import { SupportSlot } from "@/components/support-slot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PENDING_FIND, WEEK } from "@/lib/challenge";
import type { Find } from "@/lib/forge-db";

export const Route = createFileRoute("/finds")({ component: FindsPage });

function FindsPage() {
  const [two, setTwo] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [finds, setFinds] = useState<Find[]>([]);
  const [phrase, setPhrase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const [s, f] = await Promise.all([fetch("/api/forge/session"), fetch("/api/forge/finds")]);
    const session = (await s.json()) as { handle: string | null };
    const list = (await f.json()) as { finds: Find[] };
    setHandle(session.handle);
    setFinds(list.finds || []);
  }

  useEffect(() => {
    void (async () => {
      await refresh();
      let pending = "";
      try {
        pending = sessionStorage.getItem(PENDING_FIND) || "";
      } catch {
        pending = "";
      }
      if (!pending) return;
      const session = (await (await fetch("/api/forge/session")).json()) as { handle: string | null };
      if (!session.handle) return;
      try {
        sessionStorage.removeItem(PENDING_FIND);
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/forge/finds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phrase: pending }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string };
      if (!res.ok || !data.ok) setErr(data.reason || "Couldn’t post.");
      else setMsg("Posted.");
      await refresh();
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/forge/finds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phrase }),
    });
    const data = (await res.json()) as { ok?: boolean; reason?: string };
    if (!res.ok || !data.ok) {
      setErr(data.reason || "Couldn’t post.");
      return;
    }
    setPhrase("");
    setMsg("Posted.");
    void refresh();
  }

  async function onVote(id: string) {
    setErr(null);
    const res = await fetch("/api/forge/finds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vote: id }),
    });
    const data = (await res.json()) as { ok?: boolean; reason?: string };
    if (!res.ok || !data.ok) setErr(data.reason || "Couldn’t vote.");
    else void refresh();
  }

  async function onRemove(id: string) {
    setErr(null);
    const res = await fetch("/api/forge/finds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remove: id }),
    });
    const data = (await res.json()) as { ok?: boolean; reason?: string };
    if (!res.ok || !data.ok) setErr(data.reason || "Couldn’t remove.");
    else void refresh();
  }

  async function leave() {
    await fetch("/api/forge/session", { method: "DELETE" });
    void refresh();
  }

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl text-fg">Finds</h1>
        <p className="mt-2 text-sm text-muted">
          Exact anagrams of the rack below. Same phrasing once. Up to five finds per handle.
          Be decent — no blaspheming.
        </p>
        <WeekCard />
        <div className="mt-4 text-xs text-subtle">
          {handle ? (
            <span>
              Signed in as {handle}.{" "}
              <button type="button" className="hover:text-muted" onClick={() => void leave()}>
                Leave
              </button>
            </span>
          ) : (
            <Link to="/enter" className="hover:text-muted">
              Sign in to post or vote
            </Link>
          )}
        </div>

        {handle ? (
          <form onSubmit={submit} className="mt-6">
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-subtle">Your find</span>
              <Input
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={WEEK.rack}
                className="mt-1.5 font-mono"
              />
            </label>
            {err ? <p className="mt-2 text-sm text-danger">{err}</p> : null}
            {msg ? <p className="mt-2 text-sm text-muted">{msg}</p> : null}
            <Button type="submit" className="mt-3">
              Post
            </Button>
          </form>
        ) : err ? (
          <p className="mt-4 text-sm text-danger">{err}</p>
        ) : null}

        <ol className="mt-10 space-y-2">
          {finds.length === 0 ? (
            <li className="text-sm text-subtle">None yet. First decent find sets the tone.</li>
          ) : (
            finds.map((f, i) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <span className="w-6 tabular-nums text-xs text-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 font-mono text-sm tracking-wide text-fg">
                  {f.phrase}
                </span>
                <span className="shrink-0 text-[11px] text-subtle">
                  {f.handle} -{" "}
                  {handle ? (
                    <button
                      type="button"
                      onClick={() => void onVote(f.id)}
                      className="hover:text-muted"
                    >
                      updoots: {f.votes}
                    </button>
                  ) : (
                    <span>updoots: {f.votes}</span>
                  )}
                  {handle && f.handle === handle ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => void onRemove(f.id)}
                        className="hover:text-muted"
                      >
                        remove
                      </button>
                    </>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ol>
      </main>
      <div className="mx-auto max-w-5xl px-4">
        <SupportSlot />
      </div>
    </div>
  );
}
