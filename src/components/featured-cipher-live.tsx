import { useEffect, useRef } from "react";
import { FLOAT_ZOOM, renderCipherFrame, settingsToCipher, type Trails } from "@/lib/cipher-engine";
import type { CipherSettings } from "@/lib/featured-png";

/**
 * Live, transparent cipher for the home page floater. Loaded only when a
 * featured render exists and comes into view. Never rotates on drag.
 */
export function FeaturedCipherLive({
  settings,
  size,
  running,
  onReady,
  onFail,
}: {
  settings: CipherSettings;
  size: number;
  running: boolean;
  onReady: () => void;
  onFail: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const state = useRef(settingsToCipher(settings));
  const trails = useRef<Trails>({ key: "", pts: [] });
  const ready = useRef(false);
  const cbs = useRef({ onReady, onFail });
  cbs.current = { onReady, onFail };

  useEffect(() => {
    state.current = settingsToCipher(settings);
  }, [settings]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) {
      cbs.current.onFail();
      return;
    }
    if (!running && ready.current) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        const { props, view } = state.current;
        renderCipherFrame(ctx, cv, props, view, trails.current, ready.current ? dt : 0, { transparent: true, maxDpr: 2, zoom: FLOAT_ZOOM });
      } catch {
        cbs.current.onFail();
        return;
      }
      if (!ready.current) {
        ready.current = true;
        cbs.current.onReady();
      }
      if (running) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none block" style={{ width: size, height: size }} />;
}
