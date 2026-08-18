import { ChevronLeft, ChevronRight, Download, ImageIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CARD_FONTS,
  DEFAULT_CARD_STYLE,
  INK_SWATCHES,
  PAPER_SWATCHES,
  PATH_SWATCHES,
  displayRack,
  nearestWeight,
  renderAnagramCard,
  type CardStyle,
} from "@/lib/anagram/poster";
import { cn } from "@/lib/utils";

export function PickChips({
  picks,
  onReorder,
  onRemove,
}: {
  picks: string[];
  onReorder: (next: string[]) => void;
  onRemove: (index: number) => void;
}) {
  const [from, setFrom] = useState<number | null>(null);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= picks.length) return;
    const next = picks.slice();
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    onReorder(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {picks.map((w, i) => (
        <span
          key={`${w}-${i}`}
          draggable
          onDragStart={() => setFrom(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (from === null || from === i) return;
            const next = picks.slice();
            const [item] = next.splice(from, 1);
            next.splice(i, 0, item);
            onReorder(next);
            setFrom(null);
          }}
          className="inline-flex h-10 items-center rounded-sm bg-accent text-accent-fg shadow-[0_1px_0_0_rgba(0,0,0,0.35)]"
        >
          <button
            type="button"
            className="grid size-8 place-items-center text-accent-fg/70 hover:text-accent-fg"
            aria-label={`Move ${w} left`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="cursor-grab select-none font-mono text-sm font-medium uppercase tracking-wide">
            {w}
          </span>
          <button
            type="button"
            className="grid size-8 place-items-center text-accent-fg/70 hover:text-accent-fg"
            aria-label={`Remove ${w}`}
            onClick={() => onRemove(i)}
          >
            <X className="size-3.5" />
          </button>
          <button
            type="button"
            className="grid size-8 place-items-center text-accent-fg/70 hover:text-accent-fg"
            aria-label={`Move ${w} right`}
            disabled={i === picks.length - 1}
            onClick={() => move(i, 1)}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

const WEIGHTS: { value: CardStyle["weight"]; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 900, label: "Black" },
];

export function AnagramCardButton({
  source,
  picks,
  leftoverAdds = [],
  filled,
  onReorder,
  onAdd,
  onRemove,
}: {
  source: string;
  picks: string[];
  leftoverAdds?: string[];
  filled: boolean;
  onReorder: (next: string[]) => void;
  onAdd?: (word: string) => void;
  onRemove: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<CardStyle>(DEFAULT_CARD_STYLE);
  const from = displayRack(source);
  const to = picks.join(" ");
  const face = CARD_FONTS.find((f) => f.id === style.font) ?? CARD_FONTS[0];

  useEffect(() => {
    if (!open) return;
    let live = true;
    setBusy(true);
    renderAnagramCard(from, to, style)
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) toast("Could not draw the card");
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [open, from, to, style]);

  function patch(next: Partial<CardStyle>) {
    setStyle((cur) => {
      const merged = { ...cur, ...next };
      if (next.font) {
        const spec = CARD_FONTS.find((f) => f.id === next.font) ?? CARD_FONTS[0];
        merged.weight = nearestWeight(next.font, merged.weight);
        if (merged.italic && !spec.italic) merged.italic = false;
      }
      return merged;
    });
  }

  function download() {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `${slug(from)}-anagram.png`;
    a.click();
    toast("Card saved");
  }

  if (picks.length < 1) return null;

  return (
    <>
      <Button type="button" variant={filled ? "default" : "secondary"} size="sm" onClick={() => setOpen(true)}>
        <ImageIcon /> Make card
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg text-fg">Anagram card</p>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-sm text-muted hover:text-fg"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-subtle">Rearrange the chips, then tune the type.</p>
            <div className="mt-3">
              <PickChips picks={picks} onReorder={onReorder} onRemove={onRemove} />
            </div>
            {leftoverAdds.length > 0 && onAdd ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-subtle">Leftover</span>
                {leftoverAdds.slice(0, 20).map((w, i) => (
                  <button
                    key={`${w}-${i}`}
                    type="button"
                    onClick={() => onAdd(w)}
                    className="inline-flex h-9 items-center rounded-sm border border-dashed border-accent/60 px-2.5 font-mono text-xs uppercase tracking-wide text-accent hover:bg-accent hover:text-accent-fg"
                  >
                    + {w}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs text-subtle">Font</span>
                <select
                  value={style.font}
                  onChange={(e) => patch({ font: e.target.value as CardStyle["font"] })}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-raised px-2 text-sm text-fg"
                >
                  {CARD_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-subtle">Weight</span>
                <select
                  value={style.weight}
                  onChange={(e) => patch({ weight: Number(e.target.value) as CardStyle["weight"] })}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-raised px-2 text-sm text-fg"
                >
                  {WEIGHTS.filter((w) => face.weights.includes(w.value)).map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-subtle">Size · {style.size}px</span>
                <input
                  type="range"
                  min={48}
                  max={140}
                  value={style.size}
                  onChange={(e) => patch({ size: Number(e.target.value) })}
                  className="mt-2 w-full accent-accent"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-subtle">Tracking · {style.tracking}px</span>
                <input
                  type="range"
                  min={-4}
                  max={18}
                  value={style.tracking}
                  onChange={(e) => patch({ tracking: Number(e.target.value) })}
                  className="mt-2 w-full accent-accent"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch({ italic: !style.italic })}
                  disabled={!face.italic}
                  className={cn(
                    "h-9 rounded-sm px-3 text-xs",
                    style.italic ? "bg-raised text-fg" : "text-muted hover:text-fg",
                    !face.italic && "opacity-40",
                  )}
                >
                  Italic
                </button>
                <button
                  type="button"
                  onClick={() => patch({ uppercase: !style.uppercase })}
                  className={cn(
                    "h-9 rounded-sm px-3 text-xs",
                    style.uppercase ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  All caps
                </button>
                <button
                  type="button"
                  onClick={() => patch({ paths: !style.paths })}
                  className={cn(
                    "h-9 rounded-sm px-3 text-xs",
                    style.paths ? "bg-raised text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  Letter paths
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Swatches
                  label="Ink"
                  value={style.ink}
                  options={INK_SWATCHES}
                  onChange={(ink) => patch({ ink })}
                />
                <Swatches
                  label="Paper"
                  value={style.paper}
                  options={PAPER_SWATCHES}
                  onChange={(paper) => patch({ paper })}
                />
                {style.paths && (
                  <Swatches
                    label="Paths"
                    value={style.path}
                    options={PATH_SWATCHES}
                    onChange={(path) => patch({ path })}
                  />
                )}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-border" style={{ background: style.paper }}>
              {src ? (
                <img src={src} alt={`${from} becomes ${to}`} className="block w-full" />
              ) : (
                <div className="grid h-52 place-items-center text-sm text-muted">
                  {busy ? "Drawing…" : "Preview"}
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={download} disabled={!src}>
                <Download /> Download PNG
              </Button>
              <Button type="button" variant="secondary" onClick={() => setStyle(DEFAULT_CARD_STYLE)}>
                Reset type
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Swatches({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-subtle">{label}</p>
      <div className="flex items-center gap-1.5">
        {options.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            onClick={() => onChange(c)}
            className={cn(
              "size-7 rounded-sm border",
              value === c ? "border-fg" : "border-border",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "anagram"
  );
}
