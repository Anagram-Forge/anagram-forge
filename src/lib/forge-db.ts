import { FIND_CAP, WEEK, formatFind, type Week } from "@/lib/challenge";
import { lastDays, type DayRow } from "@/lib/stat-day";
import { onlyLetters } from "@/lib/anagram/letters";
import { handleAllowed } from "@/lib/handle-guard";
import { isCloudflareWorker } from "@/lib/runtime";

export type User = { id: string; handle: string; passHash: string };
export type Find = {
  id: string;
  weekId: string;
  userId: string;
  handle: string;
  phrase: string;
  votes: number;
  created: number;
  hidden: boolean;
};

export type SavedRack = {
  id: string;
  label: string;
  letters: string;
  mode: string;
  created: number;
};

type Stmt = {
  bind: (...a: unknown[]) => Stmt;
  all: () => Promise<{ results: Record<string, unknown>[] }>;
  run: () => Promise<void>;
  first: () => Promise<Record<string, unknown> | null>;
};

type Box = {
  prepare: (q: string) => Stmt;
};

const ram = {
  users: [] as User[],
  sessions: new Map<string, { userId: string; expires: number }>(),
  finds: [] as Find[],
  votes: new Set<string>(),
  bans: new Set<string>(),
  reported: new Set<string>(),
  challenge: null as Week | null,
  saves: [] as SavedRack[],
  history: [] as (Week & { ended: number })[],
};

type Kv = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string) => Promise<void>;
  list?: (opts: { prefix: string }) => Promise<{ keys: { name: string }[] }>;
};

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

/** First reporter mails you. Everyone after gets a polite no-op. */
export async function claimReport(findId: string): Promise<"send" | "dup"> {
  const key = `rpt:${findId}`;
  const box = await kv();
  if (box) {
    const had = await box.get(key);
    if (had) return "dup";
    await box.put(key, String(Date.now()));
    return "send";
  }
  if (ram.reported.has(findId)) return "dup";
  ram.reported.add(findId);
  return "send";
}

export async function getChallenge(): Promise<Week> {
  const db = await d1();
  if (db) {
    try {
      const row = await db.prepare("SELECT id, label, blurb, rack, mode FROM challenge WHERE k = ?").bind("now").first();
      if (row?.rack) {
        const mode = row.mode === "exact" || row.mode === "from-rack" ? row.mode : "phrase";
        return {
          id: String(row.id),
          label: String(row.label || "Challenge"),
          blurb: String(row.blurb || ""),
          rack: String(row.rack),
          mode,
        };
      }
    } catch {
      /* table missing */
    }
  }
  return ram.challenge ?? WEEK;
}

