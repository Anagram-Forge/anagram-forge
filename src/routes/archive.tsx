import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { SupportSlot } from "@/components/support-slot";
import type { Week } from "@/lib/challenge";
import type { Find } from "@/lib/forge-db";

export const Route = createFileRoute("/archive")({ component: ArchivePage });

function ArchivePage() {
  const [two, setTwo] = useState(false);
  const [rows, setRows] = useState<{ challenge: Week & { ended: number }; finds: Find[] }[]>([]);

  useEffect(() => {
    void fetch("/api/forge/archive")
      .then((r) => r.json())
      .then((d: { archive?: { challenge: Week & { ended: number }; finds: Find[] }[] }) => setRows(d.archive || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="min-h-dvh bg-bg">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl text-fg">Archive</h1>
        <p className="mt-2 text-sm text-muted">Finished racks. The current challenge lives on Finds.</p>
        {rows.length === 0 ? (
          <p className="mt-8 text-sm text-subtle">Nothing archived yet. Swap the rack from Steward and the last board lands here.</p>
        ) : (
          rows.map(({ challenge, finds }) => (
            <section key={challenge.id} className="mt-10">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">{challenge.label}</p>
              <p className="mt-1 font-mono text-sm uppercase tracking-wide text-fg">{challenge.rack}</p>
              {challenge.blurb ? <p className="mt-1 text-sm text-muted">{challenge.blurb}</p> : null}
              <Link
                to="/"
                search={{ q: challenge.rack, mode: challenge.mode }}
                className="mt-2 inline-block text-xs text-subtle hover:text-muted"
              >
                Use this rack
              </Link>
              <ol className="mt-4 space-y-1">
                {finds.length === 0 ? (
                  <li className="text-sm text-subtle">No finds kept.</li>
                ) : (
                  finds.map((f, i) => (
                    <li key={f.id} className="font-mono text-sm text-fg">
                      <span className="text-subtle">{i + 1}.</span> {f.phrase}{" "}
                      <span className="font-sans text-[11px] text-subtle">
                        · {f.handle} · updoots {f.votes}
                      </span>
                    </li>
                  ))
                )}
              </ol>
            </section>
          ))
        )}
      </main>
      <div className="mx-auto max-w-5xl px-4">
        <SupportSlot />
      </div>
    </div>
  );
}
