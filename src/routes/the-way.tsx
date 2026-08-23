import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { MissingPage } from "@/components/missing-page";
import { SupportSlot } from "@/components/support-slot";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { doorFound } from "@/lib/side-door";

export const Route = createFileRoute("/the-way")({ component: TheWayPage });

function TheWayPage() {
  const [two, setTwo] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOk(doorFound());
  }, []);

  if (ok === null) {
    return (
      <div className="min-h-dvh">
        <AppHeader onTwoLetter={() => setTwo(true)} />
      </div>
    );
  }
  if (!ok) return <MissingPage />;

  return (
    <div className="min-h-dvh">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Side quests</p>
        <h1 className="mt-2 font-display text-4xl text-fg sm:text-5xl">The way</h1>
        <p className="mt-3 max-w-md text-base text-muted">
          You arranged two. More doors later. Quiet on purpose.
        </p>

        <ol className="mt-10 space-y-3">
          <li className="rounded-md border border-border bg-surface px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-accent">Quest 1 · open</p>
            <p className="mt-1 font-display text-xl text-fg">Arrange two</p>
            <p className="mt-1 text-sm text-muted">The gate you just walked through.</p>
          </li>
          <li className="rounded-md border border-dashed border-border/80 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-subtle">Quest 2 · locked</p>
            <p className="mt-1 font-display text-xl text-muted">Iron and fire</p>
            <p className="mt-1 text-sm text-subtle">Not yet. The anvil knows.</p>
          </li>
          <li className="rounded-md border border-dashed border-border/80 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-subtle">Quest 3 · locked</p>
            <p className="mt-1 font-display text-xl text-muted">A still small voice</p>
            <p className="mt-1 text-sm text-subtle">Later.</p>
          </li>
        </ol>

        <Link
          to="/"
          className="mt-10 inline-flex h-11 items-center rounded-md border border-border bg-raised px-4 text-sm text-fg hover:bg-surface"
        >
          Back to the forge
        </Link>
      </main>
      <SupportSlot />
    </div>
  );
}
