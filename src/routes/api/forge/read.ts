import { createFileRoute } from "@tanstack/react-router";
import { fillEtymology } from "@/lib/anagram/define";
import {
  followMessages,
  parseFollow,
  parseReading,
  readMessages,
  type ReadNote,
} from "@/lib/anagram/read-why";
import { userFromToken } from "@/lib/forge-db";
import {
  LIMIT_LINE,
  cachedFollow,
  cachedReading,
  markRead,
  readsLeft,
  storeFollow,
  storeReading,
} from "@/lib/read-store";
import { envGet } from "@/lib/turnstile";

const MODEL_FALLBACK = "grok-4-1-fast-non-reasoning";

function cookieOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function cleanWord(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z]/g, "").slice(0, 21);
}

function cleanLine(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

function cleanAbout(raw: unknown): string {
  return String(raw || "").replace(/\s+/g, " ").trim().slice(0, 400);
}

async function digest(value: unknown): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function complete(key: string, model: string, system: string, user: string, max: number): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: max,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail.slice(0, 180) || `xAI ${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || "";
}

export const Route = createFileRoute("/api/forge/read")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ ok: false, signedIn: false });
        return Response.json({ ok: true, signedIn: true, left: await readsLeft(user.handle) });
      },
      POST: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });

        let body: {
          source?: string;
          kept?: unknown;
          lines?: unknown;
          about?: unknown;
          question?: unknown;
          notes?: unknown;
          earlier?: unknown;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ ok: false, reason: "Bad request." }, { status: 400 });
        }

        const source = String(body.source || "").replace(/\s+/g, " ").trim().slice(0, 80);
        const about = cleanAbout(body.about);
        const kept = Array.isArray(body.kept)
          ? [...new Set(body.kept.map((w) => cleanWord(String(w))).filter((w) => w.length >= 2))].slice(0, 5)
          : [];
        const lines = Array.isArray(body.lines)
          ? [...new Set(body.lines.map((w) => cleanLine(String(w))).filter(Boolean))].slice(0, 240)
          : [];
        if (!source) return Response.json({ ok: false, reason: "Nothing to read yet." }, { status: 400 });

        const apiKey = await envGet("XAI_API_KEY");
        if (!apiKey) {
          return Response.json({ ok: false, reason: "The reading isn’t connected yet." }, { status: 503 });
        }
        const model = (await envGet("XAI_MODEL")) || MODEL_FALLBACK;
        const question = String(body.question || "").replace(/\s+/g, " ").trim().slice(0, 240);

        if (question) {
          const notes = Array.isArray(body.notes)
            ? body.notes
                .map((item) => {
                  if (!item || typeof item !== "object") return null;
                  const line = cleanLine(String((item as { line?: unknown }).line || ""));
                  const why = String((item as { why?: unknown }).why || "").replace(/\s+/g, " ").trim().slice(0, 240);
                  return line && why ? { line, why } : null;
                })
                .filter((item): item is ReadNote => !!item)
                .slice(0, 10)
            : [];
          const earlier = Array.isArray(body.earlier)
            ? body.earlier
                .map((item) => {
                  if (!item || typeof item !== "object") return null;
                  const q = String((item as { q?: unknown }).q || "").replace(/\s+/g, " ").trim().slice(0, 240);
                  const a = String((item as { a?: unknown }).a || "").replace(/\s+/g, " ").trim().slice(0, 400);
                  return q && a ? { q, a } : null;
                })
                .filter((item): item is { q: string; a: string } => !!item)
                .slice(-4)
            : [];
          const cacheKey = await digest({ source: source.toLowerCase(), about, notes, earlier, question });
          const cached = await cachedFollow(cacheKey);
          if (cached) return Response.json({ ok: true, reply: cached, cached: true, left: await readsLeft(user.handle) });
          const left = await readsLeft(user.handle);
          if (left <= 0) return Response.json({ ok: false, reason: LIMIT_LINE, left: 0 }, { status: 429 });
          try {
            const messages = followMessages({ source, about, notes, question, earlier });
            const reply = parseFollow(await complete(apiKey, model, messages.system, messages.user, 220));
            if (!reply) return Response.json({ ok: false, reason: "The reading didn’t come back." }, { status: 502 });
            await storeFollow(cacheKey, reply);
            const remain = await markRead(user.handle);
            return Response.json({ ok: true, reply, cached: false, left: remain });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            const reason = /model/i.test(msg)
              ? "That model name was refused. Set XAI_MODEL on the project."
              : "The reading didn’t come back.";
            return Response.json({ ok: false, reason }, { status: 502 });
          }
        }

        if (lines.length === 0) {
          return Response.json({ ok: false, reason: "Nothing to read yet." }, { status: 400 });
        }

        const cacheKey = await digest({ source: source.toLowerCase(), kept, lines, about });
        const cached = await cachedReading(cacheKey);
        if (cached) {
          return Response.json({
            ok: true,
            context: about ? cached.context : "",
            notes: cached.notes,
            order: about ? cached.order || [] : [],
            cached: true,
            left: await readsLeft(user.handle),
          });
        }
        const left = await readsLeft(user.handle);
        if (left <= 0) return Response.json({ ok: false, reason: LIMIT_LINE, left: 0 }, { status: 429 });

        const words = [...kept, ...source.split(/\s+/).map(cleanWord)]
          .filter((w, i, all) => w.length >= 2 && all.indexOf(w) === i)
          .slice(0, 8);
        const origins = (
          await Promise.all(
            words.map(async (word) => {
              try {
                const origin = await Promise.race([
                  fillEtymology(word),
                  new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 2500)),
                ]);
                return origin ? { word, origin: origin.slice(0, 280) } : null;
              } catch {
                return null;
              }
            }),
          )
        ).filter((row): row is { word: string; origin: string } => !!row);

        try {
          const messages = readMessages({ source, kept, lines, origins, about });
          const reading = parseReading(await complete(apiKey, model, messages.system, messages.user, 1400), lines);
          if (!about) {
            reading.context = "";
            reading.order = [];
          }
          await storeReading(cacheKey, reading);
          const remain = await markRead(user.handle);
          return Response.json({ ok: true, ...reading, cached: false, left: remain });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          const reason = /model/i.test(msg)
            ? "That model name was refused. Set XAI_MODEL on the project."
            : "The reading didn’t come back.";
          return Response.json({ ok: false, reason }, { status: 502 });
        }
      },
    },
  },
});
