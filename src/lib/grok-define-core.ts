/**
 * "Ask Grok" for words the dictionaries don't know. Pure logic with injected
 * storage and model call, so the node tests can run it. No imports.
 */

export const GROK_DEFINE_MAX = 30;
export const GROK_PER_IP_HOUR = 20;
export const GROK_PER_DAY = 500;

export type GrokDefinition = { word: string; pos: string; text: string; real: boolean };

export type DefineKv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, opts?: { expirationTtl?: number }) => Promise<void>;
};

export type DefineDeps = {
  kv: DefineKv;
  /** Sends only the word. Returns the model's raw text. */
  ask: (word: string) => Promise<string>;
  /** Store prefix: "" on main, "preview/<branch>/" elsewhere. */
  scope: string;
  /** Hashed visitor id, never the address. */
  visitor: string;
  now?: number;
};

export type DefineResult =
  | { ok: true; definition: GrokDefinition; cached: boolean }
  | { ok: false; reason: "bad-word" | "busy" | "failed"; status: number };

/** Letters only, 1–30 of them, lowercased. Null when anything else is in it. */
export function cleanDefineWord(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const w = raw.trim().toLowerCase();
  if (!w || w.length > GROK_DEFINE_MAX) return null;
  return /^[a-z]+$/.test(w) ? w : null;
}

export const GROK_DEFINE_SYSTEM = [
  "You define single English words for a word game.",
  "Reply with exactly two lines and nothing else:",
  "pos: <part of speech, e.g. noun, verb, adjective>",
  "def: <a short plain definition, one or two sentences>",
  "If the word is not a real English word, do not invent a meaning. Reply:",
  "pos: none",
  "def: Not a recognized English word.",
  "No markdown, no quotes, no extra lines.",
].join("\n");

/** Pull pos/def out of the model's reply. Null if it didn't follow the format. */
export function parseGrokDefinition(word: string, text: string): GrokDefinition | null {
  let pos = "";
  let def = "";
  for (const line of String(text || "").split(/\r?\n/)) {
    const p = /^\s*pos\s*:\s*(.+)$/i.exec(line);
    const d = /^\s*def\s*:\s*(.+)$/i.exec(line);
    if (p && !pos) pos = p[1];
    else if (d && !def) def = d[1];
  }
  const tidy = (s: string, n: number) => s.replace(/[*_`#]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  pos = tidy(pos, 30).toLowerCase();
  def = tidy(def, 400);
  if (!def) return null;
  const real = !!pos && pos !== "none" && !/not a (recognized|real)/i.test(def);
  return { word, pos: real ? pos : "", text: def, real };
}

function hourStamp(now: number) {
  return new Date(now).toISOString().slice(0, 13);
}

function dayStamp(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

export function defineKeys(scope: string, word: string, visitor: string, now: number) {
  return {
    answer: `${scope}gdef:w:${word}`,
    ip: `${scope}gdef:ip:${visitor}:${hourStamp(now)}`,
    day: `${scope}gdef:day:${dayStamp(now)}`,
  };
}

/** Same word asked twice at once in one isolate shares the call. */
const inflight = new Map<string, Promise<DefineResult>>();

export async function grokDefine(rawWord: unknown, deps: DefineDeps): Promise<DefineResult> {
  const word = cleanDefineWord(rawWord);
  if (!word) return { ok: false, reason: "bad-word", status: 400 };
  const now = deps.now ?? Date.now();
  const keys = defineKeys(deps.scope, word, deps.visitor, now);

  // Answers are kept for good: each word costs at most one call.
  const hit = await deps.kv.get(keys.answer);
  if (hit) {
    try {
      const d = JSON.parse(hit) as GrokDefinition;
      if (d && typeof d.text === "string") return { ok: true, definition: d, cached: true };
    } catch {
      /* fall through and ask again */
    }
  }

  const flightKey = keys.answer;
  const running = inflight.get(flightKey);
  if (running) return running;

  const job = (async (): Promise<DefineResult> => {
    // Limits count real model calls only; cached answers are free.
    const ipUsed = Number(await deps.kv.get(keys.ip)) || 0;
    const dayUsed = Number(await deps.kv.get(keys.day)) || 0;
    if (ipUsed >= GROK_PER_IP_HOUR || dayUsed >= GROK_PER_DAY) return { ok: false, reason: "busy", status: 429 };
    await deps.kv.put(keys.ip, String(ipUsed + 1), { expirationTtl: 2 * 60 * 60 });
    await deps.kv.put(keys.day, String(dayUsed + 1), { expirationTtl: 3 * 24 * 60 * 60 });
    let text = "";
    try {
      text = await deps.ask(word);
    } catch {
      return { ok: false, reason: "failed", status: 502 };
    }
    const definition = parseGrokDefinition(word, text);
    if (!definition) return { ok: false, reason: "failed", status: 502 };
    await deps.kv.put(keys.answer, JSON.stringify(definition));
    return { ok: true, definition, cached: false };
  })();
  inflight.set(flightKey, job);
  try {
    return await job;
  } finally {
    inflight.delete(flightKey);
  }
}
