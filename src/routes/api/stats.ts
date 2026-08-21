import { createFileRoute } from '@tanstack/react-router'
import { lastDays, todayNY, type DayRow } from "@/lib/stat-day";

type Kind = "visit" | "anagram" | "strike";
type Box = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const ram = {
  visits: 0,
  anagrams: 0,
  strikes: 0,
  days: {} as Record<string, { visits: number; anagrams: number; strikes: number }>,
};
const lastHit = new Map<string, { visit: number; anagram: number; strike: number }>();

function ipOf(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

async function box(): Promise<Box | null> {
  try {
    const mod = await import("cloudflare:workers");
    const kvn = (mod as { env?: { STATS?: Box } }).env?.STATS;
    if (kvn && typeof kvn.get === "function") return kvn;
  } catch {
    /* local preview has no KV */
  }
  return null;
}

async function read(box: Box | null) {
  if (!box) return { visits: ram.visits, anagrams: ram.anagrams, strikes: ram.strikes };
  const [visits, anagrams, strikes] = await Promise.all([box.get("visits"), box.get("anagrams"), box.get("strikes")]);
  return {
    visits: Number(visits) || 0,
    anagrams: Number(anagrams) || 0,
    strikes: Number(strikes) || 0,
  };
}

async function write(store: Box | null, next: { visits: number; anagrams: number; strikes: number }) {
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

async function bumpDay(store: Box | null, kind: Kind) {
  const day = todayNY();
  if (!store) {
    ram.days[day] = ram.days[day] || { visits: 0, anagrams: 0, strikes: 0 };
    ram.days[day][kind === "visit" ? "visits" : kind === "anagram" ? "anagrams" : "strikes"] += 1;
    return;
  }
  const key = `day:${kind}:${day}`;
  const n = Number(await store.get(key)) || 0;
  await store.put(key, String(n + 1));
}

async function readSeries(store: Box | null): Promise<DayRow[]> {
  const days = lastDays(14);
  if (!store) {
    return days.map((day) => ({
      day,
      visits: ram.days[day]?.visits || 0,
      anagrams: ram.days[day]?.anagrams || 0,
      strikes: ram.days[day]?.strikes || 0,
    }));
  }
  const rows: DayRow[] = [];
  for (const day of days) {
    const [visits, anagrams, strikes] = await Promise.all([
      store.get(`day:visits:${day}`),
      store.get(`day:anagrams:${day}`),
      store.get(`day:strikes:${day}`),
    ]);
    rows.push({
      day,
      visits: Number(visits) || 0,
      anagrams: Number(anagrams) || 0,
      strikes: Number(strikes) || 0,
    });
  }
  return rows;
}

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => {
        const store = await box();
        return Response.json(await read(store));
      },
      POST: async ({ request }) => {
        let kind: Kind = "visit";
        try {
          const body = (await request.json()) as { kind?: string };
          if (body.kind === "anagram") kind = "anagram";
          if (body.kind === "strike") kind = "strike";
        } catch {
          /* default visit */
        }
        const ip = ipOf(request);
        const now = Date.now();
        const prev = lastHit.get(ip) ?? { visit: 0, anagram: 0, strike: 0 };
        const store = await box();
        const cur = await read(store);
        if (kind === "visit") {
          if (now - prev.visit < 60_000) return Response.json(cur);
          lastHit.set(ip, { ...prev, visit: now });
          cur.visits += 1;
        } else if (kind === "strike") {
          if (now - prev.strike < 400) return Response.json(cur);
          lastHit.set(ip, { ...prev, strike: now });
          cur.strikes += 1;
        } else {
          if (now - prev.anagram < 8_000) return Response.json(cur);
          lastHit.set(ip, { ...prev, anagram: now });
          cur.anagrams += 1;
        }
        await write(store, cur);
        await bumpDay(store, kind);
        return Response.json(cur);
      },
    },
  },
});
