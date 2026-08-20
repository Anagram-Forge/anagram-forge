import { createFileRoute } from "@tanstack/react-router";
import { addSave, deleteSave, listSaves, userFromToken } from "@/lib/forge-db";

function cookieOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export const Route = createFileRoute("/api/forge/saves")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ saves: [] as const, signedIn: false });
        return Response.json({ saves: await listSaves(user.id), signedIn: true });
      },
      POST: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        if (!user) return Response.json({ ok: false, reason: "Sign in to save on this account." }, { status: 401 });
        let body: { letters?: string; mode?: string; label?: string; remove?: string };
        try {
          body = (await request.json()) as { letters?: string; mode?: string; label?: string; remove?: string };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        if (body.remove) {
          const result = await deleteSave(user.id, String(body.remove));
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        const result = await addSave(user.id, {
          letters: String(body.letters || ""),
          mode: String(body.mode || "from-rack"),
          label: body.label,
        });
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
