import { isCloudflareWorker } from "@/lib/runtime";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Cloudflare's published dummy keys. Preview only. Production must set real ones. */
const TEST_SITE = "1x00000000000000000000AA";
const TEST_SECRET = "1x0000000000000000000000000000000AA";

export async function envGet(key: string): Promise<string> {
  try {
    const mod = await import("cloudflare:workers");
    const value = (mod as { env?: Record<string, unknown> }).env?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    /* preview */
  }
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return (fromProcess || "").trim();
}

export function clientIp(request: Request): string {
  const raw =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  return raw.replace(/[^a-zA-Z0-9:.]/g, "").slice(0, 64) || "local";
}

/** True only when Cloudflare says this token is good. Missing secret or token is a no. */
export async function turnstileOk(token: string, ip: string, secret: string): Promise<boolean> {
  const response = token.trim();
  if (!response || !secret) return false;
  const body = new URLSearchParams({ secret, response });
  if (ip && ip !== "local") body.set("remoteip", ip);
  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function publicSiteKey(): Promise<string> {
  const key = await envGet("TURNSTILE_SITE_KEY");
  if (key) return key;
  if (!isCloudflareWorker()) return TEST_SITE;
  return "";
}

export async function turnstileSecret(): Promise<string> {
  const secret = await envGet("TURNSTILE_SECRET");
  if (secret) return secret;
  if (!isCloudflareWorker()) return TEST_SECRET;
  return "";
}

/** Null when the token is good. Otherwise a response the route should return. */
export async function rejectTurnstile(request: Request, token: string): Promise<Response | null> {
  const secret = await turnstileSecret();
  if (!secret) return Response.json({ ok: false, reason: "Captcha isn’t set up." }, { status: 503 });
  const ok = await turnstileOk(token, clientIp(request), secret);
  if (!ok) return Response.json({ ok: false, reason: "Captcha didn’t pass." }, { status: 400 });
  return null;
}
