import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SupportSlot } from "@/components/support-slot";

export const Route = createFileRoute("/enter")({ component: EnterPage });

function EnterPage() {
  const navigate = useNavigate();
  const [two, setTwo] = useState(false);
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipePass, setWipePass] = useState("");
  const [wipeErr, setWipeErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem("af-handle");
      if (last) setHandle(last);
    } catch {
      /* private mode */
    }
    void fetch("/api/forge/session")
      .then((r) => r.json())
      .then((d: { handle?: string | null }) => setWho(d.handle || null))
      .catch(() => setWho(null));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/forge/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle, password, action: mode === "up" ? "register" : "login" }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string };
      if (!res.ok || !data.ok) {
        setErr(data.reason || "Couldn't sign in");
        return;
      }
      try {
        localStorage.setItem("af-handle", handle.trim());
      } catch {
        /* private mode */
      }
      void navigate({ to: "/finds" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl text-fg">{mode === "up" ? "Make a handle" : "Enter"}</h1>
        <p className="mt-2 text-sm text-muted">
          For the board and saved racks. Solving stays free. A handle is how a save follows you.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-subtle">Handle</span>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} autoComplete="username" className="mt-1.5" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-subtle">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              maxLength={128}
              className="mt-1.5"
            />
            {mode === "up" ? <span className="mt-1 block text-xs text-subtle">At least 10 characters.</span> : null}
          </label>
          {err ? <p className="text-sm text-danger">{err}</p> : null}
          <Button type="submit" disabled={busy}>
            {mode === "up" ? "Create handle" : "Enter"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-xs text-subtle hover:text-muted"
          onClick={() => {
            setMode(mode === "up" ? "in" : "up");
            setErr(null);
          }}
        >
          {mode === "up" ? "Already have a handle? Enter." : "Need a handle? Create one."}
        </button>
        <p className="mt-8 text-xs text-subtle">
          We store your handle, a hashed password, and what you choose to save or post.{" "}
          <Link to="/" className="hover:text-muted">
            Back to the forge
          </Link>
          .
        </p>
        {who ? (
          <div className="mt-10 border-t border-border pt-6">
            <p className="text-sm text-muted">Signed in as {who}.</p>
            {wipeOpen ? (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWipeErr(null);
                  void (async () => {
                    const res = await fetch("/api/forge/session", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ action: "wipe", password: wipePass }),
                    });
                    const data = (await res.json()) as { ok?: boolean; reason?: string };
                    if (!res.ok || !data.ok) {
                      setWipeErr(data.reason || "Password doesn’t match.");
                      return;
                    }
                    setWho(null);
                    setWipeOpen(false);
                    void navigate({ to: "/" });
                  })();
                }}
              >
                <p className="text-xs text-subtle">This wipes the handle, its saves, finds, and votes.</p>
                <Input
                  type="password"
                  value={wipePass}
                  onChange={(e) => setWipePass(e.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  aria-label="Current password"
                />
                {wipeErr ? <p className="text-sm text-danger">{wipeErr}</p> : null}
                <button type="submit" className="text-xs text-subtle hover:text-danger">
                  Delete my data
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="mt-3 text-xs text-subtle hover:text-danger"
                onClick={() => {
                  setWipeOpen(true);
                  setWipeErr(null);
                }}
              >
                Delete my data
              </button>
            )}
          </div>
        ) : null}
      </main>
      <div className="mx-auto max-w-5xl px-4">
        <SupportSlot />
      </div>
    </div>
  );
}
