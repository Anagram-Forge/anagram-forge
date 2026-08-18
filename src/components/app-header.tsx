import { Link } from "@tanstack/react-router";
import { Bookmark, BookOpen } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AppHeader({ onTwoLetter }: { onTwoLetter: () => void }) {
  const { user, isPending } = useCurrentUserState();
  const authOn = import.meta.env.VITE_AUTH_ENABLED === "true";

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
      <Link to="/" className="min-w-0">
        <p className="font-display text-lg font-medium tracking-tight text-fg">Anagram Forge</p>
        <p className="hidden text-xs text-muted sm:block">Unscramble anything</p>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onTwoLetter}
          className="inline-flex h-11 items-center gap-2 rounded-md px-2 text-sm text-muted hover:bg-raised hover:text-fg sm:px-3"
        >
          <BookOpen className="size-4" />
          <span className="hidden sm:inline">Two-letter</span>
        </button>
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
  );
}
