import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MESSAGE =
  "Turn from your sin and come to Christ. Nothing else in this life outranks that.";

const PANEL = 300;
const TAB = 36;
const HAIR = 2;
const MAX_OFF = PANEL + TAB - HAIR;

type Mode = "tab" | "open" | "hair";

function restOf(mode: Mode) {
  if (mode === "open") return 0;
  if (mode === "hair") return MAX_OFF;
  return PANEL;
}

export function GoldFlag() {
  const [mode, setMode] = useState<Mode>("tab");
  const [top, setTop] = useState<number | null>(null);
  const [off, setOff] = useState(PANEL);
  const [visible, setVisible] = useState(false);
  const startX = useRef<number | null>(null);
  const startOff = useRef(PANEL);
  const dragging = useRef(false);

  useEffect(() => {
    function place() {
      const bar = document.getElementById("verse-banner");
      if (!bar) return;
      const r = bar.getBoundingClientRect();
      setTop(r.top + r.height / 2);
    }
    place();
    const bar = document.getElementById("verse-banner");
    const ro = bar ? new ResizeObserver(place) : null;
    if (bar) ro?.observe(bar);
    window.addEventListener("resize", place);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  useEffect(() => {
    if (top == null) return;
    const id = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, [top]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMode("tab");
      setOff(PANEL);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startOff.current = off;
    dragging.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    const delta = startX.current - e.clientX;
    if (Math.abs(delta) > 6) dragging.current = true;
    if (!dragging.current) return;
    setOff(Math.max(0, Math.min(MAX_OFF, startOff.current - delta)));
  }

  function onPointerUp() {
    if (!dragging.current) {
      const next: Mode = mode === "open" ? "tab" : "open";
      setMode(next);
      setOff(restOf(next));
    } else if (off < PANEL * 0.55) {
      setMode("open");
      setOff(0);
    } else if (off > PANEL + 16) {
      setMode("hair");
      setOff(MAX_OFF);
    } else {
      setMode("tab");
      setOff(PANEL);
    }
    startX.current = null;
    dragging.current = false;
  }

  if (top == null) return null;

  const width = Math.max(HAIR, PANEL + TAB - off);
  const revealed = Math.max(0, PANEL - off);

  return (
    <div
      className="pointer-events-none fixed right-0 z-40 overflow-hidden"
      style={{
        top,
        width,
        transform: "translateY(-50%)",
        opacity: visible ? 1 : 0,
        transition: dragging.current
          ? "none"
          : "opacity 800ms ease, width 220ms ease",
      }}
      aria-live="polite"
    >
      <div
        className={cn("pointer-events-auto flex items-stretch", !dragging.current && "transition-transform duration-200 ease-out")}
        style={{ width: PANEL + TAB, transform: `translateX(${-off}px)` }}
      >
        <aside
          id="gold-flag-panel"
          className="w-[300px] border border-r-0 border-accent/30 bg-surface/95 px-4 py-3"
          style={{ opacity: Math.min(1, revealed / 90) }}
        >
          <p className="font-display text-sm leading-relaxed text-fg">{MESSAGE}</p>
        </aside>
        <button
          type="button"
          aria-expanded={mode === "open"}
          aria-controls="gold-flag-panel"
          aria-label={
            mode === "open" ? "Hide the message" : mode === "hair" ? "Show the gold tab" : "A short message"
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex h-11 w-9 shrink-0 touch-none select-none items-center justify-center bg-transparent font-display text-lg leading-none text-accent hover:bg-accent/5"
        >
          <span aria-hidden>†</span>
        </button>
      </div>
    </div>
  );
}
