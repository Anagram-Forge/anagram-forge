import type { ReadNote } from "@/lib/anagram/read-why";

const DAY_CAP = 12;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

type Kv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const memCache = new Map<string, { at: number; notes: ReadNote[] }>();
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

export async function cachedRead(key: string): Promise<ReadNote[] | null> {
  const box = await kv();
  if (box) {
    const raw = await box.get(`readc:${key}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { at?: number; notes?: ReadNote[] };
      if (!parsed.at || Date.now() - parsed.at > CACHE_MS || !Array.isArray(parsed.notes)) return null;
      return parsed.notes;
    } catch {
      return null;
    }
  }
  const hit = memCache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit.notes;
}

export async function storeRead(key: string, notes: ReadNote[]): Promise<void> {
  const body = JSON.stringify({ at: Date.now(), notes });
  const box = await kv();
  if (box) {
    await box.put(`readc:${key}`, body);
    return;
  }
  memCache.set(key, { at: Date.now(), notes });
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
