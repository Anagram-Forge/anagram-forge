import { createFileRoute } from "@tanstack/react-router";
import { BEDS, type BedId } from "@/lib/forge-music";

function isBed(v: string | null): v is BedId {
  return !!v && BEDS.some((b) => b.id === v);
}

async function media() {
  try {
    const mod = await import("cloudflare:workers");
    return (mod as { env?: { MEDIA?: { get: (key: string, opts?: { range?: { offset: number; length?: number } }) => Promise<{ body: ReadableStream; size: number; httpEtag: string } | null> } } }).env
      ?.MEDIA;
  } catch {
    return undefined;
  }
}

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const m = /^bytes=(\d+)-(\d*)$/i.exec(header.trim());
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : size - 1;
  if (!Number.isFinite(start) || start < 0 || start >= size) return null;
  return { offset: start, length: Math.min(end, size - 1) - start + 1 };
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
          const rangeH = request.headers.get("range");
          const probe = await box.get(key, rangeH ? { range: { offset: 0, length: 1 } } : undefined);
          if (!probe) return new Response("missing", { status: 404 });
          const size = probe.size;
          const range = parseRange(rangeH, size);
          const obj = range ? await box.get(key, { range }) : probe;
          if (!obj) return new Response("missing", { status: 404 });
          const headers: Record<string, string> = {
            "content-type": "audio/mpeg",
            "accept-ranges": "bytes",
            "cache-control": "public, max-age=86400",
            etag: obj.httpEtag,
            "x-robots-tag": "noindex, nofollow",
          };
          if (range) {
            headers["content-range"] = `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`;
            headers["content-length"] = String(range.length);
            return new Response(obj.body, { status: 206, headers });
          }
          headers["content-length"] = String(size);
          return new Response(obj.body, { headers });
        }
        const local = await fetch(new URL(`/sounds/${key}`, request.url));
        if (!local.ok) return new Response("missing", { status: 404 });
        const buf = await local.arrayBuffer();
        return new Response(buf, {
          headers: {
            "content-type": "audio/mpeg",
            "content-length": String(buf.byteLength),
            "accept-ranges": "bytes",
            "cache-control": "public, max-age=3600",
            "x-robots-tag": "noindex, nofollow",
          },
        });
      },
    },
  },
});
