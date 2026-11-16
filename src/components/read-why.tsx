import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type Note = { line: string; why: string };
type Turn = { q: string; a: string };

const COST =
  "This asks Grok, which costs money to run. The site doesn’t charge, so each account gets 12 a day.";
const SHUT =
  "You’ve used today’s 12. Each reading costs the site money to run, and the site doesn’t charge, so they open again tomorrow.";

export function ReadWhy({
  known,
  signedIn,
  source,
  kept,
  lines,
}: {
  known: boolean;
  signedIn: boolean;
  source: string;
  kept: string[];
  lines: string[];
}) {
  const [about, setAbout] = useState("");
  const [context, setContext] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [thread, setThread] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  const lineKey = lines.join("\n");

  useEffect(() => {
    setContext("");
    setNotes(null);
    setThread([]);
    setErr(null);
  }, [source, lineKey]);

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    void fetch("/api/forge/read")
      .then((r) => r.json())
      .then((d: { left?: number }) => {
        if (live && typeof d.left === "number") setLeft(d.left);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [signedIn]);

  async function ask() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/forge/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, kept, lines, about }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reason?: string;
        notes?: Note[];
        context?: string;
        left?: number;
      };
      if (!res.ok || !data.ok) {
        if (typeof data.left === "number") setLeft(data.left);
        setErr(data.reason || "The reading didn’t come back.");
        return;
      }
      setNotes(data.notes || []);
      setContext(data.context || "");
      setThread([]);
      if (typeof data.left === "number") setLeft(data.left);
    } catch {
      setErr("The reading didn’t come back.");
    } finally {
      setBusy(false);
    }
  }

  async function follow() {
    const q = question.trim();
    if (!q || !notes) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/forge/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, about, notes, question: q, earlier: thread }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string; reply?: string; left?: number };
      if (!res.ok || !data.ok || !data.reply) {
        if (typeof data.left === "number") setLeft(data.left);
        setErr(data.reason || "The reading didn’t come back.");
        return;
      }
      setThread((cur) => [...cur, { q, a: data.reply as string }]);
      setQuestion("");
      if (typeof data.left === "number") setLeft(data.left);
    } catch {
      setErr("The reading didn’t come back.");
    } finally {
      setBusy(false);
    }
  }

  const shut = left === 0;
  const asked = notes !== null;

  return (
    <section className="mx-auto mt-8 max-w-2xl rounded-xl border border-border/80 bg-surface/50 p-4 sm:p-6">
      <h2 className="font-display text-3xl font-medium tracking-tight text-fg">The reading</h2>
      {shut && !asked ? (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{SHUT}</p>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{COST}</p>
          {!asked ? (
            <>
              <label className="mt-5 block">
                <span className="text-xs font-medium uppercase tracking-wide text-subtle">What is this about?</span>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value.slice(0, 400))}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-fg"
                />
              </label>
              <div className="mt-4">
                {known && signedIn ? (
                  <button
                    type="button"
                    onClick={() => void ask()}
                    disabled={busy || lines.length === 0 || shut}
                    className="h-10 rounded-md bg-primary px-3 text-sm text-primary-fg disabled:opacity-40"
                  >
                    {busy ? "Reading…" : "Ask which lines fit"}
                  </button>
                ) : known ? (
                  <Link
                    to="/enter"
                    className="inline-flex h-10 items-center rounded-md bg-primary px-3 text-sm text-primary-fg"
                  >
                    Create an account to ask
                  </Link>
                ) : null}
                {signedIn && lines.length === 0 ? (
                  <p className="mt-3 text-sm text-subtle">The lines have to be on the page first.</p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              {context ? <p className="mt-5 font-display text-xl text-fg">{context}</p> : null}
              {notes.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Nothing here clearly speaks to the phrase.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {notes.map((note) => (
                    <li key={note.line}>
                      <p className="font-display text-lg text-fg">{note.line}</p>
                      <p className="mt-0.5 text-sm text-muted">{note.why}</p>
                    </li>
                  ))}
                </ul>
              )}
              {thread.map((turn, i) => (
                <div key={`${i}-${turn.q}`} className="mt-4">
                  <p className="text-sm text-fg">{turn.q}</p>
                  <p className="mt-0.5 text-sm text-muted">{turn.a}</p>
                </div>
              ))}
              {shut ? (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{SHUT}</p>
              ) : (
                <form
                  className="mt-5 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void follow();
                  }}
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value.slice(0, 240))}
                    placeholder="Ask a follow-up"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 text-sm text-fg"
                  />
                  <button
                    type="submit"
                    disabled={busy || !question.trim()}
                    className="h-10 rounded-md bg-raised px-3 text-sm text-fg disabled:opacity-40"
                  >
                    {busy ? "…" : "Ask"}
                  </button>
                </form>
              )}
            </>
          )}
          {left !== null && !shut ? <p className="mt-3 text-xs text-subtle">{left} left today</p> : null}
          {err ? <p className="mt-2 text-sm text-muted">{err}</p> : null}
        </>
      )}
    </section>
  );
}
