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

const KEY_ON = "af-music-on";
const KEY_AT = "af-music-at";
const KEY_BED = "af-music-bed";
const KEY_VOL = "af-music-vol";

const DEFAULT_VOL = 0.35;
const FADE_PLAY = 1;
const FADE_PAUSE = 2;
const FADE_VOL = 0.08;
const FADE_RESUME = 0.12;

export type Snap = { on: boolean; id: BedId; volume: number; at: number; dur: number };

let bed: HTMLAudioElement | null = null;
let id: BedId = "emberlight";
let volume = DEFAULT_VOL;
let wanted = false;
let lettingGo = false;
let op = 0;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
const watchers = new Set<(s: Snap) => void>();

function srcOf(next: BedId) {
  return `/api/forge/bed?id=${next}`;
}

function readStore<T>(store: Storage, key: string, fallback: T, parse: (v: string) => T | null): T {
  try {
    const v = store.getItem(key);
    if (v == null) return fallback;
    return parse(v) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStore(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function read<T>(key: string, fallback: T, parse: (v: string) => T | null): T {
  return readStore(localStorage, key, fallback, parse);
}

function write(key: string, value: string) {
  writeStore(localStorage, key, value);
}

function readSession<T>(key: string, fallback: T, parse: (v: string) => T | null): T {
  return readStore(sessionStorage, key, fallback, parse);
}

function writeSession(key: string, value: string) {
  writeStore(sessionStorage, key, value);
}

function isBed(v: string | null | undefined): v is BedId {
  return !!v && BEDS.some((b) => b.id === v);
}

function clampVol(n: number) {
  return Math.min(0.7, Math.max(0.06, n));
}

let lastProg = 0;
let lockAt = false;

function saveAt(a: HTMLAudioElement | null = bed) {
  if (!a || lockAt) return;
  writeSession(KEY_AT, String(a.currentTime || 0));
}

function snap(): Snap {
  const at = bed?.currentTime || 0;
  const dur = bed && Number.isFinite(bed.duration) ? bed.duration : 0;
  return { on: wanted, id, volume, at, dur };
}

function emit() {
  const s = snap();
  watchers.forEach((fn) => fn(s));
}

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Route the element through a gain node. The file is never rewritten. */
function ensureGraph(a: HTMLAudioElement): boolean {
  if (gain && ctx) {
    a.volume = 1;
    return true;
  }
  const c = audioContext();
  if (!c) return false;
  try {
    const node = c.createGain();
    node.gain.value = 0;
    node.connect(c.destination);
    const source = c.createMediaElementSource(a);
    source.connect(node);
    gain = node;
    a.volume = 1;
    return true;
  } catch {
    return false;
  }
}

/**
 * Cancel the ramp already on the clock, hold the gain where it is now,
 * then linear-ramp to the target. `from` forces a known start (silence).
 */
function rampTo(target: number, seconds: number, from?: number) {
  const level = target <= 0 ? 0 : clampVol(target);
  if (!ctx || !gain) {
    if (bed) bed.volume = level;
    return;
  }
  const p = gain.gain;
  const now = ctx.currentTime;
  const end = now + Math.max(0.015, seconds);
  try {
    if (from == null && typeof p.cancelAndHoldAtTime === "function") {
      p.cancelAndHoldAtTime(now);
    } else {
      p.cancelScheduledValues(now);
      p.setValueAtTime(from ?? p.value, now);
    }
    p.linearRampToValueAtTime(level, end);
  } catch {
    try {
      p.cancelScheduledValues(now);
      p.setValueAtTime(from ?? p.value, now + 0.02);
      p.linearRampToValueAtTime(level, Math.max(end, now + 0.05));
    } catch {
      p.value = level;
    }
  }
}

function playFade(a: HTMLAudioElement, seconds: number) {
  const mine = ++op;
  const fresh = a.paused;
  lettingGo = false;
  wanted = true;
  writeSession(KEY_ON, "1");
  const graphed = ensureGraph(a);
  const arm = () => {
    if (mine !== op) return;
    if (graphed) rampTo(volume, seconds, fresh ? 0 : undefined);
    else a.volume = volume;
  };
  if (ctx && ctx.state !== "running") void ctx.resume().then(arm);
  else arm();
  emit();
  if (!a.paused) return;
  void a.play().then(
    () => {
      if (mine !== op) return;
      emit();
    },
    () => {
      if (mine !== op) return;
      wanted = false;
      writeSession(KEY_ON, "0");
      if (gain && ctx) {
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime);
        } catch {
          gain.gain.value = 0;
        }
      }
      emit();
    },
  );
}

function pauseFade(a: HTMLAudioElement) {
  if (!wanted && a.paused) return;
  const mine = ++op;
  wanted = false;
  writeSession(KEY_ON, "0");
  saveAt(a);
  if (!ensureGraph(a) || a.paused) {
    a.pause();
    lettingGo = false;
    emit();
    return;
  }
  lettingGo = true;
  if (ctx?.state === "suspended") void ctx.resume();
  rampTo(0, FADE_PAUSE);
  window.setTimeout(() => {
    if (mine !== op) return;
    a.pause();
    lettingGo = false;
    saveAt(a);
    emit();
  }, FADE_PAUSE * 1000);
  emit();
}

function place(a: HTMLAudioElement, at: number) {
  if (!(at > 0)) return;
  const dur = Number.isFinite(a.duration) ? a.duration : 0;
  const t = dur > 0 ? Math.min(at, Math.max(0, dur - 0.05)) : at;
  try {
    a.currentTime = t;
  } catch {
    /* not seekable yet */
  }
}

function el() {
  if (typeof window === "undefined") return null;
  if (!bed) {
    id = read(KEY_BED, "emberlight", (v) => (isBed(v) ? v : null));
    volume = read(KEY_VOL, DEFAULT_VOL, (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? clampVol(n) : null;
    });
    const resumeAt = readSession(KEY_AT, 0, (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    });
    const resumeOn = readSession(KEY_ON, "0", (v) => (v === "1" || v === "0" ? v : null)) === "1";
    lockAt = resumeOn;
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
      saveAt(bed);
      emit();
    });
    bed.addEventListener("durationchange", emit);
    window.addEventListener("pagehide", () => saveAt(bed));
    if (resumeOn) {
      const kick = () => {
        if (!bed) return;
        place(bed, resumeAt);
        lockAt = false;
        if (!wanted) playFade(bed, FADE_RESUME);
      };
      if (bed.readyState >= 1) kick();
      else bed.addEventListener("loadedmetadata", kick, { once: true });
    }
  }
  return bed;
}

