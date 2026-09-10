import { useEffect, useRef } from "react";
import { canSpell, countsOf, normalizeLetters, onlyLetters } from "@/lib/anagram/letters";
import { bone, gold, inks, rgba, sparkCycle } from "@/lib/palette";

type Star = { x: number; y: number; r: number; a: number; tw: number; cool: boolean };
type Ember = { x: number; y: number; s: number; v: number; drift: number; a: number };
type Glyph = { x: number; y: number; ch: string; a: number; want: number; born: number; pulse: number };
type Mote = {
  x: number;
  y: number;
  a: number;
  from: number;
  to: number;
  dir: 1 | -1;
  u: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  dur: number;
  out: boolean;
  home: boolean;
  dim: number;
  trail: { x: number; y: number }[];
};

const SKY_EVENT = "af-sky-letters";
const VERSE_EVENT = "af-verse-theme";
const MAX_GLYPHS = 28;
const FADE_IN_WAIT = 520;
const FADE_STAGGER = 90;
const FADE_K = 0.045;
const TRAIL = 40;
const QUIET = 0.38;
const THEME_WORDS = ["HOPE", "PEACE", "JOY", "LOVE"] as const;

function seed(n: number) {
  let s = n;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const SLOTS = [
  { x: 0.2, y: 0.125 },
  { x: 0.33, y: 0.158 },
  { x: 0.47, y: 0.118 },
  { x: 0.61, y: 0.162 },
  { x: 0.74, y: 0.122 },
  { x: 0.86, y: 0.15 },
  { x: 0.27, y: 0.175 },
  { x: 0.41, y: 0.14 },
  { x: 0.55, y: 0.178 },
  { x: 0.68, y: 0.135 },
  { x: 0.81, y: 0.172 },
  { x: 0.14, y: 0.155 },
];

function slot(i: number) {
  const base = SLOTS[i % SLOTS.length]!;
  const ring = Math.floor(i / SLOTS.length);
  return { x: base.x, y: base.y + ring * 0.07 };
}

function smooth(u: number) {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

function hexRgb(hex: string) {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)] as const;
}

function cycleRgba(now: number, along: number, a: number) {
  const n = sparkCycle.length;
  const x = ((now / 480 + along * 1.1) % n + n) % n;
  const i = Math.floor(x);
  const f = x - i;
  const A = hexRgb(sparkCycle[i]!);
  const B = hexRgb(sparkCycle[(i + 1) % n]!);
  const m = (k: number) => Math.round(A[k] + (B[k] - A[k]) * f);
  return `rgba(${m(0)},${m(1)},${m(2)},${a})`;
}

