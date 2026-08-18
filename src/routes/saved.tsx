import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  deleteSavedQuery,
  listFavorites,
  listSavedQueries,
  toggleFavorite,
  type FavoriteWord,
  type SavedQuery,
} from "@/lib/saved";
import { AppHeader } from "@/components/app-header";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { Button } from "@/components/ui/button";
import { SupportSlot } from "@/components/support-slot";

export const Route = createFileRoute("/saved")({ component: SavedPage });

function SavedPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [two, setTwo] = useState(false);
  const [queries, setQueries] = useState<SavedQuery[] | null>(null);
  const [favs, setFavs] = useState<FavoriteWord[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listSavedQueries()
      .then(setQueries)
      .catch(() => setQueries([]));
    listFavorites()
      .then(setFavs)
      .catch(() => setFavs([]));
  }, [user]);

  if (isPending) {
    return (
      <div className="min-h-dvh bg-bg">
        <div className="h-16 border-b border-border" />
        <div className="mx-auto max-w-3xl p-6 text-sm text-muted">Loading…</div>
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-3xl text-fg">Saved</h1>
        <p className="mt-2 text-sm text-muted">Queries and favorite words on this account.</p>

        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Queries</h2>
          <ul className="mt-3 space-y-2">
            {queries === null && <li className="text-sm text-muted">Loading…</li>}
            {queries?.length === 0 && (
              <li className="rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted">
                No saved searches yet. Run a solve and use Save query.
              </li>
            )}
            {queries?.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() =>
                    navigate({
                      to: "/",
                      search: { q: q.letters, mode: q.mode, pattern: q.pattern, dict: q.dictTier },
                    })
                  }
                >
                  <p className="truncate font-medium text-fg">{q.label}</p>
                  <p className="truncate font-mono text-xs uppercase text-muted">
                    {q.letters} · {q.mode}
                  </p>
                </button>
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
                  aria-label="Delete query"
                  onClick={async () => {
                    await deleteSavedQuery({ data: q.id });
                    setQueries((cur) => cur?.filter((x) => x.id !== q.id) ?? []);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Favorite words</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {favs === null && <p className="text-sm text-muted">Loading…</p>}
            {favs?.length === 0 && <p className="text-sm text-muted">Star a result to keep it here.</p>}
            {favs?.map((f) => (
              <button
                key={f.id}
                type="button"
                className="rounded-sm bg-tile px-2.5 py-1.5 font-mono text-sm uppercase text-tile-ink"
                onClick={async () => {
                  await toggleFavorite({ data: f.word });
                  setFavs((cur) => cur?.filter((x) => x.id !== f.id) ?? []);
                }}
                title="Remove favorite"
              >
                {f.word}
              </button>
            ))}
          </div>
        </section>

        <Button asChild variant="secondary" className="mt-10">
          <Link to="/">Back to solver</Link>
        </Button>
        <SupportSlot />
      </main>
    </div>
  );
}
