import { createHash, timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { doorCookie, readDoorIds } from "@/lib/door-cookie";
import { DOOR_LEDGER } from "@/lib/door-ledger";
import { bumpWayVisit } from "@/lib/way-stats";

/**
 * Gates are env secrets, not code.
 *   DOOR_HASH          → id "way"
 *   DOOR_HASH_IRON     → id "iron"   (add later, no code change to the matcher)
 *   DOOR_HASH_VOICE    → id "voice"
 * Value is sha256 hex of `${packedRack}|${phrase}` (lowercase a-z rack, words joined by space).
 * Then add a VAULT[id] entry for the page copy.
 */

type Quest = { kicker: string; title: string; note: string; open: boolean };
type Page = { sign: string; title: string; blurb: string; quests: Quest[] };

const VAULT: Record<string, Page> = {
  way: {
    sign: "The Way",
    title: "The Way",
    blurb: "You arranged two. More doors later. Quiet on purpose.",
    quests: [
      { kicker: "Quest 1 · open", title: "Arrange two", note: "The gate you just walked through.", open: true },
      { kicker: "Quest 2 · locked", title: "Iron and fire", note: "Not yet. The anvil knows.", open: false },
      { kicker: "Quest 3 · locked", title: "A still small voice", note: "Later.", open: false },
    ],
  },
};

const lastTry = new Map<string, number[]>();

function pack(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function phraseOf(picks: unknown) {
  if (!Array.isArray(picks)) return "";
  return picks
    .map((w) => String(w).toLowerCase().trim())
    .filter(Boolean)
    .join(" ");
}

function digest(rack: string, phrase: string) {
  return createHash("sha256").update(`${rack}|${phrase}`).digest("hex");
}

function sameHash(a: string, b: string) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function ipOf(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

function throttled(ip: string) {
  const now = Date.now();
  const hits = (lastTry.get(ip) || []).filter((t) => now - t < 60_000);
  if (hits.length >= 10) {
    lastTry.set(ip, hits);
    return true;
  }
  hits.push(now);
  lastTry.set(ip, hits);
  return false;
}

async function secrets(): Promise<{ id: string; hash: string }[]> {
  const bag: Record<string, unknown> = {
    ...(typeof process !== "undefined" ? process.env : {}),
  };
  try {
    const mod = await import("cloudflare:workers");
    Object.assign(bag, (mod as { env?: Record<string, unknown> }).env || {});
  } catch {
    /* preview */
  }
  const found = new Map<string, string>();
  for (const [k, v] of Object.entries(bag)) {
    if (typeof v !== "string" || !v.trim()) continue;
    let id = "";
    if (k === "DOOR_HASH" || k === "DOOR_HASH_WAY") id = "way";
    else {
      const m = /^DOOR_HASH_([A-Z][A-Z0-9]{0,24})$/.exec(k);
      if (m) id = m[1].toLowerCase();
    }
    if (!id) continue;
    const hash = v.trim().toLowerCase();
    if (/^[0-9a-f]{64}$/.test(hash)) found.set(id, hash);
  }
  return [...found].map(([id, hash]) => ({ id, hash }));
}

export const Route = createFileRoute("/api/forge/door")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ids = readDoorIds(request);
        const doors = ids.map((id) => (VAULT[id] ? { id, ...VAULT[id] } : null)).filter(Boolean);
        if (!doors.length) return Response.json({ ok: false }, { status: 404 });
        if (ids.includes("way")) await bumpWayVisit(request);
        return Response.json(
          { ok: true, doors },
          { headers: { "x-robots-tag": "noindex, nofollow" } },
        );
      },
      POST: async ({ request }) => {
        if (throttled(ipOf(request))) return Response.json({ ok: false }, { status: 429 });
        let body: { source?: string; picks?: string[] };
        try {
          body = (await request.json()) as { source?: string; picks?: string[] };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const rack = pack(String(body.source || ""));
        const phrase = phraseOf(body.picks);
        if (rack.length < 4 || !phrase) return Response.json({ ok: false });
        const got = digest(rack, phrase);
        const keys = await secrets();
        let hit = keys.find((k) => sameHash(k.hash, got));
        if (!hit && import.meta.env.DEV) {
          const row = DOOR_LEDGER.find((d) => pack(d.rack) === rack && d.phrase === phrase);
          if (row) hit = { id: row.id, hash: got };
        }
        if (!hit) return Response.json({ ok: false });
        const page = VAULT[hit.id];
        const ids = [...readDoorIds(request), hit.id];
        return new Response(
          JSON.stringify({ ok: true, id: hit.id, sign: page?.sign || hit.id }),
          {
            headers: {
              "content-type": "application/json",
              "set-cookie": doorCookie(ids, request),
              "x-robots-tag": "noindex, nofollow",
            },
          },
        );
      },
    },
  },
});
