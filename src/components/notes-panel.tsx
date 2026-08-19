import { useEffect } from "react";

export function NotesPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh] sm:pt-[16vh]">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-transparent"
        onClick={onClose}
      />
      <article
        role="dialog"
        aria-labelledby="notes-title"
        className="relative max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-md border border-border bg-surface px-5 py-5 shadow-lg"
      >
        <h2 id="notes-title" className="font-display text-lg text-fg">
          How this place works
        </h2>
        <p className="mt-1 text-sm text-muted">Short, on purpose.</p>

        <section className="mt-5">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Usage</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg">
            Anagram Forge unscrambles letters in your browser. Long racks work your machine, not
            ours. That’s a feature. Use it for puzzles, names, and jokes. Don’t use it to cheat
            people. Absolutely no blaspheming.
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Privacy</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg">
            No account required. We don’t sell data. We don’t keep the words you type.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-fg">
            We store two numbers: visits, and anagrams that returned a result. That’s it. No names,
            no racks, no fingerprints. Forms (sponsor, bugs, screenshots you attach) come to us by
            email. Cloudflare sees traffic the way a host does; when we look, we exclude bots.
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-accent">Ethics</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg">
            The verses and the gold cross are not decoration. They’re an invitation: turn from your
            sin and come to Christ. Ads, if any, stay asked-for. Be decent.
          </p>
        </section>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 text-xs text-subtle hover:text-muted"
        >
          Close
        </button>
      </article>
    </div>
  );
}
