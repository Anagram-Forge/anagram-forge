export type LocalSave = {
  id: string;
  label: string;
  letters: string;
  mode: string;
  created: number;
};

const KEY = "af-saves";
const CAP = 40;

function read(): LocalSave[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalSave[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(rows: LocalSave[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, CAP)));
  } catch {
    /* quota */
  }
}

export function listLocalSaves(): LocalSave[] {
  return read();
}

export function addLocalSave(input: { letters: string; mode: string }): { ok: true } | { ok: false; reason: string } {
  const letters = input.letters.trim().slice(0, 80);
  if (letters.replace(/[^a-zA-Z?]/g, "").length < 2) return { ok: false, reason: "Need a rack first." };
  const rows = read();
  if (rows.length >= CAP) return { ok: false, reason: "That’s enough saved racks." };
  rows.unshift({
    id: crypto.randomUUID(),
    label: letters,
    letters,
    mode: input.mode.slice(0, 20),
    created: Date.now(),
  });
  write(rows);
  return { ok: true };
}

export function removeLocalSave(id: string) {
  write(read().filter((s) => s.id !== id));
}
