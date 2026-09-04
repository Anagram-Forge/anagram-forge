export function readDoorIds(request: Request): string[] {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_doors=([^;]+)/);
  if (!m) return [];
  return decodeURIComponent(m[1])
    .split(".")
    .map((id) => id.toLowerCase())
    .filter((id) => /^[a-z][a-z0-9]{0,24}$/.test(id));
}

export function doorCookie(ids: string[], request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const value = [...new Set(ids)].join(".");
  return `af_doors=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}${secure}`;
}
