import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark, BookOpen } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useTypeMode } from "@/lib/type-mode";
import { NotesPanel } from "@/components/notes-panel";
import { Tip } from "@/components/tip";
import { VerseBanner } from "@/components/verse-banner";
import { cn } from "@/lib/utils";

export function AppHeader({ onTwoLetter }: { onTwoLetter: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const authOn = import.meta.env.VITE_AUTH_ENABLED === "true";
  const { easy, toggle } = useTypeMode();
  const [notes, setNotes] = useState(false);

  return (
    <div>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <Link to="/">
            <p className="font-display text-lg font-medium tracking-tight text-fg">Anagram Forge</p>
            <p className="hidden text-xs text-muted sm:block">unscramble anything. maybe.</p>
          </Link>
          <button
            type="button"
            onClick={() => setNotes(true)}
            className="mt-0.5 text-[11px] tracking-wide text-subtle hover:text-muted"
          >
            <span className="sm:hidden">notes</span>
            <span className="hidden sm:inline">usage · privacy · ethics</span>
          </button>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/finds"
            className="inline-flex h-11 items-center rounded-md px-2 text-sm text-muted hover:bg-raised hover:text-fg sm:px-3"
          >
            Finds
          </Link>
          <Tip label={easy ? "Default type" : "Easier reading"}>
            <button
              type="button"
              onClick={toggle}
              aria-pressed={easy}
              aria-label={easy ? "Use default type" : "Easier reading type"}
              className={cn(
                "inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm hover:bg-raised",
                easy ? "bg-raised text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span className="font-[family-name:var(--font-easy)] text-[15px] tracking-wide">Aa</span>
            </button>
          </Tip>
          <Tip label="Two-letter words" hideOnSm>
            <button
              type="button"
              onClick={onTwoLetter}
              className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-raised hover:text-fg sm:px-3"
              aria-label="Two-letter words"
            >
              <BookOpen className="size-4" />
              <span className="hidden sm:inline">Two-letter</span>
            </button>
          </Tip>
          {authOn ? (
            <>
              <Link
                to="/saved"
                className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-raised hover:text-fg sm:px-3"
              >
                <Bookmark className="size-4" />
                <span className="hidden sm:inline">Saved</span>
              </Link>
              {isPending ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-raised" />
              ) : user ? (
                <SignedIn>
                  <UserButton />
                </SignedIn>
              ) : (
                <SignedOut>
                  <Link
                    to="/login"
                    className="inline-flex h-11 items-center rounded-md border border-border bg-raised px-3 text-sm text-fg hover:bg-surface"
                  >
                    Sign in
                  </Link>
                </SignedOut>
              )}
            </>
          ) : null}
        </nav>
      </header>
      <VerseBanner />
      {notes ? <NotesPanel onClose={() => setNotes(false)} /> : null}
    </div>
  );
}
