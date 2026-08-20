import { createFileRoute } from "@tanstack/react-router";
import { addFind, banHandle, claimReport, deleteFind, getFind, isAdminHandle, listFinds, setFindHidden, userFromToken, vote } from "@/lib/forge-db";

function cookieOf(request: Request): string | null {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)af_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function envGet(key: string): string {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return (fromProcess || "").trim();
}

const lastReport = new Map<string, number>();

function ipOf(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}

export const Route = createFileRoute("/api/forge/finds")({
  server: {
    handlers: {
      GET: async () => Response.json({ finds: await listFinds() }),
      POST: async ({ request }) => {
        const user = await userFromToken(cookieOf(request));
        let body: { phrase?: string; vote?: string; remove?: string; report?: string; ban?: string; hide?: string; unhide?: string };
        try {
          body = (await request.json()) as { phrase?: string; vote?: string; remove?: string; report?: string; ban?: string; hide?: string; unhide?: string };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }

        if (body.report) {
          const find = await getFind(String(body.report));
          if (!find) return Response.json({ ok: false, reason: "Missing." }, { status: 400 });
          const ip = ipOf(request);
          const now = Date.now();
          if (now - (lastReport.get(ip) ?? 0) < 45_000) return Response.json({ ok: true, dup: true });
          lastReport.set(ip, now);
          const claim = await claimReport(find.id);
          if (claim === "dup") return Response.json({ ok: true, dup: true });
          const url = envGet("MAIL_WORKER_URL");
          if (!url) return Response.json({ ok: false, reason: "Mail isn’t wired." }, { status: 503 });
          const message = [
            "Finds report",
            `Phrase: ${find.phrase}`,
            `Handle: ${find.handle}`,
            `Find id: ${find.id}`,
            `Reporter: ${user?.handle || "guest"}`,
          ].join("\n");
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-mail-key": envGet("MAIL_KEY"),
              },
              body: JSON.stringify({
                kind: "bug",
                name: user?.handle || "guest",
                message,
              }),
            });
            if (!res.ok) return Response.json({ ok: false, reason: "Mail failed." }, { status: 503 });
            return Response.json({ ok: true });
          } catch {
            return Response.json({ ok: false, reason: "Mail failed." }, { status: 503 });
          }
        }

        if (!user) return Response.json({ ok: false, reason: "Sign in first." }, { status: 401 });
        const admin = await isAdminHandle(user.handle);

        if (body.hide || body.unhide) {
          const result = await setFindHidden(user.id, String(body.hide || body.unhide), Boolean(body.hide), admin);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        if (body.ban) {
          const result = await banHandle(user.id, String(body.ban));
          return Response.json(result, { status: result.ok ? 200 : 400 });
        }
        if (body.remove) {
          const result = await deleteFind(user.id, String(body.remove), admin);
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
