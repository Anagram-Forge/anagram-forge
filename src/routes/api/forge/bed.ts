import { createFileRoute } from "@tanstack/react-router";
import { BEDS, type BedId } from "@/lib/forge-music";

function isBed(v: string | null): v is BedId {
  return !!v && BEDS.some((b) => b.id === v);
}

async function media() {
  try {
    const mod = await import("cloudflare:workers");
    return (mod as { env?: { MEDIA?: { get: (key: string) => Promise<{ body: ReadableStream; size: number; httpEtag: string } | null> } } }).env
      ?.MEDIA;
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/api/forge/bed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id");
        if (!isBed(id)) return new Response("missing", { status: 404 });
        const key = `${id}.mp3`;
        const box = await media();
        if (box) {
          const obj = await box.get(key);
          if (!obj) return new Response("missing", { status: 404 });
          return new Response(obj.body, {
            headers: {
              "content-type": "audio/mpeg",
              "cache-control": "public, max-age=86400",
              etag: obj.httpEtag,
              "x-robots-tag": "noindex, nofollow",
            },
          });
        }
        const local = await fetch(new URL(`/sounds/${key}`, request.url));
        if (!local.ok) return new Response("missing", { status: 404 });
        return new Response(local.body, {
          headers: {
            "content-type": "audio/mpeg",
            "cache-control": "public, max-age=3600",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
