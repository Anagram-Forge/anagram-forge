export type CardFontId = "oswald" | "playfair" | "fraunces";

export type CardStyle = {
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
};

export const CARD_FONTS: {
  id: CardFontId;
  label: string;
  family: string;
  weights: Array<CardStyle["weight"]>;
  italic?: boolean;
  href: string;
}[] = [
  {
    id: "oswald",
    label: "Oswald",
    family: "Oswald",
    weights: [400, 500, 600, 700],
    href: "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap",
  },
  {
    id: "playfair",
    label: "Playfair",
    family: "Playfair Display",
    weights: [400, 600, 700, 900],
    italic: true,
    href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&display=swap",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    family: "Fraunces",
    weights: [500, 600, 700],
    italic: true,
    href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,600&display=swap",
  },
];

export const DEFAULT_CARD_STYLE: CardStyle = {
  font: "oswald",
  size: 92,
  weight: 700,
  italic: false,
  uppercase: true,
  tracking: 0,
  ink: "#111111",
  paper: "#c8c8c8",
  paths: true,
  path: "#f07812",
};

export const PAPER_SWATCHES = ["#c8c8c8", "#efe6d4", "#f4f1ea", "#111111", "#1c1916"];
export const INK_SWATCHES = ["#111111", "#3b1d0f", "#6b1d12", "#ebe4d6", "#d4a24c"];
export const PATH_SWATCHES = ["#f07812", "#d4a24c", "#c45c4a", "#111111", "#ebe4d6"];

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
  return `${italic}${weight} ${style.size}px "${face.family}", "Times New Roman", serif`;
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
  while (size > 28 && measureRun(ctx, text, style.tracking) > maxWidth) {
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
  ctx.lineWidth = Math.max(3.5, Math.min(topSize, botSize) * 0.055);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.92;
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

export async function renderAnagramCard(from: string, to: string, style: CardStyle = DEFAULT_CARD_STYLE): Promise<string> {
  await ensureFont(style);
  const w = 1600;
  const h = 900;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = style.paper;
  ctx.fillRect(0, 0, w, h);

  const maxW = w * 0.86;
  const topRaw = from.trim() || "—";
  const botRaw = to.trim() || "—";
  const top = style.uppercase ? topRaw.toUpperCase() : topRaw;
  const bottom = style.uppercase ? botRaw.toUpperCase() : botRaw;

  const topSize = fitLine(ctx, top, maxW, style);
  applyFont(ctx, style, topSize);
  const topLines = wrapLine(ctx, top, maxW, style.tracking);
  const botSize = fitLine(ctx, bottom, maxW, style);
  applyFont(ctx, style, botSize);
  const botLines = wrapLine(ctx, bottom, maxW, style.tracking);

  const leading = 1.16;
  const topBlock = topLines.length * topSize * leading;
  const botBlock = botLines.length * botSize * leading;
  const gap = Math.max(style.paths ? 110 : 56, style.size * (style.paths ? 1.2 : 0.85));
  const total = topBlock + gap + botBlock;
  let y = (h - total) / 2 + topSize * 0.52;

  ctx.fillStyle = style.ink;
  const topGlyphs: Glyph[] = [];
  applyFont(ctx, style, topSize);
  for (const line of topLines) {
    topGlyphs.push(...drawRun(ctx, line, w / 2, y, style.tracking));
    y += topSize * leading;
  }
  y += gap - topSize * 0.15;
  const botGlyphs: Glyph[] = [];
  applyFont(ctx, style, botSize);
  const botStart = y;
  for (const line of botLines) {
    botGlyphs.push(...drawRun(ctx, line, w / 2, y, style.tracking));
    y += botSize * leading;
  }
  void botStart;

  if (style.paths) {
    drawPaths(ctx, pairGlyphs(topGlyphs, botGlyphs), topSize, botSize, style.path);
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
