export const ITCH =
  "https://alkakrab.itch.io/free-fantasy-medieval-ambient-music-pack";

export const BEDS = [
  { id: "emberlight", title: "Emberlight" },
  { id: "moonspire", title: "Moonspire" },
  { id: "winds-of-valor", title: "Winds of Valor" },
  { id: "darkwood-path", title: "Darkwood Path" },
  { id: "frostbound", title: "Frostbound" },
  { id: "silverbrook", title: "Silverbrook" },
  { id: "mystic-grove", title: "Mystic Grove" },
  { id: "throne-of-storms", title: "Throne of Storms" },
  { id: "sorrow-s-edge", title: "Sorrow's Edge" },
  { id: "elven-dawn", title: "Elven Dawn" },
] as const;

export type BedId = (typeof BEDS)[number]["id"];

const KEY_ON = "af-music";
const KEY_BED = "af-music-bed";
const KEY_VOL = "af-music-vol";

export type Snap = { on: boolean; id: BedId; volume: number; at: number; dur: number };

let bed: HTMLAudioElement | null = null;
let id: BedId = "emberlight";
let volume = 0.32;
const watchers = new Set<(s: Snap) => void>();

function srcOf(next: BedId) {
  if (import.meta.env.DEV) return `/sounds/${next}.mp3`;
  return `/api/forge/bed?id=${next}`;
}

function read<T>(key: string, fallback: T, parse: (v: string) => T | null): T {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return parse(v) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function isBed(v: string | null | undefined): v is BedId {
  return !!v && BEDS.some((b) => b.id === v);
}

let lastProg = 0;

function snap(): Snap {
  const at = bed?.currentTime || 0;
  const dur = bed && Number.isFinite(bed.duration) ? bed.duration : 0;
  return { on: Boolean(bed && !bed.paused), id, volume, at, dur };
}

function emit() {
  const s = snap();
  watchers.forEach((fn) => fn(s));
}

function el() {
  if (typeof window === "undefined") return null;
  if (!bed) {
    id = read(KEY_BED, "emberlight", (v) => (isBed(v) ? v : null));
    volume = read(KEY_VOL, 0.32, (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(0.7, Math.max(0.06, n)) : null;
    });
    bed = new Audio(srcOf(id));
    bed.loop = false;
    bed.preload = "auto";
    bed.volume = volume;
    bed.addEventListener("play", emit);
    bed.addEventListener("pause", emit);
    bed.addEventListener("ended", () => skip(1));
    bed.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - lastProg < 250) return;
      lastProg = now;
      emit();
    });
    bed.addEventListener("durationchange", emit);
  }
  return bed;
}

export function musicSnap(): Snap {
  if (typeof window === "undefined") return { on: false, id: "emberlight", volume: 0.32, at: 0, dur: 0 };
  el();
  return snap();
}

export function bedTitle(next: BedId = id) {
  return BEDS.find((b) => b.id === next)?.title ?? "Emberlight";
}

export function setMusic(on: boolean) {
  const a = el();
  if (!a) return;
  write(KEY_ON, on ? "1" : "0");
  if (on) void a.play().catch(() => {});
  else a.pause();
  emit();
}

export function setBed(next: BedId, play = true) {
  const a = el();
  if (!a || next === id) {
    if (play) setMusic(true);
    return;
  }
  id = next;
  write(KEY_BED, next);
  const keep = play || (a && !a.paused);
  a.pause();
  a.src = srcOf(next);
  a.loop = false;
  a.volume = volume;
  if (keep) void a.play().catch(() => {});
  emit();
}

export function skip(dir: -1 | 1) {
  const i = BEDS.findIndex((b) => b.id === id);
  const next = BEDS[(i + dir + BEDS.length) % BEDS.length];
  if (next) setBed(next.id, true);
}

export function seekMusic(ratio: number) {
  const a = el();
  if (!a) return;
  const dur = Number.isFinite(a.duration) ? a.duration : 0;
  if (dur <= 0) return;
  const t = Math.min(dur - 0.05, Math.max(0, ratio) * dur);
  try {
    a.currentTime = t;
  } catch {
    /* not seekable yet */
  }
  emit();
}

export function setVolume(next: number) {
  volume = Math.min(0.7, Math.max(0.06, next));
  write(KEY_VOL, String(volume));
  const a = el();
  if (a) a.volume = volume;
  emit();
}

export function watchMusic(fn: (s: Snap) => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}
