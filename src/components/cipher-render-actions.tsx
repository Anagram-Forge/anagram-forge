import { useEffect, useId, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEATURED_DEFAULT_CAPTION, FEATURED_MAX_BYTES } from "@/lib/featured-png";
import { soot } from "@/lib/palette";

type Featured = { id: string; caption: string; at: number };

/** Copy the canvas onto a solid background, optionally scaled down to maxW. */
function renderPng(cv: HTMLCanvasElement, maxW?: number): Promise<Blob | null> {
  const scale = maxW && cv.width > maxW ? maxW / cv.width : 1;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(cv.width * scale));
  out.height = Math.max(1, Math.round(cv.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = soot.bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cv, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob((b) => resolve(b), "image/png"));
}

/** Featured renders stay under the upload cap: try smaller widths until one fits. */
async function featurePng(cv: HTMLCanvasElement): Promise<Blob | null> {
  for (const w of [1600, 1200, 900, 640]) {
    const blob = await renderPng(cv, w);
    if (blob && blob.size <= FEATURED_MAX_BYTES) return blob;
  }
  return null;
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function CipherRenderActions({ canvas }: { canvas: RefObject<HTMLCanvasElement | null> }) {
  const [owner, setOwner] = useState(false);
  const [now, setNow] = useState<Featured | null>(null);
  const [prev, setPrev] = useState<Featured | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const captionId = useId();

  async function loadOwner() {
    const res = await fetch("/api/forge/featured?owner=1", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { now: Featured | null; prev: Featured | null };
    setNow(data.now);
    setPrev(data.prev);
    return true;
  }

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const s = await fetch("/api/forge/session", { cache: "no-store" });
        const who = (await s.json()) as { admin?: boolean };
        // The server checks again on every write; this only decides what to show.
        if (who.admin && live && (await loadOwner())) setOwner(true);
      } catch {
        /* stays hidden */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    const cv = canvas.current;
    if (!cv) return;
    const blob = await renderPng(cv);
    if (!blob) {
      setMsg("Couldn’t make the image.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cipher-${stamp()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg("Image saved.");
  }

  async function feature() {
    const cv = canvas.current;
    if (!cv) return;
    setBusy(true);
    setMsg("Putting it on the home page…");
    try {
      const blob = await featurePng(cv);
      if (!blob) {
        setMsg("The image came out over 2 MB.");
        return;
      }
      const cap = caption.trim() || FEATURED_DEFAULT_CAPTION;
      const res = await fetch(`/api/forge/featured?caption=${encodeURIComponent(cap)}`, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: blob,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; now?: Featured; prev?: Featured | null };
      if (!res.ok || !data.ok) {
        setMsg(data.reason || "Couldn’t feature it.");
        return;
      }
      setNow(data.now ?? null);
      setPrev(data.prev ?? null);
      setMsg("This render is on the home page now.");
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "revert" | "remove") {
    setBusy(true);
    try {
      const res = await fetch("/api/forge/featured", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; now?: Featured | null; prev?: Featured | null };
      if (!res.ok || !data.ok) {
        setMsg(data.reason || "Couldn’t.");
        return;
      }
      setNow(data.now ?? null);
      setPrev(data.prev ?? null);
      setMsg(action === "remove" ? "Card taken down. Go back brings it back." : "Home page card switched to the earlier render.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void save()}>
          Save image
        </Button>
        {owner ? (
          <Button variant="secondary" onClick={() => void feature()} disabled={busy}>
            Feature on home page
          </Button>
        ) : null}
      </div>
      {owner ? (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface/60 p-3">
          <div className="flex flex-col gap-2">
            <label htmlFor={captionId} className="text-xs uppercase tracking-wide text-subtle">
              Home page caption (only you see this)
            </label>
            <Input
              id={captionId}
              value={caption}
              maxLength={80}
              placeholder={FEATURED_DEFAULT_CAPTION}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted">
            {now ? `On the home page: “${now.caption}”, since ${new Date(now.at).toLocaleString()}.` : "Nothing on the home page."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={() => void act("remove")} disabled={busy || !now}>
              Take card down
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void act("revert")} disabled={busy || !prev}>
              Go back to earlier render
            </Button>
          </div>
        </div>
      ) : null}
      <p className="min-h-5 text-sm text-subtle" role="status" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
