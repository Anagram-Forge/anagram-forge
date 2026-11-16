import type { Reading } from "@/lib/anagram/read-why";

const DAY_CAP = 12;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

type Kv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const memCache = new Map<string, { at: number; value: string }>();
const memQuota = new Map<string, number>();

async function kv(): Promise<Kv | null> {
  try {
    const mod = await import("cloudflare:workers");
    const box = (mod as { env?: { STATS?: Kv } }).env?.STATS;
    if (box && typeof box.get === "function") return box;
  } catch {
    /* preview */
  }
  return null;
}

function dayKey(handle: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `readq:${handle.toLowerCase()}:${day}`;
}

async function readRaw(key: string): Promise<string | null> {
  const box = await kv();
  if (box) return box.get(key);
  const hit = memCache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit.value;
}

async function writeRaw(key: string, value: string): Promise<void> {
  const box = await kv();
  if (box) {
    await box.put(key, value);
    return;
  }
  memCache.set(key, { at: Date.now(), value });
}

export async function cachedReading(key: string): Promise<Reading | null> {
  const raw = await readRaw(`readc:${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at?: number; context?: string; notes?: Reading["notes"] };
    if (!parsed.at || Date.now() - parsed.at > CACHE_MS || !Array.isArray(parsed.notes)) return null;
    return { context: String(parsed.context || ""), notes: parsed.notes, order: Array.isArray((parsed as { order?: unknown }).order) ? (parsed as { order: string[] }).order : [] };
  } catch {
    return null;
  }
}

export async function storeReading(key: string, reading: Reading): Promise<void> {
  await writeRaw(`readc:${key}`, JSON.stringify({ at: Date.now(), ...reading }));
}

export async function cachedFollow(key: string): Promise<string | null> {
  const raw = await readRaw(`readf:${key}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at?: number; reply?: string };
    if (!parsed.at || Date.now() - parsed.at > CACHE_MS || !parsed.reply) return null;
    return parsed.reply;
  } catch {
    return null;
  }
}

export async function storeFollow(key: string, reply: string): Promise<void> {
  await writeRaw(`readf:${key}`, JSON.stringify({ at: Date.now(), reply }));
}

async function usedToday(handle: string): Promise<number> {
  const key = dayKey(handle);
  const box = await kv();
  if (box) return Number((await box.get(key)) || "0") || 0;
  return memQuota.get(key) || 0;
}

export async function readsLeft(handle: string): Promise<number> {
  return Math.max(0, DAY_CAP - (await usedToday(handle)));
}

export async function markRead(handle: string): Promise<number> {
  const key = dayKey(handle);
  const next = (await usedToday(handle)) + 1;
  const box = await kv();
  if (box) await box.put(key, String(next));
  else memQuota.set(key, next);
  return Math.max(0, DAY_CAP - next);
}

export const READ_CAP = DAY_CAP;
export const LIMIT_LINE =
  "You’ve used today’s 12. Each reading costs the site money to run, and the site doesn’t charge, so they open again tomorrow.";
