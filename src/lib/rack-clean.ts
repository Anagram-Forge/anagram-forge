const MODES = new Set(["from-rack", "exact", "phrase", "pattern"]);

/** Letters and blank marks only. Everything else is dropped. */
export function cleanRack(raw: string): { letters: string; blanks: number } | null {
  let letters = "";
  let blanks = 0;
  for (const ch of String(raw)) {
    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) letters += ch.toLowerCase();
    else if (ch === "?") blanks += 1;
    if (letters.length + blanks > 40) break;
  }
  if (letters.length < 2 && letters.length + blanks < 2) return null;
  if (letters.length + blanks < 2) return null;
  return { letters, blanks };
}

export function rackStored(raw: string): string {
  const rack = cleanRack(raw);
  if (!rack) return "";
  return rack.letters.toUpperCase() + "?".repeat(rack.blanks);
}

export function cleanMode(raw: string): string {
  const mode = String(raw || "").trim();
  return MODES.has(mode) ? mode : "from-rack";
}
