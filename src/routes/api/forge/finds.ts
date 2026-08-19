import { createFileRoute } from "@tanstack/react-router";
import { addFind, deleteFind, listFinds, userFromToken, vote } from "@/lib/forge-db";

function cookieOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export const Route = createFileRoute("/api/forge/finds")({
  server: {
    handlers: {
      GET: async () => Response.json({ finds: await listFinds() }),
      POST: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });
        let body: { phrase?: string; vote?: string; remove?: string };
        try {
          body = (await request.json()) as { phrase?: string; vote?: string };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        if (body.remove) {
          const result = await deleteFind(user.id, String(body.remove));
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        if (body.vote) {
          const result = await vote(user.id, String(body.vote));
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        const result = await addFind(user, String(body.phrase || ""));
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
