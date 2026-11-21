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
