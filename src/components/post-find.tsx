import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PENDING_FIND, formatFind, matchesChallenge } from "@/lib/challenge";

export function PostFindButton({
  phrase,
  quiet,
}: {
  phrase: string;
  quiet?: boolean;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const formatted = formatFind(phrase);
  if (!formatted || !matchesChallenge(formatted)) return null;

  async function post() {
    setBusy(true);
    try {
      const session = (await (await fetch("/api/forge/session")).json()) as { handle: string | null };
      if (!session.handle) {
        try {
          sessionStorage.setItem(PENDING_FIND, formatted);
        } catch {
          /* ignore */
        }
        void navigate({ to: "/enter" });
        return;
      }
      const res = await fetch("/api/forge/finds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phrase: formatted }),
      });
      const data = (await res.json()) as { ok?: boolean; reason?: string };
      if (!res.ok || !data.ok) {
        toast(data.reason || "Couldn’t post.");
        return;
      }
      toast("Posted to Finds");
      void navigate({ to: "/finds" });
    } finally {
      setBusy(false);
    }
  }

  if (quiet) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => void post()}
        className="shrink-0 text-xs text-subtle hover:text-muted disabled:opacity-40"
      >
        Post
      </button>
    );
  }

  return (
    <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void post()}>
      Post this find
    </Button>
  );
}