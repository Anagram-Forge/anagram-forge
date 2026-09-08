export type CardFontId = "fraunces" | "lexend" | "atkinson";
export type PostcardLook = "vintage" | "index" | "press";
export type DoodleId = "sling" | "stone" | "fall";

export type CardStyle = {
  look: PostcardLook;
  font: CardFontId;
  size: number;
  weight: 400 | 500 | 600 | 700 | 800 | 900;
  italic: boolean;
  uppercase: boolean;
  tracking: number;
  ink: string;
  paper: string;
  paths: boolean;
  path: string;
  doodle: DoodleId;
};

export const POSTCARD_LOOKS: { id: PostcardLook; label: string; note: string }[] = [
  { id: "vintage", label: "Vintage", note: "Valley plate, stamp, sky for type" },
  { id: "index", label: "Index", note: "Ruled card, a quiet doodle" },
  { id: "press", label: "Letterpress", note: "Cotton paper, bite of ink" },
];

export const DOODLES: { id: DoodleId; label: string; note: string }[] = [
  { id: "sling", label: "Sling", note: "The valley. One small, one tall." },
  { id: "stone", label: "Stone", note: "One smooth stone in the air." },
  { id: "fall", label: "Fall", note: "The giant on the ground." },
];

export const CARD_FONTS: {
  id: CardFontId;
  label: string;
  family: string;
  weights: Array<CardStyle["weight"]>;
  italic?: boolean;
  href: string;
  fallback: string;
}[] = [
  {
    id: "fraunces",
    label: "Fraunces",
    family: "Fraunces",
    weights: [500, 600, 700],
    italic: true,
    href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,600&display=swap",
    fallback: "serif",
  },
  {
    id: "lexend",
    label: "Lexend",
    family: "Lexend",
    weights: [400, 500, 600, 700, 800],
    href: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&display=swap",
    fallback: "sans-serif",
  },
  {
    id: "atkinson",
    label: "Atkinson",
    family: "Atkinson Hyperlegible",
    weights: [400, 700],
    italic: true,
    href: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400;1,700&display=swap",
    fallback: "sans-serif",
  },
];

export const LOOK_PRESETS: Record<PostcardLook, Partial<CardStyle>> = {
  vintage: {
    look: "vintage",
    font: "fraunces",
    weight: 700,
    italic: false,
    uppercase: true,
    ink: "#3b1d0f",
    paper: "#e6d5b8",
    path: "#a33b2b",
    doodle: "sling",
  },
  index: {
    look: "index",
    font: "atkinson",
    weight: 700,
    italic: false,
    uppercase: false,
    ink: "#1e3a5f",
    paper: "#f6edd8",
    path: "#b23b2c",
    doodle: "sling",
  },
  press: {
    look: "press",
    font: "fraunces",
    weight: 700,
    italic: false,
    uppercase: true,
    ink: "#1a1714",
    paper: "#f3eee4",
    path: "#c6a15b",
    doodle: "sling",
  },
};

export const DEFAULT_CARD_STYLE: CardStyle = {
  look: "vintage",
  font: "fraunces",
  size: 84,
  weight: 700,
  italic: false,
  uppercase: true,
  tracking: 0,
  ink: "#3b1d0f",
  paper: "#e6d5b8",
  paths: true,
  path: "#a33b2b",
  doodle: "sling",
};

/** 4×6 in landscape at 300 dpi — print at actual size. */
export const POSTCARD = { w: 1800, h: 1200, inchW: 6, inchH: 4, dpi: 300 } as const;

const VINTAGE_PLATES: Partial<Record<DoodleId, string>> = {
  sling: "/postcards/valley-sling.jpg?v=2",
};

/** Center of the circular postmark, as a fraction of the 4×6 plate. */
export const VINTAGE_STAMP = { x: 0.884, y: 0.198 };

const plateCache = new Map<string, HTMLImageElement>();

function loadPlate(src: string): Promise<HTMLImageElement> {
  const hit = plateCache.get(src);
  if (hit?.complete && hit.naturalWidth > 0) return Promise.resolve(hit);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      plateCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error("plate"));
    img.src = src;
  });
}

