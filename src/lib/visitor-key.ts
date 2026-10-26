import { createHash } from "node:crypto";

/** Stable id for a visitor. Used as a limit key. Not the address itself. */
export function visitorKey(ip: string): string {
  const raw = (ip || "local").trim() || "local";
  return createHash("sha256").update(`af-visitor:${raw}`).digest("hex").slice(0, 32);
}
