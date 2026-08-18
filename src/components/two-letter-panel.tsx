import { X } from "lucide-react";
import { TWO_LETTER } from "@/lib/anagram/scores";
import { DefinedWord } from "@/components/defined-word";

export function TwoLetterPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="two-letter-title"
      onClick={onClose}
    >
      <div
        className="max-h-[80dvh] w-full max-w-lg overflow-auto rounded-xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="two-letter-title" className="font-display text-xl text-fg">
              Two-letter words
            </h2>
            <p className="mt-1 text-sm text-muted">Tournament list. Useful leftovers and hooks.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {TWO_LETTER.map((w) => (
            <span
              key={w}
              className="rounded-sm bg-raised px-1 py-1.5 text-center font-mono text-xs uppercase tracking-wide text-fg"
            >
              <DefinedWord word={w} className="font-mono text-xs uppercase tracking-wide text-fg" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
