function pack(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

export function doorOpen(source: string, picks: string[]) {
  const rack = pack(source);
  const phrase = picks.map((w) => w.toLowerCase().trim()).filter(Boolean).join(" ");
  return rack === "narrowgate" && phrase === "arrange two";
}

export const DOOR_PATH = "/the-way" as const;
export const DOOR_SIGN = "the way";
export const DOOR_FLAG = "af-way";

export function markDoor() {
  try {
    localStorage.setItem(DOOR_FLAG, "1");
  } catch {
    /* private mode */
  }
}

export function doorFound() {
  try {
    return localStorage.getItem(DOOR_FLAG) === "1";
  } catch {
    return false;
  }
}
