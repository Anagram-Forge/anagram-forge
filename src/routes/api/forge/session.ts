import { createFileRoute } from "@tanstack/react-router";
import { deleteOwn, dropSession, isAdminHandle, login, passwordMatches, register, userFromToken } from "@/lib/forge-db";
import { SIGN_IN_FAIL, loginBlocked, loginCleared, loginFailed } from "@/lib/login-guard";
import { signupAttempted, signupBlocked, signupCreated, SIGNUP_SITE } from "@/lib/signup-guard";
import { clientIp, envGet, rejectTurnstile } from "@/lib/turnstile";

function cookieOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `af_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`;
}

function clearCookie(): string {
  return "af_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

async function mailHandles(alert: "warn" | "cap", total: number) {
  try {
    const url = await envGet("MAIL_WORKER_URL");
    const key = await envGet("MAIL_KEY");
    if (!url || !key) return;
    const subject = alert === "cap" ? "Handles paused" : "Handles climbing";
    const message =
      alert === "cap"
        ? `${total} new handles today. New handles are paused until tomorrow.`
        : `${total} new handles today. The door shuts at ${SIGNUP_SITE}.`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mail-key": key },
      body: JSON.stringify({ kind: "note", subject, message }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    /* the account still stands if the note doesn't */
  }
}

export const Route = createFileRoute("/api/forge/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ handle: null, admin: false });
        return Response.json({ handle: user.handle, admin: await isAdminHandle(user.handle) });
      },
      POST: async ({ request }) => {
        let body: { handle?: string; password?: string; action?: string; "cf-turnstile-response"?: string };
        try {
          body = (await request.json()) as {
            handle?: string;
            password?: string;
            action?: string;
            "cf-turnstile-response"?: string;
          };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        if (body.action === "wipe") {
          const user = await userFromToken(cookieOf(request));
          if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });
          const ip = clientIp(request);
          if (await loginBlocked(ip, user.handle)) {
            return Response.json({ ok: false, reason: "Password doesn’t match." }, { status: 429 });
          }
          const ok = await passwordMatches(user.id, String(body.password || ""));
          if (!ok) {
            await loginFailed(ip, user.handle);
            return Response.json({ ok: false, reason: "Password doesn’t match." }, { status: 400 });
          }
          await loginCleared(ip, user.handle);
          await deleteOwn(user.id);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json", "set-cookie": clearCookie() },
          });
        }
        const ip = clientIp(request);
        const handle = String(body.handle || "");
        if (body.action !== "register") {
          if (await loginBlocked(ip, handle)) {
            return Response.json({ ok: false, reason: SIGN_IN_FAIL }, { status: 429 });
          }
          const result = await login(handle, String(body.password || ""));
          if (!result.ok) {
            if (result.reason === SIGN_IN_FAIL) await loginFailed(ip, handle);
            return Response.json({ ok: false, reason: result.reason }, { status: 400 });
          }
          await loginCleared(ip, handle);
          return new Response(JSON.stringify({ ok: true, handle: result.handle }), {
            headers: {
              "content-type": "application/json",
              "set-cookie": setCookie(result.token, request),
            },
          });
        }
        const blocked = await signupBlocked(ip);
        if (blocked) return Response.json({ ok: false, reason: blocked }, { status: 429 });
        const captcha = await rejectTurnstile(request, String(body["cf-turnstile-response"] || ""));
        if (captcha) return captcha;
        await signupAttempted(ip);
        const result = await register(handle, String(body.password || ""));
        if (!result.ok) return Response.json(result, { status: 400 });
        const made = await signupCreated(ip);
        if (made.alert) await mailHandles(made.alert, made.total);
        return new Response(JSON.stringify({ ok: true, handle: result.handle }), {
          headers: {
            "content-type": "application/json",
            "set-cookie": setCookie(result.token, request),
          },
        });
      },
      DELETE: async ({ request }) => {
        await dropSession(cookieOf(request));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json", "set-cookie": clearCookie() },
        });
      },
    },
  },
});
