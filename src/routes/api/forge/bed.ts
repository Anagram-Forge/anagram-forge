import { createFileRoute } from "@tanstack/react-router";
import { BEDS, type BedId } from "@/lib/forge-music";
import { isCloudflareWorker } from "@/lib/runtime";

function isBed(v: string | null): v is BedId {
  return !!v && BEDS.some((b) => b.id === v);
}

/** Preview copies. Production plays the mp3s in R2. */
const LOCAL_OGG: Record<BedId, string> = {
  moonspire: "1. Moonspire.ogg",
  "winds-of-valor": "2. Winds of Valor.ogg",
  "darkwood-path": "3. Darkwood Path.ogg",
  frostbound: "4. Frostbound.ogg",
  emberlight: "5. Emberlight.ogg",
  silverbrook: "6. Silverbrook.ogg",
  "mystic-grove": "7. Mystic Grove.ogg",
  "throne-of-storms": "8. Throne of Storms.ogg",
  "sorrow-s-edge": "9. Sorrow\u2019s Edge.ogg",
  "elven-dawn": "10. Elven Dawn.ogg",
};

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

async function previewBed(id: BedId, request: Request): Promise<Response | null> {
  if (isCloudflareWorker()) return null;
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "attachments", LOCAL_OGG[id]));
    const size = buf.byteLength;
    const range = parseRange(request.headers.get("range"), size);
    const headers: Record<string, string> = {
      "content-type": "audio/ogg",
      "accept-ranges": "bytes",
      "cache-control": "no-cache",
      "x-robots-tag": "noindex, nofollow",
    };
    if (range) {
      headers["content-range"] = `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`;
      headers["content-length"] = String(range.length);
      return new Response(buf.subarray(range.offset, range.offset + range.length), { status: 206, headers });
    }
    headers["content-length"] = String(size);
    return new Response(buf, { headers });
  } catch {
    return null;
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
        const disk = await previewBed(id, request);
        if (disk) return disk;
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
