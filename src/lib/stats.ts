export type Stats = { visits: number; anagrams: number };

export async function fetchStats(): Promise<Stats | null> {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return null;
    return (await res.json()) as Stats;
  } catch {
    return null;
  }
}

export async function pingStats(kind: "visit" | "anagram"): Promise<Stats | null> {
  try {
    const res = await fetch("/api/stats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind }),
    });
    if (!res.ok) return null;
    return (await res.json()) as Stats;
  } catch {
    return null;
  }
}
