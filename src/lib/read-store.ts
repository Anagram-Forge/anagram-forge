import type { Reading } from "@/lib/anagram/read-why";

const DAY_CAP = 12;
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;

type Kv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
  list?: (opts: { prefix: string }) => Promise<{ keys: { name: string }[] }>;
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
export const FAIL_NOTE = 5;
export const LIMIT_LINE =
  "You’ve used today’s 12. Each reading costs the site money to run, and the site doesn’t charge, so they open again tomorrow.";

export type TokenUse = { prompt: number; completion: number; total: number };
export type ReadLedger = {
  readingsToday: number;
  tokensToday: number;
  tokensKept: number;
  failuresToday: number;
  failureNote: number;
  handles: { handle: string; today: number; kept: number }[];
};

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function handleKey(handle: string): string {
  return handle.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

async function num(key: string): Promise<number> {
  const box = await kv();
  if (box) return Number((await box.get(key)) || "0") || 0;
  return memQuota.get(key) || 0;
}

async function bump(key: string, by: number): Promise<number> {
  const next = (await num(key)) + by;
  const box = await kv();
  if (box) await box.put(key, String(next));
  else memQuota.set(key, next);
  return next;
}

/** A real model call. A cached answer does not come through here. */
export async function noteCall(handle: string, use: TokenUse): Promise<void> {
  const day = dayStamp();
  const total = Math.max(0, Math.floor(use.total) || 0);
  await bump(`tok:n:${day}`, 1);
  if (total <= 0) return;
  await bump(`tok:t:${day}`, total);
  await bump("tok:life", total);
  const h = handleKey(handle);
  if (!h) return;
  await bump(`tok:h:${h}`, total);
  await bump(`tok:d:${day}:${h}`, total);
}

export async function noteFailure(): Promise<number> {
  return bump(`tok:f:${dayStamp()}`, 1);
}

export async function claimFailureNote(): Promise<boolean> {
  const key = `tok:mail:${dayStamp()}`;
  if (await num(key)) return false;
  await bump(key, 1);
  return true;
}

export async function readingLedger(): Promise<ReadLedger> {
  const day = dayStamp();
  const box = await kv();
  const rows: { handle: string; today: number; kept: number }[] = [];
  if (box?.list) {
    const listed = await box.list({ prefix: "tok:h:" });
    for (const k of listed.keys) {
      const handle = k.name.slice(6);
      const kept = Number((await box.get(k.name)) || "0") || 0;
      const today = Number((await box.get(`tok:d:${day}:${handle}`)) || "0") || 0;
      if (kept > 0) rows.push({ handle, today, kept });
    }
  } else {
    for (const [key, kept] of memQuota) {
      if (!key.startsWith("tok:h:")) continue;
      const handle = key.slice(6);
      rows.push({ handle, today: memQuota.get(`tok:d:${day}:${handle}`) || 0, kept });
    }
  }
  rows.sort((a, b) => b.kept - a.kept || b.today - a.today);
  return {
    readingsToday: await num(`tok:n:${day}`),
    tokensToday: await num(`tok:t:${day}`),
    tokensKept: await num("tok:life"),
    failuresToday: await num(`tok:f:${day}`),
    failureNote: FAIL_NOTE,
    handles: rows.slice(0, 8),
  };
}
