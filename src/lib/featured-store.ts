import {
  FEATURED_MAX_BYTES,
  cleanCaption,
  cleanCipherSettings,
  type CipherSettings,
  featuredKeys,
  featuredScope,
  isFeaturedId,
  isPng,
  pngSize,
} from "@/lib/featured-png";

export type Featured = { id: string; caption: string; at: number; w: number; h: number; settings?: CipherSettings };

type Kv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
  delete?: (key: string) => Promise<void>;
};

type R2 = {
  get: (key: string) => Promise<{ body: ReadableStream; size: number; httpEtag: string } | null>;
  put: (key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
};

/** Set at build time from CF_PAGES_BRANCH (see vite.config.ts). */
const BRANCH = typeof __AF_BRANCH__ === "string" ? __AF_BRANCH__ : "";
const KEYS = featuredKeys(featuredScope(BRANCH));

/** Dev without Cloudflare bindings keeps it in memory. */
const ram = { kv: new Map<string, string>(), r2: new Map<string, Uint8Array>() };

async function stores(): Promise<{ kv: Kv; r2: R2 } | null> {
  try {
    const mod = await import("cloudflare:workers");
    const env = (mod as { env?: { STATS?: Kv; MEDIA?: R2 } }).env;
    if (env?.STATS && env?.MEDIA && typeof env.MEDIA.put === "function") return { kv: env.STATS, r2: env.MEDIA };
  } catch {
    /* dev */
  }
  return null;
}

function parse(raw: string | null): Featured | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Featured;
    if (!isFeaturedId(f.id)) return null;
    const settings = cleanCipherSettings(f.settings) ?? undefined;
    return { id: f.id, caption: cleanCaption(f.caption), at: Number(f.at) || 0, w: Number(f.w) || 0, h: Number(f.h) || 0, settings };
  } catch {
    return null;
  }
}

async function kvGet(key: string): Promise<Featured | null> {
  const s = await stores();
  return parse(s ? await s.kv.get(key) : (ram.kv.get(key) ?? null));
}

async function kvSet(key: string, value: Featured | null) {
  const s = await stores();
  const raw = value ? JSON.stringify(value) : "";
  if (s) {
    if (!value && s.kv.delete) await s.kv.delete(key);
    else await s.kv.put(key, raw);
  } else if (value) ram.kv.set(key, raw);
  else ram.kv.delete(key);
}

async function dropObject(id: string) {
  const s = await stores();
  if (s) await s.r2.delete(KEYS.object(id));
  else ram.r2.delete(KEYS.object(id));
}

export async function readFeatured(): Promise<{ now: Featured | null; prev: Featured | null }> {
  return { now: await kvGet(KEYS.now), prev: await kvGet(KEYS.prev) };
}

/** Only the current render is served. Earlier ones stay private until reverted. */
export async function featuredImage(id: string): Promise<{ body: ReadableStream | ArrayBuffer; size: number } | null> {
  if (!isFeaturedId(id)) return null;
  const now = await kvGet(KEYS.now);
  if (!now || now.id !== id) return null;
  const s = await stores();
  if (s) {
    const obj = await s.r2.get(KEYS.object(id));
    return obj ? { body: obj.body, size: obj.size } : null;
  }
  const buf = ram.r2.get(KEYS.object(id));
  return buf ? { body: new Uint8Array(buf).buffer, size: buf.byteLength } : null;
}

export type Result = { ok: true; now: Featured | null; prev: Featured | null } | { ok: false; reason: string; status: number };

export async function setFeatured(bytes: Uint8Array, caption: unknown, rawSettings: unknown): Promise<Result> {
  const settings = cleanCipherSettings(rawSettings);
  if (!settings) return { ok: false, reason: "Those cipher settings didn’t check out.", status: 400 };
  if (bytes.byteLength > FEATURED_MAX_BYTES) return { ok: false, reason: "Image is over 2 MB.", status: 413 };
  if (!isPng(bytes)) return { ok: false, reason: "That isn’t a PNG.", status: 415 };
  const size = pngSize(bytes);
  if (!size) return { ok: false, reason: "That PNG’s size looks wrong.", status: 415 };
  const rand = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
  const next: Featured = { id: `${Date.now()}-${rand}`, caption: cleanCaption(caption), at: Date.now(), ...size, settings };
  const s = await stores();
  if (s) await s.r2.put(KEYS.object(next.id), bytes, { httpMetadata: { contentType: "image/png" } });
  else ram.r2.set(KEYS.object(next.id), bytes);
  const { now, prev } = await readFeatured();
  // Keep one earlier render for revert; the one before that is deleted.
  if (prev && prev.id !== now?.id) await dropObject(prev.id);
  await kvSet(KEYS.prev, now);
  await kvSet(KEYS.now, next);
  return { ok: true, now: next, prev: now };
}

/** Swap the current and earlier render. Running it twice puts things back. */
export async function revertFeatured(): Promise<Result> {
  const { now, prev } = await readFeatured();
  if (!prev) return { ok: false, reason: "No earlier render to go back to.", status: 400 };
  await kvSet(KEYS.now, prev);
  await kvSet(KEYS.prev, now);
  return { ok: true, now: prev, prev: now };
}

/** Take the card down. The removed render becomes the earlier one, so revert brings it back. */
export async function removeFeatured(): Promise<Result> {
  const { now, prev } = await readFeatured();
  if (!now) return { ok: true, now: null, prev };
  if (prev && prev.id !== now.id) await dropObject(prev.id);
  await kvSet(KEYS.prev, now);
  await kvSet(KEYS.now, null);
  return { ok: true, now: null, prev: now };
}
