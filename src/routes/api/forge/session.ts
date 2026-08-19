import { createFileRoute } from "@tanstack/react-router";
import { dropSession, login, register, userFromToken } from "@/lib/forge-db";

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

export const Route = createFileRoute("/api/forge/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        return Response.json(user ? { handle: user.handle } : { handle: null });
      },
      POST: async ({ request }) => {
        let body: { handle?: string; password?: string; action?: string };
        try {
          body = (await request.json()) as { handle?: string; password?: string; action?: string };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const action = body.action === "register" ? register : login;
        const result = await action(String(body.handle || ""), String(body.password || ""));
        if (!result.ok) return Response.json(result, { status: 400 });
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
