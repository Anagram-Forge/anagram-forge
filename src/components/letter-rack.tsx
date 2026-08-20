import { cn } from "@/lib/utils";

export function LetterRack({
  letters,
  blanks,
  tone = "tile",
  ghost,
}: {
  letters: string;
  blanks: number;
  tone?: "tile" | "night";
  ghost?: boolean;
}) {
  const tiles = [...letters.toUpperCase(), ...Array.from({ length: blanks }, () => "?")];
  if (tiles.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap justify-center gap-2", ghost && "opacity-40")} aria-label={ghost ? undefined : "Letter rack"} aria-hidden={ghost || undefined}>
      {tiles.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          className={cn(
            "grid place-items-center font-display font-medium tracking-wide",
            tone === "night"
              ? "size-12 rounded-md border border-accent/35 bg-bg/50 text-xl text-fg sm:size-14 sm:text-2xl"
              : "size-10 rounded-sm font-mono text-lg sm:size-11",
            tone !== "night" &&
              (ch === "?"
                ? "border border-dashed border-border bg-raised text-muted"
                : "bg-tile text-tile-ink shadow-[0_1px_0_0_rgba(0,0,0,0.35)]"),
            tone === "night" && ch === "?" && "border-dashed text-muted",
          )}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}
