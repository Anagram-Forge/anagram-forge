export type ReadNote = { line: string; why: string };

const MAX_NOTES = 10;
const MAX_WHY = 240;

export function readMessages(input: {
  source: string;
  kept: string[];
  lines: string[];
  origins: { word: string; origin: string }[];
}): { system: string; user: string } {
  const origins =
    input.origins.length === 0
      ? "No etymology notes were supplied."
      : input.origins.map((o) => `${o.word}: ${o.origin}`).join("\n");
  return {
    system: [
      "You judge whether a perfect anagram says something true about the source phrase.",
      "Reply with JSON only: {\"notes\":[{\"line\":\"...\",\"why\":\"...\"}]}",
      "Rules:",
      "- Use at most 10 notes. Fewer is better.",
      "- The line must be copied exactly from the candidate list.",
      "- Do not invent history or etymology. Use an origin only if it is written in the notes.",
      "- If a connection is only a coincidence, skip it, or say the link is thin.",
      "- One sentence on why, plain words, no preamble.",
    ].join("\n"),
    user: [
      `Source: ${input.source}`,
      input.kept.length ? `Kept words: ${input.kept.join(", ")}` : "Kept words: none",
      "",
      "Origins:",
      origins,
      "",
      "Candidates:",
      input.lines.map((line) => `- ${line}`).join("\n"),
    ].join("\n"),
  };
}

export function parseReadNotes(raw: string, allowed: string[]): ReadNote[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  const notes = (parsed as { notes?: unknown }).notes;
  if (!Array.isArray(notes)) return [];
  const ok = new Set(allowed.map((line) => line.toLowerCase()));
  const out: ReadNote[] = [];
  const seen = new Set<string>();
  for (const item of notes) {
    if (!item || typeof item !== "object") continue;
    const line = String((item as { line?: unknown }).line || "").replace(/\s+/g, " ").trim();
    const why = String((item as { why?: unknown }).why || "").replace(/\s+/g, " ").trim();
    const key = line.toLowerCase();
    if (!ok.has(key) || !why || seen.has(key)) continue;
    seen.add(key);
    out.push({ line, why: why.slice(0, MAX_WHY) });
    if (out.length >= MAX_NOTES) break;
  }
  return out;
}
