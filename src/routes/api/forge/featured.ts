import { createFileRoute } from "@tanstack/react-router";
import { FEATURED_MAX_BYTES } from "@/lib/featured-png";
import { readFeatured, removeFeatured, revertFeatured, setFeatured, type Result } from "@/lib/featured-store";
import { featuredPublic, ownerOf, sameOrigin } from "@/lib/owner-gate";

const noStore = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

function reply(result: Result) {
  if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status, headers: noStore });
  return Response.json({ ok: true, now: result.now, prev: result.prev }, { headers: noStore });
}

/** Poster cap plus room for the settings and caption fields. */
const FORM_MAX = FEATURED_MAX_BYTES + 16 * 1024;

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
        // Off by default: until FEATURED_PUBLIC is on, only the steward can read it.
        if (!(await featuredPublic()) && !(await ownerOf(request))) {
          return new Response("Not found", { status: 404, headers: noStore });
        }
        return Response.json(
          { ok: true, featured: now },
          { headers: { "cache-control": "public, max-age=60", "x-robots-tag": "noindex, nofollow" } },
        );
      },
      /**
       * Owner only.
       *   multipart/form-data      → feature it: poster (transparent PNG), settings (JSON), caption
       *   {"action":"revert"}       → swap with the earlier render
       *   {"action":"remove"}       → take the card down (revert brings it back)
       */
      POST: async ({ request }) => {
        if (!sameOrigin(request)) return new Response("Not found", { status: 404 });
        if (!(await ownerOf(request))) return new Response("Not found", { status: 404 });
        const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (type === "multipart/form-data") {
          // Workers buffer form bodies, so insist on a declared size under the cap first.
          const declared = Number(request.headers.get("content-length") || "0");
          if (!declared) return reply({ ok: false, reason: "Missing size.", status: 411 });
          if (declared > FORM_MAX) return reply({ ok: false, reason: "Image is over 2 MB.", status: 413 });
          let form: FormData;
          try {
            form = await request.formData();
          } catch {
            return reply({ ok: false, reason: "Bad upload.", status: 400 });
          }
          const poster = form.get("poster");
          const rawSettings = form.get("settings");
          if (!poster || typeof poster === "string" || poster.type !== "image/png") {
            return reply({ ok: false, reason: "Send a PNG.", status: 415 });
          }
          if (poster.size > FEATURED_MAX_BYTES) return reply({ ok: false, reason: "Image is over 2 MB.", status: 413 });
          if (typeof rawSettings !== "string" || rawSettings.length > 4096) {
            return reply({ ok: false, reason: "Those cipher settings didn’t check out.", status: 400 });
          }
          let settings: unknown;
          try {
            settings = JSON.parse(rawSettings);
          } catch {
            return reply({ ok: false, reason: "Those cipher settings didn’t check out.", status: 400 });
          }
          const bytes = new Uint8Array(await poster.arrayBuffer());
          return reply(await setFeatured(bytes, typeof form.get("caption") === "string" ? form.get("caption") : "", settings));
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