export async function setChallenge(next: {
  label: string;
  blurb: string;
  rack: string;
  mode?: Week["mode"];
}): Promise<{ ok: true; challenge: Week } | { ok: false; reason: string }> {
  const rack = next.rack.trim().replace(/\s+/g, " ").slice(0, 80);
  if (onlyLetters(rack).length < 4) return { ok: false, reason: "Rack needs at least four letters." };
  const challenge: Week = {
    id: onlyLetters(rack) || "challenge",
    label: (next.label || "Challenge").trim().slice(0, 40) || "Challenge",
    blurb: (next.blurb || "").trim().slice(0, 240),
    rack,
    mode: next.mode === "exact" || next.mode === "from-rack" ? next.mode : "phrase",
  };
  const db = await d1();
  if (db) {
    try {
      const prev = await getChallenge();
      if (prev.id !== challenge.id) {
        await db
          .prepare(
            "INSERT OR REPLACE INTO challenge_history (id, label, blurb, rack, mode, ended) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(prev.id, prev.label, prev.blurb, prev.rack, prev.mode, Date.now())
          .run();
      }
    } catch {
      /* history table optional */
    }
    try {
      await db
        .prepare(
          "INSERT INTO challenge (k, id, label, blurb, rack, mode) VALUES ('now', ?, ?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET id = excluded.id, label = excluded.label, blurb = excluded.blurb, rack = excluded.rack, mode = excluded.mode",
        )
        .bind(challenge.id, challenge.label, challenge.blurb, challenge.rack, challenge.mode)
        .run();
    } catch {
      return { ok: false, reason: "Challenge table isn’t in D1 yet." };
    }
  } else {
    if (ram.challenge && ram.challenge.id !== challenge.id) {
      ram.history.unshift({ ...ram.challenge, ended: Date.now() });
    }
    ram.challenge = challenge;
  }
  return { ok: true, challenge };
}

async function envAdmin(): Promise<string> {
  const fromProcess = typeof process !== "undefined" ? process.env.FORGE_ADMIN?.trim() : "";
  if (fromProcess) return fromProcess;
  try {
    const mod = await import("cloudflare:workers");
    const env = (mod as { env?: Record<string, unknown> }).env;
    const v = env?.FORGE_ADMIN;
    if (typeof v === "string" && v.trim()) return v.trim();
  } catch {
    /* preview */
  }
  return "FORGE_ADMIN";
}

export async function isAdminHandle(handle: string | null | undefined): Promise<boolean> {
  if (!handle) return false;
  const names = new Set(["keeper", "forge_admin"]);
  const extra = await envAdmin();
  if (extra) names.add(extra.toLowerCase());
  if (names.has(handle.toLowerCase())) return true;
  return !isCloudflareWorker();
}

async function isBanned(handle: string, db: Box | null): Promise<boolean> {
  const h = handle.toLowerCase();
  if (db) {
    const row = await db.prepare("SELECT handle FROM bans WHERE handle = ?").bind(handle).first();
    return Boolean(row);
  }
  return ram.bans.has(h);
}

async function d1(): Promise<Box | null> {
  try {
    const mod = await import("cloudflare:workers");
    const db = (mod as { env?: { DB?: Box } }).env?.DB;
    if (db && typeof db.prepare === "function") return db;
  } catch {
    /* preview */
  }
  return null;
}

function id(): string {
  return crypto.randomUUID();
}

async function sha(pass: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pass}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function register(handle: string, password: string): Promise<{ ok: true; token: string; handle: string } | { ok: false; reason: string }> {
  const h = handle.trim().slice(0, 24);
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(h)) return { ok: false, reason: "Handle: 3–24 letters, numbers, underscore." };
  if (!handleAllowed(h)) return { ok: false, reason: "That handle isn’t allowed." };
  if (password.length < 8) return { ok: false, reason: "Password needs 8 characters." };
  const db = await d1();
  if (await isBanned(h, db)) return { ok: false, reason: "That handle isn’t allowed." };
  const uid = id();
  const hash = await sha(password, uid);
  if (db) {
    const taken = await db.prepare("SELECT id FROM users WHERE handle = ?").bind(h).first();
    if (taken) return { ok: false, reason: "That handle is taken." };
    await db.prepare("INSERT INTO users (id, handle, pass_hash, created) VALUES (?, ?, ?, ?)").bind(uid, h, hash, Date.now()).run();
  } else {
    if (ram.users.some((u) => u.handle.toLowerCase() === h.toLowerCase())) return { ok: false, reason: "That handle is taken." };
    ram.users.push({ id: uid, handle: h, passHash: hash });
  }
  const token = await makeSession(uid, db);
  return { ok: true, token, handle: h };
}

export async function login(handle: string, password: string): Promise<{ ok: true; token: string; handle: string } | { ok: false; reason: string }> {
  const h = handle.trim();
  const db = await d1();
  let user: User | null = null;
  if (db) {
    const row = await db.prepare("SELECT id, handle, pass_hash FROM users WHERE handle = ?").bind(h).first();
    if (row) user = { id: String(row.id), handle: String(row.handle), passHash: String(row.pass_hash) };
  } else {
    user = ram.users.find((u) => u.handle.toLowerCase() === h.toLowerCase()) ?? null;
  }
  if (!user) return { ok: false, reason: "Handle or password is wrong." };
  if (await isBanned(user.handle, db)) return { ok: false, reason: "That handle isn’t allowed." };
  const hash = await sha(password, user.id);
  if (hash !== user.passHash) return { ok: false, reason: "Handle or password is wrong." };
  const token = await makeSession(user.id, db);
  return { ok: true, token, handle: user.handle };
}