export function musicSnap(): Snap {
  if (typeof window === "undefined") return { on: false, id: "emberlight", volume: DEFAULT_VOL, at: 0, dur: 0 };
  el();
  return snap();
}

export function bedTitle(next: BedId = id) {
  return BEDS.find((b) => b.id === next)?.title ?? "Emberlight";
}

export function setMusic(on: boolean) {
  const a = el();
  if (!a) return;
  if (on) {
    if (wanted && !a.paused && !lettingGo) return;
    playFade(a, FADE_PLAY);
  } else {
    pauseFade(a);
  }
}

export function setBed(next: BedId, play = true) {
  const a = el();
  if (!a || next === id) {
    if (play) setMusic(true);
    return;
  }
  id = next;
  write(KEY_BED, next);
  const keep = play || wanted;
  op += 1;
  lettingGo = false;
  if (!keep) wanted = false;
  a.pause();
  if (gain && ctx) {
    const now = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
    } catch {
      gain.gain.value = 0;
    }
  }
  a.src = srcOf(next);
  a.loop = false;
  if (keep) playFade(a, FADE_PLAY);
  else {
    wanted = false;
    writeSession(KEY_ON, "0");
    emit();
  }
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
  saveAt(a);
  emit();
}

export function setVolume(next: number) {
  volume = clampVol(next);
  write(KEY_VOL, String(volume));
  const a = el();
  if (a && wanted && !lettingGo && !a.paused) rampTo(volume, FADE_VOL);
  emit();
}

export function watchMusic(fn: (s: Snap) => void) {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}
