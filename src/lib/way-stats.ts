import { lastDays, todayNY } from "@/lib/stat-day";
import { visitorKey } from "@/lib/visitor-key";

export type WayDay = { day: string; visits: number };

type Box = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const ram = { visits: 0, days: {} as Record<string, number> };
const lastHit = new Map<string, number>();
const COOL_MS = 60_000;
/** Bump to zero the public count (test visits). */
const WAY_EPOCH = "2026-09-11";
let ramEpoch = "";

function ipOf(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

function isCrawler(request: Request) {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (!ua) return false;
  return /googlebot|bingbot|yandex|baiduspider|duckduckbot|gptbot|claudebot|bytespider|semrush|ahrefs|petalbot|applebot|twitterbot|facebookexternalhit|slurp|crawler|spider/.test(
    ua,
  );
}

async function box(): Promise<Box | null> {
  try {
    const mod = await import("cloudflare:workers");
    const kvn = (mod as { env?: { STATS?: Box } }).env?.STATS;
    if (kvn && typeof kvn.get === "function") return kvn;
  } catch {
    /* preview */
  }
  return null;
}

async function resetStore(store: Box) {
  const days = lastDays(14);
  await store.put("way", "0");
  await Promise.all(days.map((day) => store.put(`day:way:${day}`, "0")));
  await store.put("way:epoch", WAY_EPOCH);
}

async function ready(store: Box | null): Promise<Box | null> {
  if (!store) {
    if (ramEpoch !== WAY_EPOCH) {
      ram.visits = 0;
      ram.days = {};
      ramEpoch = WAY_EPOCH;
    }
    return null;
  }
  const epoch = await store.get("way:epoch");
  if (epoch !== WAY_EPOCH) await resetStore(store);
  return store;
}

/** Count a real view of The Way. Caller must already have an open door. */
export async function bumpWayVisit(request: Request): Promise<void> {
  if (isCrawler(request)) return;
  const ip = visitorKey(ipOf(request));
  const now = Date.now();
  const prev = lastHit.get(ip) || 0;
  if (now - prev < COOL_MS) return;
  lastHit.set(ip, now);
  if (lastHit.size > 4_000) {
    const cut = now - COOL_MS;
    for (const [k, t] of lastHit) {
      if (t < cut) lastHit.delete(k);
    }
  }
  const store = await ready(await box());
  const day = todayNY();
  if (!store) {
    ram.visits += 1;
    ram.days[day] = (ram.days[day] || 0) + 1;
    return;
  }
  const n = Number(await store.get("way")) || 0;
  const d = Number(await store.get(`day:way:${day}`)) || 0;
  await Promise.all([store.put("way", String(n + 1)), store.put(`day:way:${day}`, String(d + 1))]);
}

export async function readWayStats(): Promise<{ visits: number; series: WayDay[] }> {
  const store = await ready(await box());
  const days = lastDays(14);
  if (!store) {
    return {
      visits: ram.visits,
      series: days.map((day) => ({ day, visits: ram.days[day] || 0 })),
    };
  }
  const visits = Number(await store.get("way")) || 0;
  const series: WayDay[] = [];
  for (const day of days) {
    series.push({ day, visits: Number(await store.get(`day:way:${day}`)) || 0 });
  }
  return { visits, series };
}