async function makeSession(userId: string, db: Box | null): Promise<string> {
  const token = id();
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  if (db) {
    await db.prepare("INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)").bind(token, userId, expires).run();
  } else {
    ram.sessions.set(token, { userId, expires });
  }
  return token;
}

export async function userFromToken(token: string | null): Promise<{ id: string; handle: string } | null> {
  if (!token) return null;
  const db = await d1();
  if (db) {
    const row = await db
      .prepare(
        "SELECT u.id, u.handle FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires > ?",
      )
      .bind(token, Date.now())
      .first();
    if (!row) return null;
    return { id: String(row.id), handle: String(row.handle) };
  }
  const s = ram.sessions.get(token);
  if (!s || s.expires < Date.now()) return null;
  const u = ram.users.find((x) => x.id === s.userId);
  return u ? { id: u.id, handle: u.handle } : null;
}

export async function dropSession(token: string | null) {
  if (!token) return;
  const db = await d1();
  if (db) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  else ram.sessions.delete(token);
}

export function sameRack(phrase: string, rack: string): boolean {
  const a = onlyLetters(phrase).split("").sort().join("");
  const b = onlyLetters(rack).split("").sort().join("");
  return a.length >= 4 && a === b;
}

function asFind(r: Record<string, unknown>): Find {
  return {
    id: String(r.id),
    weekId: String(r.week_id ?? r.weekId),
    userId: String(r.user_id ?? r.userId),
    handle: String(r.handle),
    phrase: String(r.phrase),
    votes: Number(r.votes) || 0,
    created: Number(r.created) || 0,
    hidden: Number(r.hidden) === 1,
  };
}

export async function listFinds(weekId?: string, includeHidden = false): Promise<Find[]> {
  const current = weekId ?? (await getChallenge()).id;
  const db = await d1();
  if (db) {
    try {
      const { results } = await db
        .prepare(
          includeHidden
            ? "SELECT f.id, f.week_id, f.user_id, u.handle, f.phrase, f.votes, f.created, f.hidden FROM finds f JOIN users u ON u.id = f.user_id WHERE f.week_id = ? ORDER BY f.votes DESC, f.created ASC"
            : "SELECT f.id, f.week_id, f.user_id, u.handle, f.phrase, f.votes, f.created, f.hidden FROM finds f JOIN users u ON u.id = f.user_id WHERE f.week_id = ? AND IFNULL(f.hidden, 0) = 0 ORDER BY f.votes DESC, f.created ASC",
        )
        .bind(current)
        .all();
      return results.map(asFind);
    } catch {
      const { results } = await db
        .prepare(
          "SELECT f.id, f.week_id, f.user_id, u.handle, f.phrase, f.votes, f.created FROM finds f JOIN users u ON u.id = f.user_id WHERE f.week_id = ? ORDER BY f.votes DESC, f.created ASC",
        )
        .bind(current)
        .all();
      return results.map((r) => asFind({ ...r, hidden: 0 }));
    }
  }
  return ram.finds
    .filter((f) => f.weekId === current && (includeHidden || !f.hidden))
    .sort((a, b) => b.votes - a.votes || a.created - b.created);
}

export async function getFind(id: string): Promise<Find | null> {
  const db = await d1();
  if (db) {
    const r = await db
      .prepare(
        "SELECT f.id, f.week_id, f.user_id, u.handle, f.phrase, f.votes, f.created FROM finds f JOIN users u ON u.id = f.user_id WHERE f.id = ?",
      )
      .bind(id)
      .first();
    if (!r) return null;
    return asFind(r);
  }
  return ram.finds.find((f) => f.id === id) ?? null;
}

