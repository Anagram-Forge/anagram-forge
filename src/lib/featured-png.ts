/**
 * Pure helpers for the featured render on the home page. No imports, so the
 * node test runner can load this file directly.
 */

/** Upload cap for a featured render. */
export const FEATURED_MAX_BYTES = 2 * 1024 * 1024;

export const FEATURED_DEFAULT_CAPTION = "A render from the forge.";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** True when the bytes start with the 8-byte PNG signature and an IHDR chunk. */
export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 33) return false;
  for (let i = 0; i < PNG_MAGIC.length; i++) if (bytes[i] !== PNG_MAGIC[i]) return false;
  return bytes[12] === 0x49 && bytes[13] === 0x48 && bytes[14] === 0x44 && bytes[15] === 0x52;
}

/** Width and height from the IHDR chunk, or null. */
export function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (!isPng(bytes)) return null;
  const read = (o: number) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  const w = read(16);
  const h = read(20);
  if (!w || !h || w > 8000 || h > 8000) return null;
  return { w, h };
}

/**
 * Store prefix for this build. Only the production branch (main) reads and
 * writes the live keys. Every preview branch and local build gets its own
 * prefix, so testing a preview can never touch the live home page card.
 */
export function featuredScope(branch: string | undefined | null): string {
  const b = String(branch || "").trim();
  if (b === "main") return "";
  const slug = b.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "local";
  return `preview/${slug}/`;
}

export function featuredKeys(scope: string) {
  return {
    now: `${scope}featured:now`,
    prev: `${scope}featured:prev`,
    object: (id: string) => `${scope}featured/${id}.png`,
  };
}

/** Plain one-line caption, at most 80 characters. */
export function cleanCaption(raw: unknown): string {
  const s = [...String(raw ?? "")]
    .map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === "<" || c === ">" ? " " : c))
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return s || FEATURED_DEFAULT_CAPTION;
}

export function isFeaturedId(v: unknown): v is string {
  return typeof v === "string" && /^[0-9]{13}-[a-z0-9]{8}$/.test(v);
}

/* ---------- live settings for the home page floater ---------- */

export const CIPHER_MODES = ["fold", "stacked", "spiral", "sphere", "helix"] as const;
export const CIPHER_MATERIALS = [
  "glass",
  "diamond",
  "ruby",
  "sapphire",
  "emerald",
  "amethyst",
  "gold",
  "obsidian",
  "glossy",
  "matte",
] as const;
export const CIPHER_LIGHTS = ["golden", "studio", "blue", "moon", "noon"] as const;
export const CIPHER_FONTS = ["serif", "sans", "thin"] as const;
export const CIPHER_MAX_LETTERS = 24;

/** Everything the home page needs to redraw a render exactly, moving as it was. */
export type CipherSettings = {
  v: 1;
  text: string;
  finals: boolean;
  mode: (typeof CIPHER_MODES)[number];
  material: (typeof CIPHER_MATERIALS)[number];
  lighting: (typeof CIPHER_LIGHTS)[number];
  font: (typeof CIPHER_FONTS)[number];
  fold: number;
  gap: number;
  sharp: number;
  layers: number;
  colorByLetter: boolean;
  evolve: boolean;
  spin: boolean;
  spinSpeed: number;
  evolveSpeed: number;
  locked: boolean;
  lockYaw: number;
  lockPitch: number;
  /** View at the moment it was featured: turn and tilt in radians, evolve clock in seconds. */
  yaw: number;
  pitch: number;
  t: number;
};

const NUMS: Record<string, [number, number]> = {
  fold: [0, 2],
  gap: [0.02, 0.4],
  sharp: [0, 1],
  layers: [1, 40],
  spinSpeed: [-15, 15],
  evolveSpeed: [0, 25],
  lockYaw: [-180, 180],
  lockPitch: [-90, 90],
  yaw: [-1000, 1000],
  pitch: [-1.6, 1.6],
  t: [0, 1e6],
};
const BOOLS = ["finals", "colorByLetter", "evolve", "spin", "locked"] as const;
const ENUMS: Record<string, readonly string[]> = {
  mode: CIPHER_MODES,
  material: CIPHER_MATERIALS,
  lighting: CIPHER_LIGHTS,
  font: CIPHER_FONTS,
};
const ALLOWED = new Set(["v", "text", ...Object.keys(NUMS), ...BOOLS, ...Object.keys(ENUMS)]);

function cipherLetterCount(text: string) {
  return [...text].filter((c) => /[\u05D0-\u05EAA-Za-z]/.test(c)).length;
}

/**
 * Strict check of featured settings. Unknown fields, wrong types, or bad enum
 * values reject the whole thing. Numbers are clamped to the cipher's own ranges.
 */
export function cleanCipherSettings(raw: unknown): CipherSettings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!ALLOWED.has(k)) return null;
  if (o.v !== 1) return null;
  if (typeof o.text !== "string" || o.text.length > 64) return null;
  const text = o.text.replace(/\s+/g, " ").trim();
  if (!/^[\u05D0-\u05EAA-Za-z ]+$/.test(text)) return null;
  const n = cipherLetterCount(text);
  if (n < 1 || n > CIPHER_MAX_LETTERS) return null;
  const out: Record<string, unknown> = { v: 1, text };
  for (const [k, [lo, hi]] of Object.entries(NUMS)) {
    const x = o[k];
    if (typeof x !== "number" || !Number.isFinite(x)) return null;
    out[k] = Math.min(hi, Math.max(lo, x));
  }
  out.layers = Math.round(out.layers as number);
  for (const k of BOOLS) {
    if (typeof o[k] !== "boolean") return null;
    out[k] = o[k];
  }
  for (const [k, list] of Object.entries(ENUMS)) {
    if (typeof o[k] !== "string" || !list.includes(o[k] as string)) return null;
    out[k] = o[k];
  }
  return out as CipherSettings;
}

/** "21-Nov-2026 02:50 ET": 24-hour US Eastern. */
export function easternStamp(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")} ET`;
}
