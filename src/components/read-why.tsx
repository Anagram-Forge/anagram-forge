import { Link } from "@tanstack/react-router";
import { useState } from "react";

type Note = { line: string; why: string };

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
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);

  async function ask() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/forge/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source, kept, lines }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string; notes?: Note[]; left?: number };
      if (!res.ok || !data.ok) {
        setErr(data.reason || "The reading didn’t come back.");
        return;
      }
      setNotes(data.notes || []);
      if (typeof data.left === "number") setLeft(data.left);
    } catch {
      setErr("The reading didn’t come back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      {known && signedIn ? (
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || lines.length === 0}
          className="text-sm text-muted hover:text-fg disabled:opacity-40"
        >
          {busy ? "Reading…" : "Ask which lines fit"}
        </button>
      ) : known ? (
        <Link to="/enter" className="text-sm text-muted hover:text-fg">
          Sign in to ask which lines fit
        </Link>
      ) : null}
      {left !== null ? <span className="ml-3 text-xs text-subtle">{left} left today</span> : null}
      {err ? <p className="mt-2 text-sm text-muted">{err}</p> : null}
      {notes && notes.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing here clearly speaks to the phrase.</p>
      ) : null}
      {notes && notes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.line}>
              <p className="font-display text-lg text-fg">{note.line}</p>
              <p className="mt-0.5 text-sm text-muted">{note.why}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
