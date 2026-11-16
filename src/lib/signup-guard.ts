import { visitorKey } from "@/lib/visitor-key";

/** Successful handles one network may create in a UTC day. */
export const SIGNUP_DAY = 3;
/** Captcha-passed tries one network may make in an hour, success or not. */
export const SIGNUP_HOUR = 12;

export const SIGNUP_DAY_MSG = "This network already made 3 handles today. Try again tomorrow.";
export const SIGNUP_HOUR_MSG = "Too many tries from this network. Wait an hour.";

type Kv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
};

const mem = new Map<string, string>();

async function kv(): Promise<Kv | null> {
  try {
    const mod = await import("cloudflare:workers");
    const box = (mod as { env?: { STATS?: Kv } }).env?.STATS;
    if (box && typeof box.get === "function") return box;
  } catch {
    /* preview */
  }
  return null;
}

function id(ip: string): string {
  return visitorKey(ip);
}

async function read(key: string): Promise<string | null> {
  const box = await kv();
  if (box) return box.get(key);
  return mem.get(key) ?? null;
}

async function write(key: string, value: string): Promise<void> {
  const box = await kv();
  if (box) {
    await box.put(key, value);
    return;
  }
  mem.set(key, value);
}

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function signupBlocked(ip: string): Promise<string | null> {
  const who = id(ip);
  const creates = Number((await read(`sup:day:${who}:${dayStamp()}`)) || "0") || 0;
  if (creates >= SIGNUP_DAY) return SIGNUP_DAY_MSG;
  const raw = await read(`sup:hour:${who}`);
  if (!raw) return null;
  try {
    const hour = JSON.parse(raw) as { n?: number; start?: number };
    if (hour.start && Date.now() - hour.start < 60 * 60 * 1000 && (hour.n || 0) >= SIGNUP_HOUR) {
      return SIGNUP_HOUR_MSG;
    }
  } catch {
    return null;
  }
  return null;
}

export async function signupAttempted(ip: string): Promise<void> {
  const who = id(ip);
  const key = `sup:hour:${who}`;
  const now = Date.now();
  let n = 1;
  let start = now;
  const raw = await read(key);
  if (raw) {
    try {
      const hour = JSON.parse(raw) as { n?: number; start?: number };
      if (hour.start && now - hour.start < 60 * 60 * 1000) {
        n = (hour.n || 0) + 1;
        start = hour.start;
      }
    } catch {
      /* start a fresh hour */
    }
  }
  await write(key, JSON.stringify({ n, start }));
}

export async function signupCreated(ip: string): Promise<void> {
  const key = `sup:day:${id(ip)}:${dayStamp()}`;
  const n = (Number((await read(key)) || "0") || 0) + 1;
  await write(key, String(n));
}