async function drawVintagePlate(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  doodle: DoodleId,
): Promise<boolean> {
  const src = VINTAGE_PLATES[doodle];
  if (!src) return false;
  try {
    const img = await loadPlate(src);
    ctx.drawImage(img, 0, 0, w, h);
    return true;
  } catch {
    return false;
  }
}

export const PAPER_SWATCHES = ["#e6d5b8", "#f6edd8", "#f3eee4", "#efe6d4", "#111111"];
export const INK_SWATCHES = ["#3b1d0f", "#1e3a5f", "#1a1714", "#6b1d12", "#d4a24c"];
export const PATH_SWATCHES = ["#a33b2b", "#c6a15b", "#f07812", "#1a1714", "#ebe4d6"];

function spec(id: CardFontId) {
  return CARD_FONTS.find((f) => f.id === id) ?? CARD_FONTS[0];
}

function clampWeight(id: CardFontId, weight: CardStyle["weight"]): CardStyle["weight"] {
  const allowed = spec(id).weights;
  if (allowed.includes(weight)) return weight;
  return allowed.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), allowed[0]);
}

function fontCss(style: CardStyle): string {
  const face = spec(style.font);
  const italic = style.italic && face.italic ? "italic " : "";
  const weight = clampWeight(style.font, style.weight);
  return `${italic}${weight} ${style.size}px "${face.family}", ${face.fallback}`;
}

export async function ensureSignatureFont() {
  if (typeof document === "undefined") return;
  const id = "card-font-vibes";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap";
    document.head.appendChild(link);
  }
  try {
    await document.fonts.load('400 64px "Great Vibes"');
    await document.fonts.ready;
  } catch {
    /* fallback */
  }
}

async function ensureFont(style: CardStyle) {
  if (typeof document === "undefined") return;
  const face = spec(style.font);
  const id = `card-font-${face.id}`;
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = face.href;
    document.head.appendChild(link);
  }
  const weight = clampWeight(style.font, style.weight);
  const italic = style.italic && face.italic ? "italic " : "";
  try {
    await document.fonts.load(`${italic}${weight} 80px "${face.family}"`);
    await document.fonts.ready;
  } catch {
    /* fallback */
  }
}

function applyFont(ctx: CanvasRenderingContext2D, style: CardStyle, size: number) {
  ctx.font = fontCss({ ...style, size });
  ctx.letterSpacing = "0px";
}

function measureRun(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += ctx.measureText(text[i]!).width;
    if (i < text.length - 1) w += tracking;
  }
  return w;
}

function fitLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, style: CardStyle): number {
  let size = style.size;
  applyFont(ctx, style, size);
  while (size > 16 && measureRun(ctx, text, style.tracking) > maxWidth) {
    size -= 2;
    applyFont(ctx, style, size);
  }
  return size;
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, tracking: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${cur} ${words[i]}`;
    if (measureRun(ctx, next, tracking) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = words[i];
    }
  }
  lines.push(cur);
  return lines;
}

type Glyph = { ch: string; x: number; y: number };

function drawRun(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
): Glyph[] {
  const total = measureRun(ctx, text, tracking);
  let x = centerX - total / 2;
  const glyphs: Glyph[] = [];
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const ch of text) {
    const w = ctx.measureText(ch).width;
    ctx.fillText(ch, x, y);
    if (/[a-z]/i.test(ch)) glyphs.push({ ch: ch.toLowerCase(), x: x + w / 2, y });
    x += w + tracking;
  }
  return glyphs;
}

function pairGlyphs(top: Glyph[], bot: Glyph[]): Array<[Glyph, Glyph]> {
  const used = new Set<number>();
  const pairs: Array<[Glyph, Glyph]> = [];
  for (const a of top) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < bot.length; i++) {
      if (used.has(i) || bot[i]!.ch !== a.ch) continue;
      const d = Math.abs(bot[i]!.x - a.x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    if (best >= 0) {
      used.add(best);
      pairs.push([a, bot[best]!]);
    }
  }
  return pairs;
}

function drawPaths(
  ctx: CanvasRenderingContext2D,
  pairs: Array<[Glyph, Glyph]>,
  topSize: number,
  botSize: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.6, Math.min(topSize, botSize) * 0.028);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.42;
  ctx.setLineDash([18, 16]);
  for (const [a, b] of pairs) {
    const y0 = a.y + topSize * 0.4;
    const y1 = b.y - botSize * 0.42;
    ctx.beginPath();
    ctx.moveTo(a.x, y0);
    ctx.lineTo(b.x, y1);
    ctx.stroke();
  }
  ctx.restore();
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, n: number, rand: () => number) {
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? `rgba(70,40,16,${a})` : `rgba(255,250,235,${a})`;
    ctx.fillRect(rand() * w, rand() * h, 1.2 + rand() * 1.4, 1.1);
  }
  ctx.restore();
}

function seedOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = Math.imul(a ^ (a >>> 16), 2246822507);
    a = Math.imul(a ^ (a >>> 13), 3266489909);
    return ((a ^= a >>> 16) >>> 0) / 4294967296;
  };
}

function paperStock(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, rand: () => number) {
  grain(ctx, w, h, 7000, rand);
  ctx.save();
  // Laid lines
  ctx.strokeStyle = "rgba(90, 55, 25, 0.045)";
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 7) {
    ctx.beginPath();
    ctx.moveTo(0, y + rand() * 1.4);
    ctx.lineTo(w, y + rand() * 1.4);
    ctx.stroke();
  }
  // Chain lines
  ctx.strokeStyle = "rgba(90, 55, 25, 0.035)";
  for (let x = 40; x < w; x += 92) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 8, h);
    ctx.stroke();
  }
  // Fibers
  ctx.strokeStyle = "rgba(70, 40, 16, 0.07)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + rand() * 28, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }
  // Foxing
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(140, 70, 28, ${0.03 + rand() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, 18 + rand() * 70, 10 + rand() * 36, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void ink;
}

function hairline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, width = 2) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function figure(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, staff?: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, -38, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(0, 8);
  ctx.moveTo(-12, -14);
  ctx.lineTo(12, -8);
  ctx.moveTo(0, 8);
  ctx.lineTo(-10, 32);
  ctx.moveTo(0, 8);
  ctx.lineTo(10, 32);
  ctx.stroke();
  if (staff) {
    ctx.beginPath();
    ctx.moveTo(-16, -48);
    ctx.lineTo(-8, 36);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSling(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(60, 540);
  ctx.quadraticCurveTo(500, 560, 940, 520);
  ctx.stroke();
  figure(ctx, 210, 470, 1.15, true);
  ctx.beginPath();
  ctx.arc(248, 390, 42, -0.2, 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(232, 430);
  ctx.quadraticCurveTo(270, 360, 286, 392);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(292, 388, 7, 5, 0.4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(720, 250);
  ctx.beginPath();
  ctx.arc(0, -90, 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-48, -78);
  ctx.quadraticCurveTo(0, -128, 48, -78);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(0, 140);
  ctx.moveTo(-70, 10);
  ctx.lineTo(70, 24);
  ctx.moveTo(-28, 140);
  ctx.lineTo(-40, 250);
  ctx.moveTo(28, 140);
  ctx.lineTo(48, 250);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-78, 40, 38, 52, -0.2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(70, -160);
  ctx.lineTo(78, 250);
  ctx.stroke();
  ctx.restore();
}

function drawStone(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(780, 210);
  ctx.beginPath();
  ctx.arc(0, 0, 86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-70, -20);
  ctx.quadraticCurveTo(0, -78, 70, -16);
  ctx.moveTo(-30, 10);
  ctx.lineTo(-18, 28);
  ctx.moveTo(18, 12);
  ctx.lineTo(30, 28);
  ctx.moveTo(-22, 48);
  ctx.quadraticCurveTo(0, 62, 22, 48);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(430, 340, 16, 12, -0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(390, 352);
  ctx.lineTo(318, 378);
  ctx.moveTo(396, 330);
  ctx.lineTo(330, 348);
  ctx.moveTo(410, 318);
  ctx.lineTo(352, 300);
  ctx.stroke();
  figure(ctx, 180, 500, 0.95, true);
  ctx.beginPath();
  ctx.moveTo(198, 448);
  ctx.quadraticCurveTo(230, 430, 248, 458);
  ctx.stroke();
}

function drawFall(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(560, 430);
  ctx.rotate(-1.35);
  ctx.beginPath();
  ctx.arc(0, -80, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.lineTo(0, 110);
  ctx.moveTo(-50, 8);
  ctx.lineTo(50, 16);
  ctx.moveTo(-18, 110);
  ctx.lineTo(-30, 190);
  ctx.moveTo(18, 110);
  ctx.lineTo(36, 186);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(48, -40);
  ctx.lineTo(200, -28);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(760, 520, 42, 28, 0.2, 0, Math.PI * 2);
  ctx.stroke();
  figure(ctx, 280, 500, 1.05, true);
}

function drawValleyDoodle(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, id: DoodleId) {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.15;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.translate(w * 0.06, h * 0.12);
  ctx.scale(w / 1180, h / 780);
  if (id === "stone") drawStone(ctx);
  else if (id === "fall") drawFall(ctx);
  else drawSling(ctx);
  ctx.restore();
}

function drawVintage(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string, doodle: DoodleId, rand: () => number) {
  const m = 42;
  paperStock(ctx, w, h, ink, rand);
  hairline(ctx, m, m, w - m * 2, h - m * 2, `${ink}88`, 2.2);
  hairline(ctx, m + 12, m + 12, w - (m + 12) * 2, h - (m + 12) * 2, `${ink}44`, 1);
  ctx.save();
  ctx.fillStyle = "rgba(80, 42, 16, 0.12)";
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, 190, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  drawValleyDoodle(ctx, w, h, ink, doodle);
  drawStamp(ctx, w - 232, 62, ink);
}

function drawStamp(ctx: CanvasRenderingContext2D, x: number, y: number, ink: string) {
  const sw = 132;
  const sh = 156;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.08);
  ctx.fillStyle = "#edd8b0";
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(0, 0, sw, sh);
  ctx.fillRect(0, 0, sw, sh);
  ctx.strokeRect(7, 7, sw - 14, sh - 14);
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.78;
  ctx.textAlign = "center";
  ctx.font = '600 13px "Fraunces", serif';
  ctx.fillText("ANAGRAM", sw / 2, 32);
  ctx.font = '600 22px "Fraunces", serif';
  ctx.fillText("FORGE", sw / 2, 58);
  ctx.beginPath();
  ctx.moveTo(22, 72);
  ctx.lineTo(sw - 22, 72);
  ctx.stroke();
  ctx.font = '500 11px "Fraunces", serif';
  ctx.fillText("SOUVENIR", sw / 2, 94);
  ctx.font = '600 28px "Fraunces", serif';
  ctx.fillText("MAIL", sw / 2, 128);
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(sw * 0.78, 18, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '500 9px "Fraunces", serif';
  ctx.fillText("AF", sw * 0.78, 22);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-10, 36 + i * 10);
    ctx.bezierCurveTo(30, 24 + i * 10, 80, 52 + i * 10, sw + 14, 40 + i * 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawIndex(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const top = 96;
  const gap = 46;
  ctx.save();
  ctx.strokeStyle = "rgba(70, 110, 160, 0.28)";
  ctx.lineWidth = 1.5;
  for (let y = top; y < h - 70; y += gap) {
    ctx.beginPath();
    ctx.moveTo(56, y);
    ctx.lineTo(w - 56, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(178, 59, 44, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(168, 56);
  ctx.lineTo(168, h - 56);
  ctx.stroke();
  ctx.restore();
  drawDoodle(ctx, w - 220, 70, "#1e3a5f");
}

function drawDoodle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(8, 28);
  ctx.quadraticCurveTo(48, -6, 88, 28);
  ctx.quadraticCurveTo(48, 18, 8, 28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(48, 22);
  ctx.lineTo(62, 36);
  ctx.stroke();
  ctx.restore();
}

function drawPress(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string) {
  const m = 56;
  ctx.save();
  ctx.strokeStyle = `${ink}22`;
  ctx.lineWidth = 10;
  ctx.strokeRect(m + 5, m + 6, w - m * 2, h - m * 2);
  ctx.strokeStyle = `${ink}40`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  ctx.fillStyle = "#c6a15b";
  ctx.globalAlpha = 0.85;
  ctx.font = '600 18px "Fraunces", serif';
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(42, h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("PROOF", 0, 0);
  ctx.restore();
  ctx.restore();
}

function caption(ctx: CanvasRenderingContext2D, w: number, h: number, ink: string) {
  ctx.save();
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.42;
  ctx.font = '500 18px "Fraunces", serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "0.28em";
  ctx.fillText("ANAGRAM FORGE", w / 2, h - 42);
  ctx.restore();
}

export async function renderAnagramCard(
  from: string,
  to: string,
  style: CardStyle = DEFAULT_CARD_STYLE,
  sign?: string,
): Promise<string> {
  await ensureFont(style);
  if (sign) await ensureSignatureFont();
  const w = POSTCARD.w;
  const h = POSTCARD.h;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = style.paper;
  ctx.fillRect(0, 0, w, h);

  let plated = false;
  if (style.look === "vintage") {
    plated = await drawVintagePlate(ctx, w, h, style.doodle || "sling");
    if (!plated) {
      drawVintage(ctx, w, h, style.ink, style.doodle || "sling", rng(seedOf(`${from}|${to}|${style.doodle}`)));
    }
  } else if (style.look === "index") drawIndex(ctx, w, h);
  else drawPress(ctx, w, h, style.ink);

  const maxW = w * (style.look === "index" ? 0.72 : plated ? 0.66 : 0.78);
  const centerX = style.look === "index" ? w * 0.56 : plated ? w * 0.405 : w / 2;
  const topRaw = from.trim() || "—";
  const botRaw = to.trim() || "—";
  const top = style.uppercase ? topRaw.toUpperCase() : topRaw;
  const bottom = style.uppercase ? botRaw.toUpperCase() : botRaw;

  let topSize = fitLine(ctx, top, maxW, style);
  applyFont(ctx, style, topSize);
  const topLines = wrapLine(ctx, top, maxW, style.tracking);
  let botSize = fitLine(ctx, bottom, maxW, style);
  applyFont(ctx, style, botSize);
  const botLines = wrapLine(ctx, bottom, maxW, style.tracking);

  const leading = plated ? 1.08 : 1.16;
  const gap = plated
    ? Math.max(style.paths ? 64 : 40, style.size * 0.55)
    : Math.max(style.paths ? 110 : 56, style.size * (style.paths ? 1.2 : 0.85));
  const topBlock = topLines.length * topSize * leading;
  const botBlock = botLines.length * botSize * leading;
  const total = topBlock + gap + botBlock;
  const skyTop = plated ? h * 0.12 : 0;
  let y = plated ? skyTop + topSize * 0.52 : (h - total) / 2 + topSize * 0.52;

  const topGlyphs: Glyph[] = [];
  const drawLine = (line: string, yy: number, size: number) => {
    applyFont(ctx, style, size);
    if (style.look === "press") {
      ctx.save();
      ctx.fillStyle = "rgba(26, 23, 20, 0.16)";
      drawRun(ctx, line, centerX + 2, yy + 2.5, style.tracking);
      ctx.restore();
    }
    ctx.fillStyle = style.ink;
    return drawRun(ctx, line, centerX, yy, style.tracking);
  };

  for (const line of topLines) {
    topGlyphs.push(...drawLine(line, y, topSize));
    y += topSize * leading;
  }
  y += gap - topSize * 0.15;
  const botGlyphs: Glyph[] = [];
  for (const line of botLines) {
    botGlyphs.push(...drawLine(line, y, botSize));
    y += botSize * leading;
  }

  if (style.paths) {
    drawPaths(ctx, pairGlyphs(topGlyphs, botGlyphs), topSize, botSize, style.path);
  }

  if (!plated) caption(ctx, w, h, style.ink);

  if (sign) {
    ctx.save();
    ctx.fillStyle = "#d4a24c";
    ctx.globalAlpha = plated ? 0.9 : 0.92;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(212, 162, 76, 0.35)";
    ctx.shadowBlur = 8;
    if (plated) {
      ctx.textAlign = "center";
      ctx.font = '400 34px "Great Vibes", "Palatino Linotype", cursive';
      ctx.fillText(sign, w * VINTAGE_STAMP.x, h * VINTAGE_STAMP.y);
    } else {
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.font = '400 72px "Great Vibes", "Palatino Linotype", cursive';
      ctx.fillText(sign, w - 86, h - 48);
    }
    ctx.restore();
  }

  return canvas.toDataURL("image/png");
}

export function displayRack(raw: string): string {
  return raw
    .replace(/[?.]/g, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nearestWeight(id: CardFontId, weight: CardStyle["weight"]): CardStyle["weight"] {
  return clampWeight(id, weight);
}
