import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
        setErr(data.reason || "Couldn’t sign in.");
        return;
      }
      void navigate({ to: "/finds" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-3xl text-fg">{mode === "up" ? "Make a handle" : "Enter"}</h1>
        <p className="mt-2 text-sm text-muted">
          For the board and saved racks. Solving stays free, no account.
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
              className="mt-1.5"
            />
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
          {mode === "up" ? "Already have a handle?" : "Need a handle?"}
        </button>
        <p className="mt-8 text-xs text-subtle">
          We store your handle, a hashed password, and what you choose to save or post.{" "}
          <Link to="/" className="hover:text-muted">
            Back to the forge
          </Link>
          .
        </p>
      </main>
      <div className="mx-auto max-w-5xl px-4">
        <SupportSlot />
      </div>
    </div>
  );
}
