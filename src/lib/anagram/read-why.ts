export type ReadNote = { line: string; why: string };
export type Reading = { context: string; notes: ReadNote[] };

const MAX_NOTES = 10;
const MAX_WHY = 240;
const MAX_CONTEXT = 240;

export function readMessages(input: {
  source: string;
  kept: string[];
  lines: string[];
  origins: { word: string; origin: string }[];
  about: string;
}): { system: string; user: string } {
  const origins =
    input.origins.length === 0
      ? "No etymology notes were supplied."
      : input.origins.map((o) => `${o.word}: ${o.origin}`).join("\n");
  return {
    system: [
      "You judge whether a perfect anagram says something true about the source phrase.",
      "Reply with JSON only: {\"context\":\"...\",\"notes\":[{\"line\":\"...\",\"why\":\"...\"}]}",
      "Rules:",
      "- Use at most 10 notes. Fewer is better.",
      "- The line must be copied exactly from the candidate list.",
      "- Do not invent history or etymology. Use an origin only if it is written in the notes.",
      "- If the reader wrote a note, context is one sentence that stays inside that note. Do not add a date, place, or fact that the note does not contain.",
      "- If the reader wrote no note, context must be an empty string. Do not supply a biography.",
      "- If a connection is only a coincidence, skip it, or say the link is thin.",
      "- One sentence on why, plain words, no preamble.",
    ].join("\n"),
    user: [
      `Source: ${input.source}`,
      input.kept.length ? `Kept words: ${input.kept.join(", ")}` : "Kept words: none",
      input.about ? `Reader note: ${input.about}` : "Reader note: none",
      "",
      "Origins:",
      origins,
      "",
      "Candidates:",
      input.lines.map((line) => `- ${line}`).join("\n"),
    ].join("\n"),
  };
}

export function followMessages(input: {
  source: string;
  about: string;
  notes: ReadNote[];
  question: string;
  earlier: { q: string; a: string }[];
}): { system: string; user: string } {
  const lines =
    input.notes.length === 0
      ? "No lines were chosen."
      : input.notes.map((n) => `${n.line} — ${n.why}`).join("\n");
  const earlier =
    input.earlier.length === 0
      ? ""
      : input.earlier.map((t) => `Q: ${t.q}\nA: ${t.a}`).join("\n");
  return {
    system: [
      "You are answering a follow-up about one anagram reading.",
      "Reply with JSON only: {\"reply\":\"...\"}",
      "Stay on this phrase, the reader note, and the lines already chosen.",
      "Do not invent history. Do not add a date, place, or fact that is not in the reader note.",
      "One or two sentences. If the question leaves that subject, reply is exactly: That sits outside this phrase.",
    ].join("\n"),
    user: [
      `Source: ${input.source}`,
      input.about ? `Reader note: ${input.about}` : "Reader note: none",
      "",
      "Lines already chosen:",
      lines,
      earlier ? `\nEarlier:\n${earlier}\n` : "",
      `Question: ${input.question}`,
    ].join("\n"),
  };
}

export function parseReading(raw: string, allowed: string[]): Reading {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return { context: "", notes: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { context: "", notes: [] };
  }
  const body = parsed as { context?: unknown; notes?: unknown };
  const context = String(body.context || "").replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT);
  const notes = Array.isArray(body.notes) ? body.notes : [];
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
  return { context, notes: out };
}

export function parseFollow(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { reply?: unknown };
      const reply = String(parsed.reply || "").replace(/\s+/g, " ").trim();
      if (reply) return reply.slice(0, 400);
    } catch {
      /* fall through */
    }
  }
  return raw.replace(/\s+/g, " ").trim().slice(0, 400);
}
