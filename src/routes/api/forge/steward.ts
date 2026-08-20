import { createFileRoute } from "@tanstack/react-router";
import { isAdminHandle, setChallenge, stewardSnapshot, unbanHandle, userFromToken, wipeHandle } from "@/lib/forge-db";

function cookieOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function gate(request: Request) {
  const user = await userFromToken(cookieOf(request));
  if (!user || !(await isAdminHandle(user.handle))) return null;
  return user;
}

export const Route = createFileRoute("/api/forge/steward")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await gate(request);
        if (!user) return new Response("Not found", { status: 404 });
        return Response.json({ ...(await stewardSnapshot()), you: user.handle });
      },
      POST: async ({ request }) => {
        const user = await gate(request);
        if (!user) return new Response("Not found", { status: 404 });
        let body: { unban?: string; wipe?: string; challenge?: { label?: string; blurb?: string; rack?: string } };
        try {
          body = (await request.json()) as { unban?: string; wipe?: string; challenge?: { label?: string; blurb?: string; rack?: string } };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        if (body.unban) {
          const result = await unbanHandle(body.unban);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        if (body.wipe) {
          const result = await wipeHandle(user.id, body.wipe);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        if (body.challenge) {
          const result = await setChallenge({
            label: String(body.challenge.label || "Challenge"),
            blurb: String(body.challenge.blurb || ""),
            rack: String(body.challenge.rack || ""),
          });
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        return Response.json({ ok: false }, { status: 400 });
      },
    },
  },
});
