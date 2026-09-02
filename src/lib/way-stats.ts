import { lastDays, todayNY } from "@/lib/stat-day";

export type WayDay = { day: string; visits: number };

type Box = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const ram = { visits: 0, days: {} as Record<string, number> };
const lastHit = new Map<string, number>();
const COOL_MS = 60_000;

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

/** Count a real view of The Way. Caller must already have an open door. */
export async function bumpWayVisit(request: Request): Promise<void> {
  if (isCrawler(request)) return;
  const ip = ipOf(request);
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
  const store = await box();
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
  const store = await box();
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
