import { useCallback, useEffect, useRef, useState } from "react";
import { hitsAnvil, parkedHammerPos, strikePing, warmRing } from "@/lib/forge-ring";

const SIZE = 30;
const COLORS = ["#fff6d0", "#ffe08a", "#ffb347", "#ff6a1a", "#d4a24c", "#ff4500", "#fff"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

type Bit = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  w: number;
  h: number;
  color: string;
};

export function ForgeHammer() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [held, setHeld] = useState(false);
  const grab = useRef({ dx: 0, dy: 0 });
  const parked = useRef(true);
  const cool = useRef(0);
  const el = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bits = useRef<Bit[]>([]);
  const raf = useRef(0);

  useEffect(() => {
    warmRing();
    const place = () => {
      if (!parked.current) {
        setPos((cur) =>
          cur
            ? {
                x: clamp(cur.x, 8, window.innerWidth - SIZE - 8),
                y: clamp(cur.y, 8, window.innerHeight - SIZE - 8),
              }
            : cur,
        );
        return;
      }
      const next = parkedHammerPos();
      if (next) setPos({ x: next.x, y: next.y });
    };
    place();
    const ro = new ResizeObserver(place);
    const anvil = document.getElementById("forge-anvil");
    if (anvil) ro.observe(anvil);
    ro.observe(document.body);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, []);

  const paint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(window.innerWidth * dpr)) {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const next: Bit[] = [];
    for (const b of bits.current) {
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.38;
      b.vx *= 0.99;
      b.life -= 0.016;
      if (b.life <= 0) continue;
      const a = Math.max(0, b.life / b.max);
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w;
      ctx.lineCap = "round";
      const ang = Math.atan2(b.vy, b.vx);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - Math.cos(ang) * b.h, b.y - Math.sin(ang) * b.h);
      ctx.stroke();
      if (a > 0.6 && Math.random() > 0.7) {
        ctx.fillStyle = "#fff6d0";
        ctx.globalAlpha = (a - 0.5) * 0.8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      next.push(b);
    }
    bits.current = next;
    ctx.globalAlpha = 1;
    if (next.length) raf.current = requestAnimationFrame(paint);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };

  const burst = (x: number, y: number) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const n = 70;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 13;
      bits.current.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 5.5,
        max: 0.45 + Math.random() * 0.85,
        life: 0.45 + Math.random() * 0.85,
        w: 1 + Math.random() * 2.2,
        h: 8 + Math.random() * 22,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      });
    }
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(paint);
  };

  const maybeStrike = () => {
    const node = el.current;
    if (!node) return;
    const hit = hitsAnvil(node.getBoundingClientRect());
    if (!hit) return;
    const t = Date.now();
    if (t - cool.current < 700) return;
    cool.current = t;
    strikePing();
    burst(hit.x, hit.y);
    document.getElementById("forge-anvil")?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(3px)" },
        { transform: "translateY(0)" },
      ],
      { duration: 160, easing: "ease-out" },
    );
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!pos) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      grab.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      parked.current = false;
      setHeld(true);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!held) return;
      setPos({
        x: clamp(e.clientX - grab.current.dx, 8, window.innerWidth - SIZE - 8),
        y: clamp(e.clientY - grab.current.dy, 8, window.innerHeight - SIZE - 8),
      });
    },
    [held],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setHeld(false);
    maybeStrike();
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" aria-hidden />
      {pos ? (
        <button
          ref={el}
          type="button"
          aria-label="Blacksmith hammer. Drag me. Try the anvil."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="fixed z-40 touch-none select-none text-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          style={{
            left: pos.x,
            top: pos.y,
            width: SIZE,
            height: SIZE,
            cursor: held ? "grabbing" : "grab",
            transform: held ? "rotate(-48deg) scale(1.08)" : "rotate(-38deg)",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
            transition: held ? "none" : "transform 180ms ease-out",
          }}
        >
          <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
            <path fill="currentColor" d="M3 7h18v8H15v16H9V15H3z" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
