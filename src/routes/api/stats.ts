import { createFileRoute } from "@tanstack/react-router";

type Kind = "visit" | "anagram";
type Box = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const ram = { visits: 0, anagrams: 0 };
const lastHit = new Map<string, { visit: number; anagram: number }>();

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
  if (!box) return { visits: ram.visits, anagrams: ram.anagrams };
  const [visits, anagrams] = await Promise.all([box.get("visits"), box.get("anagrams")]);
  return {
    visits: Number(visits) || 0,
    anagrams: Number(anagrams) || 0,
  };
}

async function write(box: Box | null, next: { visits: number; anagrams: number }) {
  if (!box) {
    ram.visits = next.visits;
    ram.anagrams = next.anagrams;
    return;
  }
  await Promise.all([
    box.put("visits", String(next.visits)),
    box.put("anagrams", String(next.anagrams)),
  ]);
}

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => Response.json(await read(await box())),
      POST: async ({ request }) => {
        let kind: Kind = "visit";
        try {
          const body = (await request.json()) as { kind?: string };
          if (body.kind === "anagram") kind = "anagram";
        } catch {
          /* default visit */
        }
        const ip = ipOf(request);
        const now = Date.now();
        const prev = lastHit.get(ip) ?? { visit: 0, anagram: 0 };
        const store = await box();
        const cur = await read(store);
        if (kind === "visit") {
          if (now - prev.visit < 60_000) return Response.json(cur);
          lastHit.set(ip, { ...prev, visit: now });
          cur.visits += 1;
        } else {
          if (now - prev.anagram < 8_000) return Response.json(cur);
          lastHit.set(ip, { ...prev, anagram: now });
          cur.anagrams += 1;
        }
        await write(store, cur);
        return Response.json(cur);
      },
    },
  },
});
