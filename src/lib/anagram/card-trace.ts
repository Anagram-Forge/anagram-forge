import { bone, rgba, soot } from "@/lib/palette";
import { POSTCARD, type CardPath, type PostcardLook } from "@/lib/anagram/poster";

/** The postcard spark. Every path leaves together; longer crossings take longer. */

const HOLD = 560;
const FADE = 320;
const QUIET = 380;
const TRAIL = 18;

type RGB = [number, number, number];

type Flight = { start: number; hop: number; arrive: number };

function schedule(segs: CardPath[]) {
  const n = segs.length;
  if (!n) return { flights: [] as Flight[], fadeAt: 0, fade: FADE, span: HOLD + QUIET };
  let minL = Infinity;
  let maxL = 0;
  const lens = segs.map((s) => {
    const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    if (len < minL) minL = len;
    if (len > maxL) maxL = len;
    return len;
  });
  const order = segs
    .map((_, i) => i)
    .sort((a, b) => segs[a]!.x0 - segs[b]!.x0 || segs[a]!.y0 - segs[b]!.y0);
  const rank = new Array<number>(n);
  order.forEach((idx, i) => {
    rank[idx] = i;
  });
  const stagger = n > 16 ? 22 : 34;
  const flights = segs.map((_, i) => {
    const u = maxL - minL < 12 ? 0.45 : (lens[i]! - minL) / (maxL - minL);
    const hop = 400 + u * 640;
    const start = rank[i]! * stagger;
    return { start, hop, arrive: start + hop };
  });
  const settled = flights.reduce((m, f) => Math.max(m, f.arrive), 0);
  return { flights, fadeAt: settled + HOLD, fade: FADE, span: settled + HOLD + FADE + QUIET };
}

export function traceSpan(segs: CardPath[]) {
  return schedule(segs).span;
}

