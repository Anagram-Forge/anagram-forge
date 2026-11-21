import { createFileRoute } from "@tanstack/react-router";
import { featuredImage } from "@/lib/featured-store";

export const Route = createFileRoute("/api/forge/featured-image")({
  server: {
    handlers: {
      /** The current featured render. Ids never repeat, so a hit can be cached for good. */
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") || "";
        const img = await featuredImage(id);
        if (!img) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
        return new Response(img.body, {
          headers: {
            "content-type": "image/png",
            "content-length": String(img.size),
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; sandbox",
            "cross-origin-resource-policy": "same-origin",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
