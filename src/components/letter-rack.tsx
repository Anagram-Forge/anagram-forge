import { cn } from "@/lib/utils";

export function LetterRack({ letters, blanks }: { letters: string; blanks: number }) {
  const tiles = [...letters.toUpperCase(), ...Array.from({ length: blanks }, () => "?")];
  if (tiles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Letter rack">
      {tiles.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={cn(
            "grid size-10 place-items-center rounded-sm font-mono text-lg font-medium sm:size-11",
            ch === "?"
              ? "border border-dashed border-border bg-raised text-muted"
              : "bg-tile text-tile-ink shadow-[0_1px_0_0_rgba(0,0,0,0.35)]",
          )}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
