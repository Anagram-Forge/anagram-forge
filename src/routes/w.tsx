import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { MissingPage } from "@/components/missing-page";
import { SupportSlot } from "@/components/support-slot";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { loadDoors } from "@/lib/side-door";

export const Route = createFileRoute("/w")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Anagram Forge" },
    ],
  }),
  component: DoorPage,
});

function DoorPage() {
  const [two, setTwo] = useState(false);
  const [state, setState] = useState<"wait" | "no" | "ok">("wait");
  const [doors, setDoors] = useState<Awaited<ReturnType<typeof loadDoors>>["doors"]>([]);

  useEffect(() => {
    void loadDoors().then((d) => {
      setDoors(d.doors);
      setState(d.ok && d.doors.length ? "ok" : "no");
    });
  }, []);

  if (state === "wait") {
    return (
      <div className="min-h-dvh">
        <AppHeader onTwoLetter={() => setTwo(true)} />
      </div>
    );
  }
  if (state === "no") return <MissingPage />;

  const main = doors[0];
  if (!main) return <MissingPage />;

  return (
    <div className="min-h-dvh">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {doors.map((page) => (
          <section key={page.id} className="mb-12">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Side quests</p>
            <h1 className="mt-2 font-display text-4xl text-fg sm:text-5xl">{page.title}</h1>
            <p className="mt-3 max-w-md text-base text-muted">{page.blurb}</p>
            <ol className="mt-10 space-y-3">
              {page.quests.map((q) => (
                <li
                  key={q.title}
                  className={
                    q.open
                      ? "rounded-md border border-border bg-surface px-4 py-4"
                      : "rounded-md border border-dashed border-border/80 px-4 py-4"
                  }
                >
                  <p
                    className={
                      q.open
                        ? "text-[10px] uppercase tracking-[0.16em] text-accent"
                        : "text-[10px] uppercase tracking-[0.16em] text-subtle"
                    }
                  >
                    {q.kicker}
                  </p>
                  <p className={`mt-1 font-display text-xl ${q.open ? "text-fg" : "text-muted"}`}>{q.title}</p>
                  <p className={`mt-1 text-sm ${q.open ? "text-muted" : "text-subtle"}`}>{q.note}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-md border border-border bg-raised px-4 text-sm text-fg hover:bg-surface"
        >
          Back to the forge
        </Link>
      </main>
      <SupportSlot />
    </div>
  );
}