function dither(i: number, d: number, k: number) {
  const n = Math.sin(i * 127.1 + d * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function setSkyLetters(raw: string, arranged = "") {
  window.dispatchEvent(new CustomEvent(SKY_EVENT, { detail: { raw, arranged } }));
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
    let glyphs: Glyph[] = [];
    let motes: Mote[] = [];
    let nextMote = 0;
    let pool = "";
    let verseTheme = "";
    let last = 0;
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

    function setRack(raw: string, arranged: string) {
      pool = raw;
      const next = onlyLetters(arranged || raw)
        .toUpperCase()
        .slice(0, MAX_GLYPHS);
      const n = Math.max(glyphs.length, next.length);
      const now = performance.now();
      const out: Glyph[] = [];
      for (let i = 0; i < n; i++) {
        const at = slot(i);
        const prev = glyphs[i];
        const ch = next[i];
        const same = Boolean(ch && prev && prev.ch === ch && prev.want === 1);
        out.push({
          x: at.x,
          y: at.y,
          ch: ch || prev?.ch || "",
          a: prev?.a ?? 0,
          want: ch ? 1 : 0,
          born: same ? prev!.born : now + i * FADE_STAGGER,
          pulse: prev?.pulse ?? 0,
        });
      }
      glyphs = out;
      if (reduce) {
        for (const g of glyphs) {
          g.a = g.want;
          g.born = 0;
        }
      }
      if (!next.length) motes = [];
    }

    function pickWord() {
      const { letters, blanks } = normalizeLetters(pool);
      if (!letters && !blanks) return null;
      const have = countsOf(letters);
      const ok = (w: string) => canSpell(countsOf(w.toLowerCase()), have, blanks);
      const prefer = verseTheme.toUpperCase();
      if ((THEME_WORDS as readonly string[]).includes(prefer) && ok(prefer)) return prefer;
      return THEME_WORDS.find(ok) ?? null;
    }

    function path() {
      const word = pickWord();
      if (!word) return [];
      const nodes = glyphs.filter((g) => g.want > 0 && g.a > 0.3 && g.ch);
      const used = new Set<number>();
      const out: Glyph[] = [];
      for (const ch of word) {
        const i = nodes.findIndex((g, k) => !used.has(k) && g.ch === ch);
        if (i < 0) return [];
        used.add(i);
        out.push(nodes[i]!);
      }
      return out;
    }

    function kiss(g: Glyph | undefined) {
      if (g) g.pulse = 0.55;
    }

    function spawnIn(p: Glyph[], at: number, dir: 1 | -1, dim: number, home: boolean) {
      const g = p[at]!;
      const ang = Math.random() * Math.PI * 2;
      const d = 0.14 + Math.random() * 0.12;
      const sx = g.x + Math.cos(ang) * d;
      const sy = g.y + Math.sin(ang) * d;
      motes.push({
        x: sx,
        y: sy,
        a: 0,
        from: -1,
        to: at,
        dir,
        u: 0,
        sx,
        sy,
        tx: g.x,
        ty: g.y,
        dur: 1500 + Math.random() * 420,
        out: false,
        home,
        dim,
        trail: [],
      });
    }

    function aimOut(m: Mote, p: Glyph[]) {
      const here = p[m.to] ?? p[m.dir === 1 ? p.length - 1 : 0];
      if (!here) {
        m.out = true;
        m.u = 1;
        return;
      }
      const prev = p[m.from] ?? here;
      let dx = here.x - prev.x;
      let dy = here.y - prev.y;
      const len = Math.hypot(dx, dy) || 0.08;
      dx /= len;
      dy /= len;
      m.sx = here.x;
      m.sy = here.y;
      m.tx = here.x + dx * 0.16;
      m.ty = here.y + dy * 0.1;
      m.dur = 1380 + Math.random() * 360;
      m.out = true;
      m.u = 0;
      m.from = m.to;
      m.to = -1;
    }

    function aimHop(m: Mote, p: Glyph[], from: number, to: number) {
      const a = p[from];
      const b = p[to];
      if (!a || !b) {
        aimOut(m, p);
        return;
      }
      m.from = from;
      m.to = to;
      m.sx = a.x;
      m.sy = a.y;
      m.tx = b.x;
      m.ty = b.y;
      m.dur = 1280 + Math.random() * 520;
      m.u = 0;
      m.out = false;
    }

    function stepOne(m: Mote, p: Glyph[], dt: number) {
      m.u += dt / m.dur;
      const u = smooth(m.u);
      m.x = m.sx + (m.tx - m.sx) * u;
      m.y = m.sy + (m.ty - m.sy) * u;
      if (m.out) m.a = Math.max(0, 1 - u) * m.dim * QUIET;
      else if (m.from < 0) m.a = Math.min(1, u * 1.15) * m.dim * QUIET;
      else m.a = m.dim * QUIET;
      m.trail.unshift({ x: m.x, y: m.y });
      if (m.trail.length > TRAIL) m.trail.pop();
      if (m.u < 1) return true;
      if (m.out) return false;
      kiss(p[m.to]);
      const end = m.dir === 1 ? p.length - 1 : 0;
      if (m.to === end) {
        aimOut(m, p);
        return true;
      }
      aimHop(m, p, m.to, m.to + m.dir);
      return true;
    }

    function stepMotes(dt: number, now: number) {
      const p = path();
      if (p.length < 2) {
        motes = motes.filter((m) => {
          m.a *= 0.9;
          return m.a > 0.04;
        });
        if (!motes.length) nextMote = now + 1200;
        return;
      }
      const hasLead = motes.some((m) => m.dim > 0.7);
      if (!hasLead && now >= nextMote) spawnIn(p, 0, 1, 1, false);
      const leadBefore = motes.some((m) => m.dim > 0.7);
      motes = motes.filter((m) => stepOne(m, p, dt));
      const leadAfter = motes.some((m) => m.dim > 0.7);
      if (leadBefore && !leadAfter) nextMote = now + 3200 + Math.random() * 2800;
    }

    function drawMote(m: Mote) {
      if (m.a < 0.03) return;
      const tr = m.trail;
      ctx!.save();
      if (tr.length > 1) {
        const hx = (tr[0]!.x - tr[Math.min(4, tr.length - 1)]!.x) * w;
        const hy = (tr[0]!.y - tr[Math.min(4, tr.length - 1)]!.y) * h;
        const hl = Math.hypot(hx, hy) || 1;
        const px = -hy / hl;
        const py = hx / hl;
        for (let i = tr.length - 1; i >= 1; i--) {
          const age = i / (tr.length - 1);
          const p = tr[i]!;
          const dots = 1 + Math.floor(age * 4);
          const spread = 0.7 + age * 4.2 * (m.dim > 0.7 ? 1 : 0.7);
          const alpha = m.a * (1 - age) * (1 - age) * 0.55;
          if (alpha < 0.02) continue;
          ctx!.fillStyle = cycleRgba(t - i * 38, age, alpha);
          for (let d = 0; d < dots; d++) {
            const j = (dither(i, d, 1) - 0.5) * spread;
            const k = (dither(i, d, 2) - 0.5) * spread * 0.55;
            const sz = d === 0 && age < 0.2 ? 2 : 1;
            ctx!.fillRect(p.x * w + px * j + (hx / hl) * k, p.y * h + py * j + (hy / hl) * k, sz, sz);
          }
        }
      }
      ctx!.fillStyle = cycleRgba(t, 0, 0.32 * m.a);
      ctx!.beginPath();
      ctx!.arc(m.x * w, m.y * h, m.dim > 0.7 ? 2.6 : 1.8, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.fillStyle = cycleRgba(t + 80, 0, 0.7 * m.a);
      ctx!.beginPath();
      ctx!.arc(m.x * w, m.y * h, m.dim > 0.7 ? 1.1 : 0.8, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.restore();
    }

    function veil() {
      const g = ctx!.createRadialGradient(w * 0.5, h * 0.32, h * 0.08, w * 0.5, h * 0.4, h * 0.85);
      g.addColorStop(0, rgba(inks.soot, 0.82));
      g.addColorStop(0.45, rgba(inks.soot, 0.55));
      g.addColorStop(1, rgba(inks.soot, 0.08));
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, w, h);
    }

    function typed() {
      const live = glyphs.filter((g) => g.a > 0.02 && g.ch);
      if (!live.length) return;
      const theme = path();
      const onTheme = new Set(theme);
      ctx!.save();
      ctx!.lineWidth = 1;
      ctx!.font = "500 12px Fraunces, Georgia, serif";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      for (let i = 0; i < glyphs.length - 1; i++) {
        const a = glyphs[i];
        const b = glyphs[i + 1];
        if (!a || !b || a.want < 1 || b.want < 1) continue;
        const lineA = Math.min(a.a, b.a);
        if (lineA < 0.02) continue;
        ctx!.strokeStyle = rgba(inks.gold, 0.07 * lineA);
        ctx!.beginPath();
        ctx!.moveTo(a.x * w, a.y * h);
        ctx!.lineTo(b.x * w, b.y * h);
        ctx!.stroke();
      }
      if (theme.length > 1) {
        ctx!.lineWidth = 0.9;
        for (let i = 0; i < theme.length - 1; i++) {
          const a = theme[i]!;
          const b = theme[i + 1]!;
          ctx!.strokeStyle = rgba(inks.gold, 0.16);
          ctx!.beginPath();
          ctx!.moveTo(a.x * w, a.y * h);
          ctx!.lineTo(b.x * w, b.y * h);
          ctx!.stroke();
        }
      }
      for (const n of glyphs) {
        if (n.a < 0.02 || !n.ch) continue;
        const glow = n.pulse;
        const hit = onTheme.has(n);
        const fade = theme.length ? (hit ? 0.72 : 0.28) : 0.55;
        ctx!.fillStyle = rgba(inks.gold, (0.06 * n.a + 0.12 * glow) * fade);
        ctx!.beginPath();
        ctx!.arc(n.x * w, n.y * h, 8 + 4 * glow, 0, Math.PI * 2);
        ctx!.fill();
        if (glow > 0.08) {
          ctx!.fillStyle = rgba(gold.hot, 0.18 * glow);
          ctx!.beginPath();
          ctx!.arc(n.x * w, n.y * h, 4 + 2 * glow, 0, Math.PI * 2);
          ctx!.fill();
        }
        ctx!.fillStyle = rgba(inks.gold, (0.28 * n.a + 0.22 * glow) * fade);
        ctx!.fillText(n.ch, n.x * w, n.y * h);
      }
      ctx!.restore();
    }

    function draw(moving: boolean) {
      ctx!.fillStyle = inks.soot;
      ctx!.fillRect(0, 0, w, h);
      for (const s of stars) {
        const tw = moving ? 0.5 + 0.5 * Math.sin(t * 0.0004 + s.tw) : 1;
        ctx!.fillStyle = s.cool ? rgba(bone.fg, s.a * tw) : rgba(inks.gold, s.a * tw * 0.85);
        ctx!.beginPath();
        ctx!.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      typed();
      for (const e of embers) {
        ctx!.fillStyle = rgba(inks.gold, e.a);
        ctx!.beginPath();
        ctx!.arc(e.x * w, e.y * h, e.s, 0, Math.PI * 2);
        ctx!.fill();
      }
      veil();
      for (const m of motes) drawMote(m);
    }

    function tick(now: number) {
      t = now;
      if (document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = last ? Math.min(40, now - last) : 16;
      last = now;
      const k = FADE_K;
      glyphs = glyphs.filter((g) => {
        const ready = g.want < 1 || now >= g.born + FADE_IN_WAIT;
        if (ready) g.a += (g.want - g.a) * k;
        g.pulse += (0 - g.pulse) * 0.07;
        return g.want > 0 || g.a > 0.01;
      });
      if (!reduce) stepMotes(dt, now);
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

    function onLetters(e: Event) {
      const d = (e as CustomEvent<{ raw?: string; arranged?: string } | string>).detail;
      if (d && typeof d === "object") setRack(String(d.raw || ""), String(d.arranged || ""));
      else setRack(String(d || ""), "");
    }

    function onTheme(e: Event) {
      verseTheme = String((e as CustomEvent<string>).detail || "");
    }

    resize();
    draw(!reduce);
    window.addEventListener("resize", resize);
    window.addEventListener(SKY_EVENT, onLetters);
    window.addEventListener(VERSE_EVENT, onTheme);
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener(SKY_EVENT, onLetters);
      window.removeEventListener(VERSE_EVENT, onTheme);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
