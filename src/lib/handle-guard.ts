/** Exact handles only — no substring hunt (classic ≠ ass). */
const BLOCKED = new Set(
  [
    "ass",
    "asshat",
    "asshole",
    "bastard",
    "bitch",
    "cock",
    "cunt",
    "damn",
    "dick",
    "fag",
    "faggot",
    "fuck",
    "fucker",
    "fucking",
    "goddamn",
    "hell",
    "nigger",
    "nigga",
    "piss",
    "pussy",
    "rape",
    "shit",
    "slut",
    "whore",
    "satan",
    "lucifer",
    "antichrist",
    "godisdead",
    "fuckgod",
    "fuckjesus",
    "jesusfuk",
    "jesusfuck",
    "damnjesus",
    "hailSatan",
    "hailsatan",
  ].map((s) => s.toLowerCase()),
);

export function handleAllowed(raw: string): boolean {
  const h = raw.trim().toLowerCase();
  if (BLOCKED.has(h)) return false;
  const packed = h.replace(/[_0-9]+/g, "");
  if (packed && BLOCKED.has(packed)) return false;
  return true;
}
