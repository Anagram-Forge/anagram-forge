export function todayNY() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function lastDays(n: number) {
  const out: string[] = [];
  const start = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(start - i * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  }
  return out;
}

export type DayRow = { day: string; visits: number; anagrams: number; strikes: number };