function smooth(u: number) {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

function hexRgb(hex: string): RGB {
  const n = hex.replace("#", "");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function dither(i: number, d: number, k: number) {
  const n = Math.sin(i * 127.1 + d * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

type Hit = {
  x: number;
  y: number;
  a: number;
  u: number;
  dx: number;
  dy: number;
  x0: number;
  y0: number;
  resting: boolean;
};

function traceHits(segs: CardPath[], time: number): Hit[] {
  const { flights, fadeAt, fade, span } = schedule(segs);
  if (!flights.length) return [];
  const t = ((time % span) + span) % span;
  const hits: Hit[] = [];
  for (let i = 0; i < segs.length; i++) {
    const f = flights[i]!;
    const s = segs[i]!;
    if (t < f.start || t >= fadeAt + fade) continue;
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const traveling = t < f.arrive;
    const u = traveling ? smooth((t - f.start) / f.hop) : 1;
    const a = t < fadeAt ? 1 : 1 - (t - fadeAt) / fade;
    hits.push({
      x: s.x0 + dx * u,
      y: s.y0 + dy * u,
      a,
      u,
      dx,
      dy,
      x0: s.x0,
      y0: s.y0,
      resting: !traveling,
    });
  }
  return hits;
}

function lookInk(look: PostcardLook) {
  if (look === "press") return { width: 8, head: 14, core: 5.5, dots: 3, scatter: 6, alpha: 0.92, bite: true };
  if (look === "index") return { width: 2.4, head: 7, core: 2.4, dots: 6, scatter: 14, alpha: 0.62, bite: false };
  return { width: 4.6, head: 12, core: 4.4, dots: 6, scatter: 11, alpha: 0.88, bite: false };
}

/** Draw only the moving ink. Caller owns the plate underneath. Coordinates are card pixels. */
export function paintCardTrace(
  ctx: CanvasRenderingContext2D,
  segs: CardPath[],
  time: number,
  color: string,
  look: PostcardLook,
  cardW: number,
  cardH: number,
  viewW: number,
  viewH: number,
) {
  const hits = traceHits(segs, time);
  if (!hits.length) return;
  const ink = lookInk(look);
  const sx = viewW / cardW;
  const sy = viewH / cardH;
  const core = mix(hexRgb(color), hexRgb(bone.fg), look === "press" ? 0.28 : 0.62);

  ctx.save();
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const hit of hits) {
    if (hit.a < 0.04) continue;
    const len = Math.hypot(hit.dx, hit.dy) || 1;
    const ux = hit.dx / len;
    const uy = hit.dy / len;
    const px = -uy;
    const py = ux;
    ctx.globalAlpha = hit.a;

    if (ink.bite) {
      ctx.strokeStyle = rgba(soot.surface, 0.28);
      ctx.lineWidth = ink.width + 3;
      ctx.beginPath();
      ctx.moveTo(hit.x0 + 2, hit.y0 + 2.5);
      ctx.lineTo(hit.x + 2, hit.y + 2.5);
      ctx.stroke();
    }

    ctx.strokeStyle = rgba(color, hit.resting ? ink.alpha * 0.72 : ink.alpha);
    ctx.lineWidth = ink.width;
    ctx.beginPath();
    ctx.moveTo(hit.x0, hit.y0);
    ctx.lineTo(hit.x, hit.y);
    ctx.stroke();

    if (!hit.resting) {
      const traveled = hit.u * len;
      for (let i = TRAIL; i >= 1; i--) {
        const age = i / TRAIL;
        const back = age * Math.min(traveled, look === "press" ? 70 : 150);
        if (back < 4) continue;
        const alpha = (1 - age) * (1 - age) * hit.a * (look === "index" ? 0.4 : 0.72);
        if (alpha < 0.03) continue;
        const x = hit.x - ux * back;
        const y = hit.y - uy * back;
        const dots = 1 + Math.floor(age * ink.dots);
        const spread = 1.2 + age * ink.scatter;
        ctx.fillStyle = rgba(color, alpha);
        for (let d = 0; d < dots; d++) {
          const j = (dither(i, d, 1) - 0.5) * spread;
          const k = (dither(i, d, 2) - 0.5) * spread * 0.45;
          const sz = d === 0 && age < 0.3 ? 3.6 : 2.4;
          ctx.fillRect(x + px * j + ux * k, y + py * j + uy * k, sz, sz);
        }
      }
    }

    const head = hit.resting ? ink.head * 0.55 : ink.head;
    const pupil = hit.resting ? ink.core * 0.6 : ink.core;
    ctx.fillStyle = rgba(color, 0.5 * ink.alpha);
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, head, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${core[0]},${core[1]},${core[2]},${0.95 * hit.a})`;
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, pupil, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function inkRamp(hex: string): RGB[] {
  const ink = hexRgb(hex);
  const paper = hexRgb(bone.fg);
  const dark = hexRgb(soot.surface);
  const out: RGB[] = [];
  for (let i = 0; i <= 8; i++) out.push(mix(ink, paper, i / 8));
  for (let i = 1; i <= 4; i++) out.push(mix(ink, dark, i / 5));
  return out;
}

function traceClock(segs: CardPath[]) {
  const clock = schedule(segs);
  return {
    travelEnd: Math.max(0, clock.fadeAt - HOLD),
    fadeAt: clock.fadeAt,
    fadeEnd: clock.fadeAt + clock.fade,
    span: clock.span,
  };
}

/** More frames while the spark is moving. Delays are milliseconds. gifenc stores centiseconds. */
function gifFrames(segs: CardPath[]) {
  const clock = traceClock(segs);
  const frames: { t: number; delay: number }[] = [];
  const travel = clock.travelEnd;
  if (travel > 40) {
    const n = Math.min(36, Math.max(12, Math.round(travel / 50)));
    const delay = Math.max(50, Math.round(travel / n));
    for (let i = 0; i < n; i++) frames.push({ t: (i / n) * travel, delay });
  }
  const hold = clock.fadeAt - travel;
  if (hold > 20) {
    const delay = Math.max(50, Math.round(hold / 2));
    frames.push({ t: travel + hold * 0.35, delay });
    frames.push({ t: clock.fadeAt - 16, delay });
  }
  const fade = clock.fadeEnd - clock.fadeAt;
  if (fade > 20) {
    const n = 6;
    const delay = Math.max(40, Math.round(fade / n));
    for (let i = 1; i <= n; i++) frames.push({ t: clock.fadeAt + (i / n) * fade, delay });
  }
  const quiet = Math.max(0, clock.span - clock.fadeEnd);
  frames.push({ t: Math.max(0, clock.span - 24), delay: Math.max(40, quiet || 400) });
  return frames;
}

function sampleFrame(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  stride: number,
  into: Uint8Array,
  offset: number,
) {
  let p = offset;
  for (let y = 0; y < h; y += stride) {
    for (let x = 0; x < w; x += stride) {
      const i = (y * w + x) * 4;
      into[p++] = data[i] ?? 0;
      into[p++] = data[i + 1] ?? 0;
      into[p++] = data[i + 2] ?? 0;
      into[p++] = 255;
    }
  }
  return p;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("card"));
    img.src = url;
  });
}

export async function encodeCardGif(
  pngUrl: string,
  segs: CardPath[],
  color: string,
  look: PostcardLook,
): Promise<Blob> {
  const img = await loadImage(pngUrl);
  const w = 1200;
  const h = 800;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  const frames = gifFrames(segs);
  const clock = traceClock(segs);
  const sampleAt = [0, clock.travelEnd * 0.45, clock.travelEnd * 0.82, Math.max(0, clock.fadeAt - 20)];
  const stride = 3;
  const cells = Math.ceil(w / stride) * Math.ceil(h / stride);
  const ramp = inkRamp(color);
  const samples = new Uint8Array((cells * sampleAt.length + ramp.length * 24) * 4);
  let filled = 0;
  const paintAt = (t: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img, 0, 0, w, h);
    paintCardTrace(ctx, segs, t, color, look, POSTCARD.w, POSTCARD.h, w, h);
  };
  for (const t of sampleAt) {
    paintAt(t);
    filled = sampleFrame(ctx.getImageData(0, 0, w, h).data, w, h, stride, samples, filled);
  }
  for (const c of ramp) {
    for (let k = 0; k < 24; k++) {
      samples[filled++] = c[0];
      samples[filled++] = c[1];
      samples[filled++] = c[2];
      samples[filled++] = 255;
    }
  }

  const gifenc = await import("gifenc");
  const palette = gifenc.quantize(samples.subarray(0, filled), 255).map(
    (c) => [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0] as RGB,
  );
  const clear = 255;
  const gif = gifenc.GIFEncoder();
  let shown: Uint8Array | null = null;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]!;
    paintAt(frame.t);
    const raw = gifenc.applyPalette(ctx.getImageData(0, 0, w, h).data, palette);
    let index = raw;
    if (shown) {
      index = new Uint8Array(raw.length);
      index.fill(clear);
      for (let p = 0; p < raw.length; p++) {
        if (raw[p] !== shown[p]) index[p] = raw[p]!;
      }
    }
    gif.writeFrame(index, w, h, {
      delay: frame.delay,
      palette: i === 0 ? palette : undefined,
      repeat: i === 0 ? 0 : undefined,
      transparent: i > 0,
      transparentIndex: clear,
      dispose: 1,
    });
    shown = raw;
    if (i % 2 === 1) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  gif.finish();
  const bytes = gif.bytes();
  return new Blob([Uint8Array.from(bytes)], { type: "image/gif" });
}
