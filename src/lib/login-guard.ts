/** App-level lock after repeated sign-in failures. Cloudflare still rate-limits the route. */

export const SIGN_IN_FAIL = "Couldn't sign in";
export const FAIL_LIMIT = 5;
export const LOCK_MS = 15 * 60 * 1000;

export type FailState = { n: number; lockUntil: number };

export function isLocked(state: FailState | null, now: number): boolean {
  return !!state && state.lockUntil > now;
}

/** Count one more miss. A lock that has already expired starts over at 1. */
export function recordFail(state: FailState | null, now: number): FailState {
  const expired = !!state && state.lockUntil > 0 && state.lockUntil <= now;
  const n = (state && !expired ? state.n : 0) + 1;
  return { n, lockUntil: n >= FAIL_LIMIT ? now + LOCK_MS : 0 };
}

export function failKey(kind: "ip" | "handle", value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9:._-]/g, "").slice(0, 64);
  return `fail:${kind}:${clean || "none"}`;
}

type Box = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
  delete?: (key: string) => Promise<void>;
};

const mem = new Map<string, FailState>();

async function box(): Promise<Box | null> {
  try {
    const mod = await import("cloudflare:workers");
    const store = (mod as { env?: { STATS?: Box } }).env?.STATS;
    if (store && typeof store.get === "function") return store;
  } catch {
    /* preview */
  }
  return null;
}

function parseState(raw: string | null): FailState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as FailState;
    if (!data || typeof data.n !== "number") return null;
    return { n: data.n, lockUntil: Number(data.lockUntil) || 0 };
  } catch {
    return null;
  }
}

async function load(key: string): Promise<FailState | null> {
  const store = await box();
  if (!store) return mem.get(key) ?? null;
  return parseState(await store.get(key));
}

async function save(key: string, state: FailState | null) {
  const store = await box();
  if (!state || state.n <= 0) {
    mem.delete(key);
    if (store?.delete) await store.delete(key);
    else if (store) await store.put(key, JSON.stringify({ n: 0, lockUntil: 0 }), { expirationTtl: 60 });
    return;
  }
  mem.set(key, state);
  if (store) await store.put(key, JSON.stringify(state), { expirationTtl: 900 });
}

function keysFor(ip: string, handle: string): string[] {
  const keys = [failKey("ip", ip)];
  const h = handle.trim().toLowerCase();
  if (h) keys.push(failKey("handle", h));
  return keys;
}

export async function loginBlocked(ip: string, handle: string): Promise<boolean> {
  const now = Date.now();
  for (const key of keysFor(ip, handle)) {
    if (isLocked(await load(key), now)) return true;
  }
  return false;
}

export async function loginFailed(ip: string, handle: string): Promise<void> {
  const now = Date.now();
  for (const key of keysFor(ip, handle)) {
    const prev = await load(key);
    if (isLocked(prev, now)) continue;
    await save(key, recordFail(prev, now));
  }
}

export async function loginCleared(ip: string, handle: string): Promise<void> {
  for (const key of keysFor(ip, handle)) await save(key, null);
}