export async function addFind(user: { id: string; handle: string }, phrase: string): Promise<{ ok: true; find: Find } | { ok: false; reason: string }> {
  const clean = formatFind(phrase).slice(0, 80);
  const week = await getChallenge();
  if (!sameRack(clean, week.rack)) return { ok: false, reason: "Has to use this challenge’s letters, all of them." };
  const db = await d1();
  if (await isBanned(user.handle, db)) return { ok: false, reason: "That handle isn’t allowed." };
  if (db) {
    const n = await db
      .prepare("SELECT COUNT(*) AS c FROM finds WHERE week_id = ? AND user_id = ?")
      .bind(week.id, user.id)
      .first();
    if (Number(n?.c) >= FIND_CAP) return { ok: false, reason: "That’s enough for this rack." };
  } else if (ram.finds.filter((f) => f.weekId === week.id && f.userId === user.id).length >= FIND_CAP) {
    return { ok: false, reason: "That’s enough for this rack." };
  }
  const row: Find = {
    id: id(),
    weekId: week.id,
    userId: user.id,
    handle: user.handle,
    phrase: clean,
    votes: 0,
    created: Date.now(),
    hidden: false,
  };
  if (db) {
    try {
      await db
        .prepare("INSERT INTO finds (id, week_id, user_id, phrase, votes, created) VALUES (?, ?, ?, ?, 0, ?)")
        .bind(row.id, row.weekId, row.userId, row.phrase, row.created)
        .run();
    } catch {
      return { ok: false, reason: "Someone already posted that." };
    }
  } else {
    if (ram.finds.some((f) => f.weekId === week.id && f.phrase.toLowerCase() === clean.toLowerCase())) {
      return { ok: false, reason: "Someone already posted that." };
    }
    ram.finds.push(row);
  }
  return { ok: true, find: row };
}

export async function vote(userId: string, findId: string): Promise<{ ok: true; votes: number } | { ok: false; reason: string }> {
  const db = await d1();
  const key = `${userId}:${findId}`;
  if (db) {
    const exists = await db.prepare("SELECT find_id FROM votes WHERE find_id = ? AND user_id = ?").bind(findId, userId).first();
    if (exists) {
      await db.prepare("DELETE FROM votes WHERE find_id = ? AND user_id = ?").bind(findId, userId).run();
      await db.prepare("UPDATE finds SET votes = MAX(0, votes - 1) WHERE id = ?").bind(findId).run();
    } else {
      await db.prepare("INSERT INTO votes (find_id, user_id) VALUES (?, ?)").bind(findId, userId).run();
      await db.prepare("UPDATE finds SET votes = votes + 1 WHERE id = ?").bind(findId).run();
    }
    const row = await db.prepare("SELECT votes FROM finds WHERE id = ?").bind(findId).first();
    return { ok: true, votes: Number(row?.votes) || 0 };
  }
  const f = ram.finds.find((x) => x.id === findId);
  if (!f) return { ok: false, reason: "Missing." };
  if (ram.votes.has(key)) {
    ram.votes.delete(key);
    f.votes = Math.max(0, f.votes - 1);
  } else {
    ram.votes.add(key);
    f.votes += 1;
  }
  return { ok: true, votes: f.votes };
}

export async function deleteFind(userId: string, findId: string, asAdmin = false): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await d1();
  if (db) {
    const row = await db.prepare("SELECT user_id FROM finds WHERE id = ?").bind(findId).first();
    if (!row) return { ok: false, reason: "Missing." };
    if (!asAdmin && String(row.user_id) !== userId) return { ok: false, reason: "That’s not yours." };
    await db.prepare("DELETE FROM votes WHERE find_id = ?").bind(findId).run();
    await db.prepare("DELETE FROM finds WHERE id = ?").bind(findId).run();
    return { ok: true };
  }
  const f = ram.finds.find((x) => x.id === findId);
  if (!f) return { ok: false, reason: "Missing." };
  if (!asAdmin && f.userId !== userId) return { ok: false, reason: "That’s not yours." };
  ram.finds = ram.finds.filter((x) => x.id !== findId);
  ram.votes = new Set([...ram.votes].filter((k) => !k.endsWith(`:${findId}`)));
  return { ok: true };
}

