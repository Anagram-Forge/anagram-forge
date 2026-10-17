import { canSpell, countsOf } from "@/lib/anagram/letters";
import { cleanRack } from "@/lib/rack-clean";
import { isCloudflareWorker } from "@/lib/runtime";
import { envGet } from "@/lib/turnstile";
import { todayNY } from "@/lib/stat-day";

export type Counts = { visits: number; anagrams: number; strikes: number };

type Box = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  delete?: (key: string) => Promise<void>;
};

const ram = {
  visits: 0,
  anagrams: 0,
  strikes: 0,
  days: {} as Record<string, Counts>,
  seen: new Map<string, number>(),
  secret: "",
};

const STRIKE_GAP = 2_000;
const ANAGRAM_GAP = 8_000;
const VISIT_GAP = 60_000;
const STRIKE_HOUR = 40;
const ANAGRAM_HOUR = 60;

export async function statsBox(): Promise<Box | null> {
  try {
    const mod = await import("cloudflare:workers");
    const box = (mod as { env?: { STATS?: Box } }).env?.STATS;
    if (box && typeof box.get === "function") return box;
  } catch {
    /* preview */
  }
  return null;
}

export async function readCounts(store: Box | null): Promise<Counts> {
  if (!store) return { visits: ram.visits, anagrams: ram.anagrams, strikes: ram.strikes };
  const [visits, anagrams, strikes] = await Promise.all([
    store.get("visits"),
    store.get("anagrams"),
    store.get("strikes"),
  ]);
  return {
    visits: Number(visits) || 0,
    anagrams: Number(anagrams) || 0,
    strikes: Number(strikes) || 0,
  };
}

async function writeCounts(store: Box | null, next: Counts) {
  if (!store) {
    ram.visits = next.visits;
    ram.anagrams = next.anagrams;
    ram.strikes = next.strikes;
    return;
  }
  await Promise.all([
    store.put("visits", String(next.visits)),
    store.put("anagrams", String(next.anagrams)),
    store.put("strikes", String(next.strikes)),
  ]);
}

async function bumpDay(store: Box | null, kind: keyof Counts) {
  const day = todayNY();
  if (!store) {
    ram.days[day] = ram.days[day] || { visits: 0, anagrams: 0, strikes: 0 };
    ram.days[day][kind] += 1;
    return;
  }
  const key = `day:${kind}:${day}`;
  const n = Number(await store.get(key)) || 0;
  await store.put(key, String(n + 1));
}

function seenRecently(key: string, gap: number, now: number): boolean {
  const prev = ram.seen.get(key) || 0;
  if (now - prev < gap) return true;
  return false;
}

function markSeen(key: string, now: number) {
  if (ram.seen.size > 4000) ram.seen.clear();
  ram.seen.set(key, now);
}

async function tooSoon(store: Box | null, key: string, gap: number, now: number): Promise<boolean> {
  if (seenRecently(key, gap, now)) return true;
  if (!store) return false;
  const prev = Number(await store.get(key)) || 0;
  return now - prev < gap;
}

async function markTime(store: Box | null, key: string, now: number, ttl: number) {
  markSeen(key, now);
  if (store) await store.put(key, String(now), { expirationTtl: ttl });
}

async function hourCount(store: Box | null, key: string): Promise<number> {
  if (!store) return ram.seen.get(`n:${key}`) || 0;
  return Number(await store.get(key)) || 0;
}

async function bumpHour(store: Box | null, key: string) {
  const n = (await hourCount(store, key)) + 1;
  if (!store) {
    ram.seen.set(`n:${key}`, n);
    return;
  }
  await store.put(key, String(n), { expirationTtl: 7200 });
}

export async function bumpVisit(store: Box | null, ip: string): Promise<Counts> {
  const now = Date.now();
  const cur = await readCounts(store);
  const key = `rl:v:${ip}`;
  if (await tooSoon(store, key, VISIT_GAP, now)) return cur;
  await markTime(store, key, now, 120);
  cur.visits += 1;
  await writeCounts(store, cur);
  await bumpDay(store, "visits");
  return cur;
}

let words: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

