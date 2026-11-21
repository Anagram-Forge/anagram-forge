import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { MissingPage } from "@/components/missing-page";
import { TwoLetterPanel } from "@/components/two-letter-panel";
import { loadDoors } from "@/lib/side-door";

/** Loaded only after the server says the door is open, so locked visitors never fetch it. */
const WayCipher = lazy(() => import("@/components/way-cipher"));

export const Route = createFileRoute("/the-way")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: TheWayPage,
});

function TheWayPage() {
  const [two, setTwo] = useState(false);
  const [state, setState] = useState<"wait" | "no" | "ok">("wait");

  useEffect(() => {
    void loadDoors().then((d) => {
      setState(d.ok && d.doors.some((door) => door.id === "way") ? "ok" : "no");
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

  return (
    <div className="min-h-dvh">
      <AppHeader onTwoLetter={() => setTwo(true)} />
      <TwoLetterPanel open={two} onClose={() => setTwo(false)} />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <Suspense fallback={<p className="text-sm text-subtle">Opening…</p>}>
          <WayCipher />
        </Suspense>
        <div className="mt-14 flex flex-wrap gap-3">
          <Link
            to="/w"
            className="inline-flex h-11 items-center rounded-md border border-border bg-raised px-4 text-sm text-fg hover:bg-surface"
          >
            Side quests
          </Link>
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-md border border-border bg-raised px-4 text-sm text-fg hover:bg-surface"
          >
            Back to the forge
          </Link>
        </div>
      </main>
    </div>
  );
}
