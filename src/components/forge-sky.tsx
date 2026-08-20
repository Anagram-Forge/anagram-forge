import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; a: number; tw: number; cool: boolean };
type Ember = { x: number; y: number; s: number; v: number; drift: number; a: number };
type Node = { x: number; y: number; ch: string };

const LETTERS: Node[] = [
  { x: 0.08, y: 0.16, ch: "A" },
  { x: 0.16, y: 0.09, ch: "N" },
  { x: 0.26, y: 0.14, ch: "A" },
  { x: 0.78, y: 0.11, ch: "F" },
  { x: 0.86, y: 0.18, ch: "O" },
  { x: 0.92, y: 0.1, ch: "R" },
  { x: 0.84, y: 0.28, ch: "G" },
  { x: 0.93, y: 0.32, ch: "E" },
];

const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [4, 6],
  [6, 7],
];

function seed(n: number) {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function ForgeSky() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rnd = seed(1901);
    let stars: Star[] = [];
    let embers: Ember[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let t = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: 70 }, () => ({
        x: rnd(),
        y: rnd(),
        r: 0.4 + rnd() * 1.1,
        a: 0.12 + rnd() * 0.28,
        tw: rnd() * Math.PI * 2,
        cool: rnd() > 0.22,
      }));
      embers = Array.from({ length: 14 }, () => ({
        x: rnd(),
        y: 0.72 + rnd() * 0.28,
        s: 0.7 + rnd() * 1.4,
        v: 0.00004 + rnd() * 0.00008,
        drift: (rnd() - 0.5) * 0.00004,
        a: 0.15 + rnd() * 0.25,
      }));
    }

    function veil() {
      const g = ctx!.createRadialGradient(w * 0.5, h * 0.32, h * 0.08, w * 0.5, h * 0.4, h * 0.85);
      g.addColorStop(0, "rgba(12,11,10,0.82)");
      g.addColorStop(0.45, "rgba(12,11,10,0.55)");
      g.addColorStop(1, "rgba(12,11,10,0.08)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);
    }

    function asterism() {
      ctx!.save();
      ctx!.strokeStyle = "rgba(212,162,76,0.16)";
      ctx!.lineWidth = 1;
      for (const [a, b] of LINKS) {
        ctx!.beginPath();
        ctx!.moveTo(LETTERS[a].x * w, LETTERS[a].y * h);
        ctx!.lineTo(LETTERS[b].x * w, LETTERS[b].y * h);
        ctx!.stroke();
      }
      ctx!.font = "500 11px Fraunces, Georgia, serif";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (const n of LETTERS) {
        ctx!.fillStyle = "rgba(212,162,76,0.08)";
        ctx!.beginPath();
        ctx!.arc(n.x * w, n.y * h, 9, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = "rgba(212,162,76,0.42)";
        ctx!.fillText(n.ch, n.x * w, n.y * h);
      }
      ctx!.restore();
    }

    function draw(moving: boolean) {
      ctx!.fillStyle = "#0c0b0a";
      ctx!.fillRect(0, 0, w, h);
      for (const s of stars) {
        const tw = moving ? 0.5 + 0.5 * Math.sin(t * 0.0004 + s.tw) : 1;
        ctx!.fillStyle = s.cool ? `rgba(186,198,214,${s.a * tw})` : `rgba(212,162,76,${s.a * tw * 0.85})`;
        ctx!.beginPath();
        ctx!.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      asterism();
      for (const e of embers) {
        ctx!.fillStyle = `rgba(212,162,76,${e.a})`;
        ctx!.beginPath();
        ctx!.arc(e.x * w, e.y * h, e.s, 0, Math.PI * 2);
        ctx!.fill();
      }
      veil();
    }

    function tick(now: number) {
      t = now;
      if (document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      for (const e of embers) {
        e.y -= e.v * 16;
        e.x += e.drift * 16;
        e.a *= 0.9985;
        if (e.y < 0.55 || e.a < 0.04) {
          e.x = rnd();
          e.y = 0.88 + rnd() * 0.12;
          e.a = 0.18 + rnd() * 0.22;
        }
      }
      draw(true);
      raf = requestAnimationFrame(tick);
    }

    resize();
    draw(!reduce);
    window.addEventListener("resize", resize);
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
