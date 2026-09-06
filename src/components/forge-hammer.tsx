import { useCallback, useEffect, useRef, useState } from "react";
import { pingStats } from "@/lib/stats";
import { hitsAnvil, parkedHammerPos, strikePing, warmRing } from "@/lib/forge-ring";

const SIZE = 30;
const COLORS = ["#fff6d0", "#ffe08a", "#ffb347", "#ff6a1a", "#d4a24c", "#ff4500", "#fff"];
const WORDS = ["iron", "sharpens", "iron"] as const;
const RARE = ["crucible", "furnace", "gold"] as const;
const DEMO: Array<"metal" | "iron" | "gold"> = ["metal", "iron", "gold"];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function docSize() {
  return {
    w: Math.max(document.documentElement.scrollWidth, window.innerWidth),
    h: Math.max(document.documentElement.scrollHeight, window.innerHeight),
  };
}

type Bit = {
  kind: "word" | "streak";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  w: number;
  h: number;
  size: number;
  color: string;
  word: string;
};

export function ForgeHammer() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [held, setHeld] = useState(false);
  const [away, setAway] = useState(false);
  const grab = useRef({ dx: 0, dy: 0 });
  const parked = useRef(true);
  const cool = useRef(0);
  const demoStep = useRef(0);
  const el = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bits = useRef<Bit[]>([]);
  const raf = useRef(0);

  useEffect(() => {
    warmRing();
    const place = () => {
      const anvil = document.getElementById("forge-anvil");
      if (anvil) ro.observe(anvil);
      if (!parked.current) return;
      const next = parkedHammerPos();
      if (next) setPos(next);
    };
    const ro = new ResizeObserver(place);
    place();
    ro.observe(document.body);
    window.addEventListener("resize", place);
    window.addEventListener("af-anvil", place);
    const postcard = () => setAway(document.body.classList.contains("af-postcard"));
    postcard();
    const mo = new MutationObserver(postcard);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("af-anvil", place);
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
      const ang = Math.atan2(b.vy, b.vx);
      if (b.kind === "word") {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        ctx.globalAlpha = a;
        ctx.fillStyle = b.color;
        ctx.font = `${b.size}px Fraunces, "Times New Roman", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (a > 0.45) {
          ctx.shadowColor = "#ffe08a";
          ctx.shadowBlur = 5;
        }
        ctx.fillText(b.word, 0, 0);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.w;
        ctx.lineCap = "round";
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
      }
      next.push(b);
    }
    bits.current = next;
    ctx.globalAlpha = 1;
    if (next.length) raf.current = requestAnimationFrame(paint);
    else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  };

  const burst = (x: number, y: number, kind: "metal" | "iron" | "gold" | "live" = "live") => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pushWord = (word: string) => {
      const ang = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 8.5;
      bits.current.push({
        kind: "word",
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 5.2,
        max: 0.85 + Math.random() * 0.7,
        life: 0.85 + Math.random() * 0.7,
        w: 0,
        h: 0,
        size: 8 + Math.random() * 3.5,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        word,
      });
    };
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 13;
      bits.current.push({
        kind: "streak",
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 5.5,
        max: 0.45 + Math.random() * 0.85,
        life: 0.45 + Math.random() * 0.85,
        w: 1 + Math.random() * 2.2,
        h: 8 + Math.random() * 22,
        size: 0,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        word: "",
      });
    }
    if (kind === "iron" || (kind === "live" && Math.random() < 0.28)) {
      for (let i = 0; i < 3; i++) pushWord(WORDS[i % WORDS.length]);
    }
    if (kind === "gold") {
      for (const w of RARE) pushWord(w);
    } else if (kind === "live" && Math.random() < 0.08) {
      pushWord(RARE[(Math.random() * RARE.length) | 0]);
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
    if (hit.demo) {
      const kind = DEMO[demoStep.current % DEMO.length];
      demoStep.current += 1;
      burst(hit.x, hit.y, kind);
    } else {
      void pingStats("strike");
      burst(hit.x, hit.y, "live");
    }
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
      grab.current = { dx: e.clientX + window.scrollX - pos.x, dy: e.clientY + window.scrollY - pos.y };
      parked.current = false;
      setHeld(true);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!held) return;
      const { w, h } = docSize();
      setPos({
        x: clamp(e.clientX + window.scrollX - grab.current.dx, 8, w - SIZE - 8),
        y: clamp(e.clientY + window.scrollY - grab.current.dy, 8, h - SIZE - 8),
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
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-50"
        aria-hidden
        hidden={away}
      />
      {pos && !away ? (
        <button
          ref={el}
          type="button"
          aria-label="Blacksmith hammer. Drag me. Try the anvil."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute z-40 touch-none select-none text-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
