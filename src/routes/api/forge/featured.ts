import { createFileRoute } from "@tanstack/react-router";
import { FEATURED_MAX_BYTES } from "@/lib/featured-png";
import { readFeatured, removeFeatured, revertFeatured, setFeatured, type Result } from "@/lib/featured-store";
import { ownerOf, sameOrigin } from "@/lib/owner-gate";

const noStore = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

function reply(result: Result) {
  if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status, headers: noStore });
  return Response.json({ ok: true, now: result.now, prev: result.prev }, { headers: noStore });
}

/** Read the body but stop once it passes the cap. */
async function readCapped(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > FEATURED_MAX_BYTES) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > FEATURED_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}

export const Route = createFileRoute("/api/forge/featured")({
  server: {
    handlers: {
      /** Public: the current featured render (id, caption, size), or null. Owner also sees the earlier one. */
      GET: async ({ request }) => {
        const { now, prev } = await readFeatured();
        const wantsOwner = new URL(request.url).searchParams.get("owner") === "1";
        if (wantsOwner) {
          if (!(await ownerOf(request))) return new Response("Not found", { status: 404 });
          return Response.json({ ok: true, now, prev }, { headers: noStore });
        }
        return Response.json(
          { ok: true, featured: now },
          { headers: { "cache-control": "public, max-age=60", "x-robots-tag": "noindex, nofollow" } },
        );
      },
      /**
       * Owner only.
       *   image/png body           → feature it (?caption=…)
       *   {"action":"revert"}       → swap with the earlier render
       *   {"action":"remove"}       → take the card down (revert brings it back)
       */
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return new Response("Not found", { status: 404 });
        if (!(await ownerOf(request))) return new Response("Not found", { status: 404 });
        const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (type === "image/png") {
          const bytes = await readCapped(request);
          if (!bytes) return reply({ ok: false, reason: "Image is over 2 MB.", status: 413 });
          return reply(await setFeatured(bytes, new URL(request.url).searchParams.get("caption")));
        }
        if (type === "application/json") {
          let body: { action?: string };
          try {
            body = (await request.json()) as { action?: string };
          } catch {
            return Response.json({ ok: false }, { status: 400, headers: noStore });
          }
          if (body.action === "revert") return reply(await revertFeatured());
          if (body.action === "remove") return reply(await removeFeatured());
          return Response.json({ ok: false }, { status: 400, headers: noStore });
        }
        return reply({ ok: false, reason: "Send a PNG.", status: 415 });
      },
    },
  },
});
