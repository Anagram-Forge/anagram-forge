import { useEffect, useRef, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/anagram/themes";
import { cn } from "@/lib/utils";

export function ThemePicker({
  theme,
  themeOnly,
  onTheme,
  onThemeOnly,
}: {
  theme: ThemeId | null;
  themeOnly: boolean;
  onTheme: (id: ThemeId | null) => void;
  onThemeOnly: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.id === theme)?.label ?? "Any";

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative mt-5" ref={root}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-sm px-3 text-xs text-muted hover:bg-raised hover:text-fg"
      >
        <span className="uppercase tracking-wide text-subtle">Theme</span>
        <span className={theme ? "text-fg" : ""}>{current}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(100%,22rem)] rounded-md border border-border bg-surface p-3 shadow-lg">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                onTheme(null);
                setOpen(false);
              }}
              className={cn(
                "h-8 rounded-sm px-2.5 text-xs",
                theme === null ? "bg-raised text-fg" : "text-muted hover:text-fg",
              )}
            >
              Any
            </button>
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => {
                  onTheme(theme === t.id ? null : t.id);
                }}
                className={cn(
                  "h-8 rounded-sm px-2.5 text-xs",
                  theme === t.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {theme ? (
            <label className="mt-3 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={themeOnly}
                onChange={(e) => onThemeOnly(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              Only show {current.toLowerCase()} matches
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
