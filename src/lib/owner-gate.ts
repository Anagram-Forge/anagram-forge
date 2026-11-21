import { isAdminHandle, userFromToken } from "@/lib/forge-db";

function sessionOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * The steward (site owner) or null. Same check as /api/forge/steward:
 * a real session whose handle matches the STEWARD_HANDLE secret.
 */
export async function ownerOf(request: Request) {
  const user = await userFromToken(sessionOf(request));
  if (!user || !(await isAdminHandle(user.handle))) return null;
  return user;
}

/** Writes must come from this site. Browsers always send Origin on these POSTs. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
