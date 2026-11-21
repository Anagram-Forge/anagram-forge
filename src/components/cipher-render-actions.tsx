import { useEffect, useId, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FLOAT_ZOOM, transparentFrame, type CipherHandle } from "@/lib/cipher-engine";
import {
  FEATURED_DEFAULT_CAPTION,
  FEATURED_MAX_BYTES,
  easternStamp,
  type CipherSettings,
} from "@/lib/featured-png";

type Featured = { id: string; caption: string; at: number };

/** The home page floater draws in a square, so the poster is a square too. */
const POSTER_CSS = 400;

function toBlob(cv: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => cv.toBlob((b) => resolve(b), "image/png"));
}

/** Trim fully transparent edges, keeping a little air around the letters. */
function cropToInk(cv: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  const ctx = cv.getContext("2d");
  if (!ctx || !cv.width || !cv.height) return cv;
  const { data, width, height } = ctx.getImageData(0, 0, cv.width, cv.height);
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return cv;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")?.drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Transparent poster under the upload cap: lower the pixel ratio until it fits. */
async function posterPng(h: CipherHandle): Promise<Blob | null> {
  for (const dpr of [2, 1.5, 1]) {
    const blob = await toBlob(transparentFrame(h.props(), h.view(), POSTER_CSS, POSTER_CSS, dpr, FLOAT_ZOOM));
    if (blob && blob.size <= FEATURED_MAX_BYTES) return blob;
  }
  return null;
}

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function CipherRenderActions({
  handle,
  getSettings,
}: {
  handle: RefObject<CipherHandle | null>;
  getSettings: () => CipherSettings | null;
}) {
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
    const h = handle.current;
    if (!h) return;
    const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const frame = transparentFrame(h.props(), h.view(), h.canvas.clientWidth, h.canvas.clientHeight, dpr);
    const blob = await toBlob(cropToInk(frame, Math.round(24 * dpr)));
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
    setMsg("Image saved, with a clear background.");
  }

  async function feature() {
    const h = handle.current;
    const settings = getSettings();
    if (!h || !settings) return;
    setBusy(true);
    setMsg("Putting it on the home page…");
    try {
      const blob = await posterPng(h);
      if (!blob) {
        setMsg("The image came out over 2 MB.");
        return;
      }
      const form = new FormData();
      form.append("poster", new File([blob], "poster.png", { type: "image/png" }));
      form.append("settings", JSON.stringify(settings));
      form.append("caption", caption.trim() || FEATURED_DEFAULT_CAPTION);
      const res = await fetch("/api/forge/featured", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; now?: Featured; prev?: Featured | null };
      if (!res.ok || !data.ok) {
        setMsg(data.reason || "Couldn’t feature it.");
        return;
      }
      setNow(data.now ?? null);
      setPrev(data.prev ?? null);
      setMsg("This render is on the home page now, moving as it is here.");
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
      setMsg(action === "remove" ? "Taken off the home page. Go back brings it back." : "Home page switched to the earlier render.");
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
            {now ? `On the home page: “${now.caption}”, since ${easternStamp(now.at)}.` : "Nothing on the home page."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" size="sm" onClick={() => void act("remove")} disabled={busy || !now}>
              Take it down
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