export async function setFindHidden(
  userId: string,
  findId: string,
  hidden: boolean,
  asAdmin: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await d1();
  if (db) {
    const row = await db.prepare("SELECT user_id FROM finds WHERE id = ?").bind(findId).first();
    if (!row) return { ok: false, reason: "Missing." };
    if (!asAdmin && String(row.user_id) !== userId) return { ok: false, reason: "That’s not yours." };
    try {
      await db.prepare("UPDATE finds SET hidden = ? WHERE id = ?").bind(hidden ? 1 : 0, findId).run();
    } catch {
      return { ok: false, reason: "Hide isn’t on this database yet." };
    }
    return { ok: true };
  }
  const f = ram.finds.find((x) => x.id === findId);
  if (!f) return { ok: false, reason: "Missing." };
  if (!asAdmin && f.userId !== userId) return { ok: false, reason: "That’s not yours." };
  f.hidden = hidden;
  return { ok: true };
}

export async function deleteOwn(userId: string): Promise<{ ok: true }> {
  const db = await d1();
  if (db) {
    const { results } = await db.prepare("SELECT id FROM finds WHERE user_id = ?").bind(userId).all();
    for (const r of results) {
      await db.prepare("DELETE FROM votes WHERE find_id = ?").bind(r.id).run();
    }
    await db.prepare("DELETE FROM votes WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM finds WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM saves WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
    await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  } else {
    const ids = new Set(ram.finds.filter((f) => f.userId === userId).map((f) => f.id));
    ram.finds = ram.finds.filter((f) => f.userId !== userId);
    ram.votes = new Set([...ram.votes].filter((k) => !k.startsWith(`${userId}:`) && ![...ids].some((id) => k.endsWith(`:${id}`))));
    ram.saves = [];
    for (const [tok, s] of ram.sessions) {
      if (s.userId === userId) ram.sessions.delete(tok);
    }
    ram.users = ram.users.filter((u) => u.id !== userId);
  }
  return { ok: true };
}

export async function listArchive(): Promise<{ challenge: Week & { ended: number }; finds: Find[] }[]> {
  const current = await getChallenge();
  const db = await d1();
  if (db) {
    try {
      const { results } = await db.prepare("SELECT id, label, blurb, rack, mode, ended FROM challenge_history ORDER BY ended DESC").all();
      const out = [];
      for (const r of results) {
        const id = String(r.id);
        if (id === current.id) continue;
        const mode = r.mode === "exact" || r.mode === "from-rack" ? r.mode : "phrase";
        const challenge: Week & { ended: number } = {
          id,
          label: String(r.label),
          blurb: String(r.blurb),
          rack: String(r.rack),
          mode,
          ended: Number(r.ended) || 0,
        };
        out.push({ challenge, finds: await listFinds(id, false) });
      }
      return out;
    } catch {
      return [];
    }
  }
  return ram.history
    .filter((h) => h.id !== current.id)
    .map((challenge) => ({
      challenge,
      finds: ram.finds.filter((f) => f.weekId === challenge.id && !f.hidden),
    }));
}

export async function banHandle(adminId: string, targetHandle: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const adminUser = ram.users.find((u) => u.id === adminId);
  const db = await d1();
  let adminHandle = adminUser?.handle || "";
  if (db && !adminHandle) {
    const row = await db.prepare("SELECT handle FROM users WHERE id = ?").bind(adminId).first();
    adminHandle = row ? String(row.handle) : "";
  }
  if (!(await isAdminHandle(adminHandle))) return { ok: false, reason: "No." };
  const h = targetHandle.trim();
  if (!h) return { ok: false, reason: "Missing." };
  if (await isAdminHandle(h)) return { ok: false, reason: "No." };
  if (db) {
    await db.prepare("INSERT OR IGNORE INTO bans (handle, created) VALUES (?, ?)").bind(h, Date.now()).run();
    const u = await db.prepare("SELECT id FROM users WHERE handle = ?").bind(h).first();
    if (u) {
      const uid = String(u.id);
      const { results } = await db.prepare("SELECT id FROM finds WHERE user_id = ?").bind(uid).all();
      for (const r of results) {
        await db.prepare("DELETE FROM votes WHERE find_id = ?").bind(r.id).run();
      }
      await db.prepare("DELETE FROM finds WHERE user_id = ?").bind(uid).run();
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid).run();
    }
  } else {
    ram.bans.add(h.toLowerCase());
    const u = ram.users.find((x) => x.handle.toLowerCase() === h.toLowerCase());
    if (u) {
      const ids = new Set(ram.finds.filter((f) => f.userId === u.id).map((f) => f.id));
      ram.finds = ram.finds.filter((f) => f.userId !== u.id);
      ram.votes = new Set([...ram.votes].filter((k) => ![...ids].some((id) => k.endsWith(`:${id}`))));
      for (const [tok, s] of ram.sessions) {
        if (s.userId === u.id) ram.sessions.delete(tok);
      }
    }
  }
  return { ok: true };
}

