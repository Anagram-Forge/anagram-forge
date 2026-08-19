import { onlyLetters } from "@/lib/anagram/letters";

export type Week = {
  id: string;
  label: string;
  blurb: string;
  rack: string;
  mode: "phrase" | "from-rack" | "exact";
};

/** Swap the rack when you have a new challenge. No schedule implied. */
export const WEEK: Week = {
  id: "flock-cameras",
  label: "Challenge",
  blurb: "Same letters. Better words.",
  rack: "flock cameras",
  mode: "phrase",
};

export const PENDING_FIND = "af-pending-find";
export const FIND_CAP = 5;

export function formatFind(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .join(" · ");
}

export function matchesChallenge(phrase: string, rack = WEEK.rack): boolean {
  const a = onlyLetters(phrase).split("").sort().join("");
  const b = onlyLetters(rack).split("").sort().join("");
  return a.length >= 4 && a === b;
}
