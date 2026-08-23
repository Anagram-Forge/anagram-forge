export const DOOR_PATH = "/w" as const;

export type DoorUnlock = { id: string; sign: string };

export async function tryDoor(source: string, picks: string[]): Promise<DoorUnlock | null> {
  if (picks.length < 1) return null;
  try {
    const res = await fetch("/api/forge/door", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source, picks }),
    });
    const data = (await res.json()) as { ok?: boolean; id?: string; sign?: string };
    if (!res.ok || !data.ok || !data.id || !data.sign) return null;
    return { id: data.id, sign: data.sign };
  } catch {
    return null;
  }
}

export async function loadDoors(): Promise<{
  ok: boolean;
  doors: Array<{
    id: string;
    sign: string;
    title: string;
    blurb: string;
    quests: Array<{ kicker: string; title: string; note: string; open: boolean }>;
  }>;
}> {
  try {
    const res = await fetch("/api/forge/door", { credentials: "include" });
    if (res.status === 404) return { ok: false, doors: [] };
    const data = (await res.json()) as { ok?: boolean; doors?: never[] };
    if (!res.ok || !data.ok || !Array.isArray(data.doors)) return { ok: false, doors: [] };
    return { ok: true, doors: data.doors };
  } catch {
    return { ok: false, doors: [] };
  }
}