export async function wipeHandle(adminId: string, targetHandle: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const banned = await banHandle(adminId, targetHandle);
  if (!banned.ok) return banned;
  const h = targetHandle.trim();
  const db = await d1();
  if (db) {
    const u = await db.prepare("SELECT id FROM users WHERE handle = ?").bind(h).first();
    if (u) {
      const uid = String(u.id);
      await db.prepare("DELETE FROM saves WHERE user_id = ?").bind(uid).run();
      await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid).run();
      await db.prepare("DELETE FROM users WHERE id = ?").bind(uid).run();
    }
  } else {
    const u = ram.users.find((x) => x.handle.toLowerCase() === h.toLowerCase());
    if (u) {
      ram.saves = ram.saves.filter(() => true);
      ram.users = ram.users.filter((x) => x.id !== u.id);
    }
  }
  return { ok: true };
}

export async function unbanHandle(handle: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const h = handle.trim();
  if (!h) return { ok: false, reason: "Missing." };
  const db = await d1();
  if (db) await db.prepare("DELETE FROM bans WHERE handle = ?").bind(h).run();
  else ram.bans.delete(h.toLowerCase());
  return { ok: true };
}

export async function stewardSnapshot() {
  const db = await d1();
  const challenge = await getChallenge();
  const finds = await listFinds(challenge.id, true);
  const box = await kv();
  let visits = 0;
  let anagrams = 0;
  let strikes = 0;
  const series: DayRow[] = [];
  const reportedIds: string[] = [];
  if (box) {
    visits = Number(await box.get("visits")) || 0;
    anagrams = Number(await box.get("anagrams")) || 0;
    strikes = Number(await box.get("strikes")) || 0;
    for (const day of lastDays(14)) {
      const [v, a, s] = await Promise.all([
        box.get(`day:visits:${day}`),
        box.get(`day:anagrams:${day}`),
        box.get(`day:strikes:${day}`),
      ]);
      series.push({
        day,
        visits: Number(v) || 0,
        anagrams: Number(a) || 0,
        strikes: Number(s) || 0,
      });
    }
    if (box.list) {
      const listed = await box.list({ prefix: "rpt:" });
      for (const k of listed.keys) reportedIds.push(k.name.slice(4));
    }
  } else {
    reportedIds.push(...ram.reported);
  }
  const reported = finds.filter((f) => reportedIds.includes(f.id));
  type HandleRow = { handle: string; created: number; finds: number; lastPosted: number };
  let handles: HandleRow[] = [];
  let bans: { handle: string; created: number }[] = [];
  if (db) {
    const users = await db.prepare("SELECT id, handle, created FROM users ORDER BY created DESC").all();
    const counts = await db.prepare("SELECT user_id, COUNT(*) AS c FROM finds GROUP BY user_id").all();
    const lasts = await db.prepare("SELECT user_id, MAX(created) AS last FROM finds GROUP BY user_id").all();
    const cmap = new Map(counts.results.map((r) => [String(r.user_id), Number(r.c) || 0]));
    const lmap = new Map(lasts.results.map((r) => [String(r.user_id), Number(r.last) || 0]));
    handles = users.results.map((r) => ({
      handle: String(r.handle),
      created: Number(r.created) || 0,
      finds: cmap.get(String(r.id)) || 0,
      lastPosted: lmap.get(String(r.id)) || 0,
    }));
    try {
      const b = await db.prepare("SELECT handle, created FROM bans ORDER BY created DESC").all();
      bans = b.results.map((r) => ({ handle: String(r.handle), created: Number(r.created) || 0 }));
    } catch {
      bans = [];
    }
  } else {
    const cmap = new Map<string, number>();
    const lmap = new Map<string, number>();
    for (const f of ram.finds) {
      cmap.set(f.userId, (cmap.get(f.userId) || 0) + 1);
      lmap.set(f.userId, Math.max(lmap.get(f.userId) || 0, f.created));
    }
    handles = ram.users.map((u) => ({
      handle: u.handle,
      created: 0,
      finds: cmap.get(u.id) || 0,
      lastPosted: lmap.get(u.id) || 0,
    }));
    bans = [...ram.bans].map((handle) => ({ handle, created: 0 }));
    series.push(
      ...lastDays(14).map((day) => ({ day, visits: 0, anagrams: 0, strikes: 0 })),
    );
  }
  return { challenge, visits, anagrams, strikes, series, handles, finds, reported, bans };
}

