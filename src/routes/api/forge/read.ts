import { createFileRoute } from "@tanstack/react-router";
import { fillEtymology } from "@/lib/anagram/define";
import { parseReadNotes, readMessages, type ReadNote } from "@/lib/anagram/read-why";
import { userFromToken } from "@/lib/forge-db";
import { cachedRead, markRead, readsLeft, storeRead } from "@/lib/read-store";
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

async function ask(key: string, model: string, source: string, kept: string[], lines: string[], origins: { word: string; origin: string }[]): Promise<ReadNote[]> {
  const messages = readMessages({ source, kept, lines, origins });
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: "system", content: messages.system },
        { role: "user", content: messages.user },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail.slice(0, 180) || `xAI ${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content || "";
  return parseReadNotes(text, lines);
}

export const Route = createFileRoute("/api/forge/read")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });

        let body: { source?: string; kept?: unknown; lines?: unknown };
        try {
          body = (await request.json()) as { source?: string; kept?: unknown; lines?: unknown };
        } catch {
          return Response.json({ ok: false, reason: "Bad request." }, { status: 400 });
        }

        const source = String(body.source || "").replace(/\s+/g, " ").trim().slice(0, 80);
        const kept = Array.isArray(body.kept)
          ? [...new Set(body.kept.map((w) => cleanWord(String(w))).filter((w) => w.length >= 2))].slice(0, 5)
          : [];
        const lines = Array.isArray(body.lines)
          ? [...new Set(body.lines.map((w) => cleanLine(String(w))).filter(Boolean))].slice(0, 30)
          : [];
        if (!source || lines.length === 0) {
          return Response.json({ ok: false, reason: "Nothing to read yet." }, { status: 400 });
        }

        const cacheKey = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify({ source: source.toLowerCase(), kept, lines })),
        ).then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""));

        const cached = await cachedRead(cacheKey);
        if (cached) return Response.json({ ok: true, notes: cached, cached: true });

        const apiKey = await envGet("XAI_API_KEY");
        if (!apiKey) {
          return Response.json({ ok: false, reason: "The reading isn’t connected yet." }, { status: 503 });
        }

        const left = await readsLeft(user.handle);
        if (left <= 0) {
          return Response.json(
            { ok: false, reason: "That’s 12 for today. The door opens again tomorrow." },
            { status: 429 },
          );
        }

        const words = [...kept, ...source.split(/\s+/).map(cleanWord)].filter((w, i, all) => w.length >= 2 && all.indexOf(w) === i).slice(0, 8);
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
          const model = (await envGet("XAI_MODEL")) || MODEL_FALLBACK;
          const notes = await ask(apiKey, model, source, kept, lines, origins);
          await storeRead(cacheKey, notes);
          const remain = await markRead(user.handle);
          return Response.json({ ok: true, notes, cached: false, left: remain });
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
