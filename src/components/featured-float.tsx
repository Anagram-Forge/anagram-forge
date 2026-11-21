import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import type { CipherSettings } from "@/lib/featured-png";

export type FloatFeatured = { id: string; caption: string; w: number; h: number; settings?: CipherSettings };
type LiveProps = { settings: CipherSettings; size: number; running: boolean; onReady: () => void; onFail: () => void };
type Pos = { x: number; y: number };

/** Things the floater must never sit on top of once it's let go. */
const KEEP_CLEAR =
  'input, textarea, select, [contenteditable="true"], #forge-anvil, button[aria-label^="Blacksmith hammer"]';

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function docSize() {
  return {
    w: Math.max(document.documentElement.scrollWidth, window.innerWidth),
    h: Math.max(document.documentElement.scrollHeight, window.innerHeight),
  };
}

function sizeFor(width: number) {
  return width < 640 ? 150 : 200;
}

function lessMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Slide a dropped floater off any search box, the hammer, or the anvil. */
function clearOf(p: Pos, size: number, self: Element | null): Pos {
  const { w, h } = docSize();
  const x = p.x;
  let y = p.y;
  for (let pass = 0; pass < 6; pass++) {
    const hits = [...document.querySelectorAll(KEEP_CLEAR)]
      .filter((el) => !self?.contains(el))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ l: r.left + window.scrollX, t: r.top + window.scrollY, r: r.right + window.scrollX, b: r.bottom + window.scrollY }))
      .filter((r) => x < r.r && x + size > r.l && y < r.b && y + size > r.t);
    if (!hits.length) break;
    const below = Math.max(...hits.map((r) => r.b)) + 8;
    const above = Math.min(...hits.map((r) => r.t)) - size - 8;
    y = below + size <= h - 8 ? below : above >= 8 ? above : y;
    if (y === p.y && pass > 0) break;
  }
  return { x: clamp(x, 8, w - size - 8), y: clamp(y, 8, h - size - 8) };
}

/**
 * The steward's featured cipher, floating over the page like the hammer:
 * drag it anywhere, it drops where let go, Escape or a resize sends it home.
 * No card, no link, no stats, never touches the anvil.
 */
export function FeaturedFloat({ featured: f }: { featured: FloatFeatured | null }) {
  const [size, setSize] = useState(200);
  const [pos, setPos] = useState<Pos | null>(null);
  const [parked, setParked] = useState(true);
  const [held, setHeld] = useState(false);
  const [calm, setCalm] = useState(false);
  const [seen, setSeen] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [Live, setLive] = useState<ComponentType<LiveProps> | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLButtonElement>(null);
  const grab = useRef({ dx: 0, dy: 0 });
  const parkedRef = useRef(true);
  const lastWidth = useRef(0);

  useEffect(() => {
    setCalm(lessMotion());
  }, []);

  const home = useCallback(() => {
    const d = dock.current;
    if (!d) return;
    const s = sizeFor(window.innerWidth);
    const r = d.getBoundingClientRect();
    setSize(s);
    setPos({ x: r.left + window.scrollX + (r.width - s) / 2, y: r.top + window.scrollY });
    parkedRef.current = true;
    setParked(true);
  }, []);

  useEffect(() => {
    if (!f) return;
    lastWidth.current = window.innerWidth;
    home();
    const onResize = () => {
      // Width changes send it home. Phone toolbars changing height don't.
      if (window.innerWidth !== lastWidth.current) {
        lastWidth.current = window.innerWidth;
        home();
      } else if (parkedRef.current) home();
    };
    const ro = new ResizeObserver(() => {
      if (parkedRef.current) home();
    });
    ro.observe(document.body);
    window.addEventListener("resize", onResize);
    const vis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [f, home]);

  const hasPos = pos !== null;
  // Watch the floater itself: load the renderer the first time it shows, pause it when it doesn't.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries.some((e) => e.isIntersecting);
        setOnScreen(on);
        if (on) setSeen(true);
      },
      { rootMargin: "120px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasPos]);

  useEffect(() => {
    if (!seen || calm || !f?.settings || Live || liveFailed) return;
    import("@/components/featured-cipher-live")
      .then((m) => setLive(() => m.FeaturedCipherLive))
      .catch(() => setLiveFailed(true));
  }, [seen, calm, f, Live, liveFailed]);

  const settle = useCallback(
    (p: Pos) => {
      setPos(clearOf(p, size, el.current));
    },
    [size],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { dx: e.clientX + window.scrollX - pos.x, dy: e.clientY + window.scrollY - pos.y };
    setHeld(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!held) return;
    const { w, h } = docSize();
    if (parkedRef.current) {
      parkedRef.current = false;
      setParked(false);
    }
    setPos({
      x: clamp(e.clientX + window.scrollX - grab.current.dx, 8, w - size - 8),
      y: clamp(e.clientY + window.scrollY - grab.current.dy, 8, h - size - 8),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!held) return;
    setHeld(false);
    if (!parkedRef.current && pos) settle(pos);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      home();
      return;
    }
    const step = e.shiftKey ? 64 : 16;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = d[e.key];
    if (!m || !pos) return;
    e.preventDefault();
    parkedRef.current = false;
    setParked(false);
    settle({ x: pos.x + m[0], y: pos.y + m[1] });
  };

  if (!f) return null;
  const poster = `/api/forge/featured-image?id=${encodeURIComponent(f.id)}`;
  const showLive = !!Live && !!f.settings && !calm && !liveFailed;

  return (
    <>
      {/* The parked spot, in the page flow. */}
      <div ref={dock} aria-hidden className="mx-auto mt-4" style={{ width: size, height: size + 28 }} />
      {pos
        ? createPortal(
            <button
              ref={el}
              type="button"
              aria-label={`${f.caption}. Featured cipher. Drag to move it, arrow keys nudge it, Escape sends it home.`}
              title={parked ? undefined : f.caption}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
              className="absolute z-30 touch-none select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              style={{
                left: pos.x,
                top: pos.y,
                width: size,
                cursor: held ? "grabbing" : "grab",
                filter: held ? "drop-shadow(0 8px 18px rgba(0,0,0,0.55))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
                transition: held || calm ? "none" : "left 220ms ease-out, top 220ms ease-out, filter 150ms ease-out",
              }}
            >
              <span className="relative block" style={{ width: size, height: size }}>
                <img
                  src={poster}
                  alt={f.caption}
                  width={size}
                  height={size}
                  draggable={false}
                  decoding="async"
                  className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
                  style={{ opacity: showLive && liveReady ? 0 : 1 }}
                />
                {showLive && Live ? (
                  <span className="absolute inset-0">
                    <Live
                      settings={f.settings as CipherSettings}
                      size={size}
                      running={onScreen && !tabHidden}
                      onReady={() => setLiveReady(true)}
                      onFail={() => setLiveFailed(true)}
                    />
                  </span>
                ) : null}
              </span>
              {parked ? (
                <span className="pointer-events-none mt-1 block truncate text-center text-xs text-subtle">{f.caption}</span>
              ) : null}
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