const SAVE_CAP = 40;

export async function listSaves(userId: string): Promise<SavedRack[]> {
  const db = await d1();
  if (db) {
    try {
      const { results } = await db
        .prepare("SELECT id, label, letters, mode, created FROM saves WHERE user_id = ? ORDER BY created DESC")
        .bind(userId)
        .all();
      return results.map((r) => ({
        id: String(r.id),
        label: String(r.label),
        letters: String(r.letters),
        mode: String(r.mode),
        created: Number(r.created) || 0,
      }));
    } catch {
      return [];
    }
  }
  return ram.saves.slice();
}

export async function addSave(
  userId: string,
  input: { letters: string; mode: string; label?: string },
): Promise<{ ok: true; save: SavedRack } | { ok: false; reason: string }> {
  const letters = input.letters.trim().slice(0, 80);
  if (onlyLetters(letters).length < 2) return { ok: false, reason: "Need a rack first." };
  const mode = (input.mode || "from-rack").slice(0, 20);
  const label = (input.label || letters).trim().slice(0, 80);
  const db = await d1();
  if (db) {
    const n = await db.prepare("SELECT COUNT(*) AS c FROM saves WHERE user_id = ?").bind(userId).first();
    if (Number(n?.c) >= SAVE_CAP) return { ok: false, reason: "That’s enough saved racks." };
    const row: SavedRack = { id: id(), label, letters, mode, created: Date.now() };
    try {
      await db
        .prepare("INSERT INTO saves (id, user_id, label, letters, mode, created) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(row.id, userId, row.label, row.letters, row.mode, row.created)
        .run();
    } catch {
      return { ok: false, reason: "Couldn’t save." };
    }
    return { ok: true, save: row };
  }
  if (ram.saves.length >= SAVE_CAP) return { ok: false, reason: "That’s enough saved racks." };
  const row: SavedRack = { id: id(), label, letters, mode, created: Date.now() };
  ram.saves.unshift(row);
  return { ok: true, save: row };
}

export async function deleteSave(userId: string, saveId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const db = await d1();
  if (db) {
    await db.prepare("DELETE FROM saves WHERE id = ? AND user_id = ?").bind(saveId, userId).run();
    return { ok: true };
  }
  ram.saves = ram.saves.filter((s) => s.id !== saveId);
  return { ok: true };
}
