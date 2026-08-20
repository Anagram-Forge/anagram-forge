import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { SupportSlot } from "@/components/support-slot";
import { listLocalSaves, removeLocalSave, type LocalSave } from "@/lib/local-saves";

export const Route = createFileRoute("/saved")({ component: SavedPage });

function SavedPage() {
  const navigate = useNavigate();
  const [two, setTwo] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<LocalSave[]>([]);

  async function refresh() {
    const res = await fetch("/api/forge/saves");
    const data = (await res.json()) as { saves?: LocalSave[]; signedIn?: boolean };
    if (data.signedIn) {
      setSignedIn(true);
      setRows(data.saves || []);
    } else {
      setSignedIn(false);
      setRows(listLocalSaves());
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function remove(id: string) {
    if (signedIn) {
      await fetch("/api/forge/saves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ remove: id }),
      });
    } else removeLocalSave(id);
    void refresh();
  }

  return (
    <div className="min-h-dvh">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl text-fg">Saved</h1>
        <p className="mt-2 text-sm text-muted">
          {signedIn
            ? "Racks on this handle. Open one to drop it in the forge."
            : "Not signed in. These racks live in this browser — another device, a cleared cache, they’re gone. Sign in to keep them on your handle."}
        </p>
        {!signedIn ? (
          <p className="mt-3 text-xs text-subtle">
            <Link to="/enter" className="hover:text-muted">
              Sign in to keep them
            </Link>
          </p>
        ) : null}
        <ul className="mt-8 space-y-2">
          {rows.length === 0 ? (
            <li className="text-sm text-subtle">Nothing saved yet.</li>
          ) : (
            rows.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() =>
                    void navigate({
                      to: "/",
                      search: { q: s.letters, mode: s.mode as "from-rack" | "exact" | "phrase" },
                    })
                  }
                >
                  <span className="block font-mono text-sm uppercase tracking-wide text-fg">{s.letters}</span>
                  <span className="text-[11px] text-subtle">{s.mode}</span>
                </button>
                <button
                  type="button"
                  className="text-xs text-subtle hover:text-muted"
                  onClick={() => void remove(s.id)}
                >
                  remove
                </button>
              </li>
            ))
          )}
        </ul>
      </main>
      <div className="mx-auto max-w-5xl px-4">
        <SupportSlot />
      </div>
    </div>
  );
}
