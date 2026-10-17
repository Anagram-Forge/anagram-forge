export type Stats = { visits: number; anagrams: number; strikes: number };

export type StatPing = "visit" | "strike" | { kind: "anagram"; rack: string; word: string };

async function readBody(res: Response): Promise<Stats | null> {
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<Stats>;
  return { visits: data.visits || 0, anagrams: data.anagrams || 0, strikes: data.strikes || 0 };
}

export async function fetchStats(): Promise<Stats | null> {
  try {
    return await readBody(await fetch("/api/stats"));
  } catch {
    return null;
  }
}

export async function pingStats(kind: StatPing): Promise<Stats | null> {
  try {
    let body: Record<string, string>;
    if (kind === "strike") {
      const minted = await fetch("/api/stats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "ticket" }),
      });
      if (!minted.ok) return null;
      const ticket = String(((await minted.json()) as { ticket?: string }).ticket || "");
      if (!ticket) return null;
      body = { kind: "strike", ticket };
    } else if (kind === "visit") {
      body = { kind: "visit" };
    } else {
      if (!kind.word || !kind.rack) return null;
      body = { kind: "anagram", rack: kind.rack, word: kind.word };
    }
    return await readBody(
      await fetch("/api/stats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  } catch {
    return null;
  }
}
