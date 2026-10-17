import { Music, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ITCH,
  bedTitle,
  musicSnap,
  seekMusic,
  setMusic,
  setVolume,
  skip,
  watchMusic,
  type Snap,
} from "@/lib/forge-music";
import { cn } from "@/lib/utils";

const LINGER = 2000;

export function ForgeMusicToggle() {
  const [snap, setSnap] = useState<Snap>({ on: false, id: "emberlight", volume: 0.35, at: 0, dur: 0 });
  const [armed, setArmed] = useState(false);
  const [hover, setHover] = useState(false);
  const hold = useRef(0);
  const hide = useRef(0);
  const held = useRef(false);

  useEffect(() => {
    setSnap(musicSnap());
    return watchMusic(setSnap);
  }, []);

  useEffect(() => () => window.clearTimeout(hide.current), []);

  function stay() {
    window.clearTimeout(hide.current);
    if (armed) setHover(true);
  }

  function leave() {
    window.clearTimeout(hide.current);
    hide.current = window.setTimeout(() => setHover(false), LINGER);
  }

  const show = armed && hover;
  const p = snap.dur > 0 ? Math.min(1, snap.at / snap.dur) : 0;
  const ring = 2 * Math.PI * 11;

  return (
    <div className="relative z-[80]" onMouseEnter={stay} onMouseLeave={leave}>
      <button
        type="button"
        aria-pressed={snap.on}
        aria-label={snap.on ? `Pause ${bedTitle(snap.id)}` : "Play music"}
        onClick={() => {
          if (held.current) {
            held.current = false;
            return;
          }
          setArmed(true);
          setMusic(!snap.on);
        }}
        onPointerDown={() => {
          window.clearTimeout(hold.current);
          hold.current = window.setTimeout(() => {
            held.current = true;
            setArmed(true);
            setHover(true);
            window.clearTimeout(hide.current);
            hide.current = window.setTimeout(() => setHover(false), LINGER);
          }, 420);
        }}
        onPointerUp={() => window.clearTimeout(hold.current)}
        onPointerCancel={() => window.clearTimeout(hold.current)}
        className={cn(
          "inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 hover:bg-raised",
          snap.on ? "text-accent" : "text-muted hover:text-fg",
        )}
      >
        <span className="relative grid size-7 place-items-center">
          {snap.on || p > 0.01 ? (
            <svg className="absolute inset-0" viewBox="0 0 28 28" aria-hidden>
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                className="stroke-accent/25"
                strokeWidth="1.25"
              />
              <circle
                cx="14"
                cy="14"
                r="11"
                fill="none"
                className="stroke-accent"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - p)}
                transform="rotate(-90 14 14)"
              />
            </svg>
          ) : null}
          <Music className="size-4" />
        </span>
      </button>
      {show ? (
        <div className="absolute right-0 z-[80] pt-1">
          <div className="pointer-events-auto w-44 rounded-md border border-border bg-surface px-2.5 py-2 shadow-md">
            <p className="truncate text-[11px] text-muted">{bedTitle(snap.id)}</p>
            <div
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p * 100)}
              className="relative mt-1.5 h-3 w-full cursor-pointer rounded-full bg-border"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                if (r.width <= 0) return;
                seekMusic((e.clientX - r.left) / r.width);
              }}
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-accent"
                style={{ width: `${Math.round(p * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-center gap-0.5">
              <button
                type="button"
                aria-label="Previous"
                onClick={() => skip(-1)}
                className="grid size-8 place-items-center rounded-sm text-subtle hover:text-fg"
              >
                <SkipBack className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={snap.on ? "Pause" : "Play"}
                onClick={() => setMusic(!snap.on)}
                className="grid size-8 place-items-center rounded-sm text-fg"
              >
                {snap.on ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() => skip(1)}
                className="grid size-8 place-items-center rounded-sm text-subtle hover:text-fg"
              >
                <SkipForward className="size-3.5" />
              </button>
            </div>
            <input
              type="range"
              min={6}
              max={70}
              value={Math.round(snap.volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="mt-1.5 h-1 w-full accent-[var(--accent)]"
              aria-label="Volume"
            />
            <a
              href={ITCH}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 block text-[10px] text-subtle hover:text-muted"
            >
              AlkaKrab
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
