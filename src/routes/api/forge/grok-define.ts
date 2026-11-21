import { createFileRoute } from "@tanstack/react-router";
import { featuredScope } from "@/lib/featured-png";
import { GROK_DEFINE_SYSTEM, grokDefine, type DefineKv } from "@/lib/grok-define-core";
import { clientIp, envGet } from "@/lib/turnstile";
import { visitorKey } from "@/lib/visitor-key";

const MODEL_FALLBACK = "grok-4-1-fast-non-reasoning";
/** Build-time branch, same split as the featured render: previews never share live keys. */
const SCOPE = featuredScope(typeof __AF_BRANCH__ === "string" ? __AF_BRANCH__ : "");

const mem = new Map<string, string>();
const memKv: DefineKv = {
  get: async (k) => mem.get(k) ?? null,
  put: async (k, v) => {
    mem.set(k, v);
  },
};

async function store(): Promise<DefineKv> {
  try {
    const mod = await import("cloudflare:workers");
    const box = (mod as { env?: { STATS?: DefineKv } }).env?.STATS;
    if (box && typeof box.get === "function") return box;
  } catch {
    /* dev */
  }
  return memKv;
}

/** Only the word goes to xAI. No cookies, ids, addresses, or page text. */
async function askGrok(word: string): Promise<string> {
  const key = await envGet("XAI_API_KEY");
  if (!key) throw new Error("not connected");
  const model = (await envGet("XAI_MODEL")) || MODEL_FALLBACK;
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: "system", content: GROK_DEFINE_SYSTEM },
        { role: "user", content: word },
      ],
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`xAI ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || "";
}

const REASONS = {
  "bad-word": "Only single words, letters only, up to 30.",
  busy: "Grok has had a lot of questions. Try again later.",
  failed: "Grok didn’t answer this time. Try again later.",
} as const;

export const Route = createFileRoute("/api/forge/grok-define")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { word?: unknown };
        try {
          body = (await request.json()) as { word?: unknown };
        } catch {
          return Response.json({ ok: false, reason: REASONS["bad-word"] }, { status: 400 });
        }
        const result = await grokDefine(body.word, {
          kv: await store(),
          ask: askGrok,
          scope: SCOPE,
          visitor: visitorKey(clientIp(request)),
        });
        const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
        if (!result.ok) return Response.json({ ok: false, reason: REASONS[result.reason] }, { status: result.status, headers });
        return Response.json({ ok: true, definition: result.definition, cached: result.cached }, { headers });
      },
    },
  },
});
