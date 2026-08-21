export type Stats = { visits: number; anagrams: number; strikes: number };

export async function fetchStats(): Promise<Stats | null> {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Stats>;
    return { visits: data.visits || 0, anagrams: data.anagrams || 0, strikes: data.strikes || 0 };
  } catch {
    return null;
  }
}

export async function pingStats(kind: "visit" | "anagram" | "strike"): Promise<Stats | null> {
  try {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Stats>;
    return { visits: data.visits || 0, anagrams: data.anagrams || 0, strikes: data.strikes || 0 };
  } catch {
    return null;
  }
}