async function dictionary(request: Request): Promise<Set<string>> {
  if (words) return words;
  if (loading) return loading;
  loading = (async () => {
    let text = "";
    if (!isCloudflareWorker()) {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      text = await readFile(join(process.cwd(), "public/dict/enable1.txt"), "utf8");
    } else {
      const res = await fetch(new URL("/dict/enable1.txt", request.url));
      if (!res.ok) throw new Error("dict");
      text = await res.text();
    }
    const set = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
      const w = line.trim().toLowerCase();
      if (w.length >= 2 && w.length <= 21 && /^[a-z]+$/.test(w)) set.add(w);
    }
    set.add("a");
    set.add("i");
    words = set;
    return set;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export async function bumpAnagram(
  store: Box | null,
  ip: string,
  request: Request,
  rackRaw: string,
  wordRaw: string,
): Promise<Counts> {
  const cur = await readCounts(store);
  const rack = cleanRack(rackRaw);
  const word = String(wordRaw || "")
    .trim()
    .toLowerCase();
  if (!rack || rack.blanks > 10 || !/^[a-z]{2,21}$/.test(word)) return cur;
  if (!canSpell(countsOf(word), countsOf(rack.letters), rack.blanks)) return cur;
  let known = false;
  try {
    known = (await dictionary(request)).has(word);
  } catch {
    return cur;
  }
  if (!known) return cur;

  const now = Date.now();
  const hour = Math.floor(now / 3_600_000);
  const hourKey = `rl:ah:${ip}:${hour}`;
  if ((await hourCount(store, hourKey)) >= ANAGRAM_HOUR) return cur;
  if (await tooSoon(store, `rl:a:${ip}`, ANAGRAM_GAP, now)) return cur;
  const sig = `${rack.letters.split("").sort().join("")}:${rack.blanks}`;
  const dayKey = `rl:ar:${ip}:${sig}`;
  if (store) {
    if (await store.get(dayKey)) return cur;
  } else if (ram.seen.has(dayKey)) return cur;

  await markTime(store, `rl:a:${ip}`, now, 120);
  await bumpHour(store, hourKey);
  if (store) await store.put(dayKey, "1", { expirationTtl: 86_400 });
  else ram.seen.set(dayKey, now);

  cur.anagrams += 1;
  await writeCounts(store, cur);
  await bumpDay(store, "anagrams");
  return cur;
}

async function macSecret(store: Box | null): Promise<string> {
  const fromEnv = (await envGet("STATS_MAC")) || (await envGet("DOOR_HASH"));
  if (fromEnv) return fromEnv;
  if (!store) {
    if (!ram.secret) ram.secret = crypto.randomUUID();
    return ram.secret;
  }
  const existing = await store.get("stats:mac");
  if (existing) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const next = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  await store.put("stats:mac", next);
  return next;
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Short-lived, IP-bound ticket. Redeeming it is the only way to count a strike. */
export async function mintStrikeTicket(store: Box | null, ip: string): Promise<string> {
  const secret = await macSecret(store);
  const exp = Date.now() + 60_000;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const mac = await hmac(secret, `${ip}|${exp}|${nonce}`);
  if (store) await store.put(`tk:${nonce}`, "open", { expirationTtl: 120 });
  else ram.seen.set(`tk:${nonce}`, 1);
  return `${exp}.${nonce}.${mac}`;
}

export async function bumpStrike(store: Box | null, ip: string, ticket: string): Promise<Counts> {
  const cur = await readCounts(store);
  const parts = String(ticket || "").split(".");
  if (parts.length !== 3) return cur;
  const [expRaw, nonce, mac] = parts;
  const exp = Number(expRaw);
  const now = Date.now();
  if (!Number.isFinite(exp) || exp < now || exp > now + 120_000) return cur;
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(mac)) return cur;
  const secret = await macSecret(store);
  const expect = await hmac(secret, `${ip}|${exp}|${nonce}`);
  if (!hexEq(expect, mac)) return cur;
  const nonceKey = `tk:${nonce}`;
  if (store) {
    if ((await store.get(nonceKey)) !== "open") return cur;
    await store.put(nonceKey, "used", { expirationTtl: 120 });
  } else {
    if (ram.seen.get(nonceKey) !== 1) return cur;
    ram.seen.set(nonceKey, 2);
  }

  const hour = Math.floor(now / 3_600_000);
  const hourKey = `rl:sh:${ip}:${hour}`;
  if ((await hourCount(store, hourKey)) >= STRIKE_HOUR) return cur;
  if (await tooSoon(store, `rl:s:${ip}`, STRIKE_GAP, now)) return cur;
  await markTime(store, `rl:s:${ip}`, now, 120);
  await bumpHour(store, hourKey);
  cur.strikes += 1;
  await writeCounts(store, cur);
  await bumpDay(store, "strikes");
  return cur;
}
