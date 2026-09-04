import { createFileRoute } from "@tanstack/react-router";
import { DOOR_LEDGER } from "@/lib/door-ledger";
import { doorCookie, readDoorIds } from "@/lib/door-cookie";
import { isAdminHandle, setChallenge, stewardSnapshot, unbanHandle, userFromToken, wipeHandle } from "@/lib/forge-db";
import { DOOR_PATH } from "@/lib/side-door";

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
        return Response.json({ ...(await stewardSnapshot()), you: user.handle, doors: DOOR_LEDGER });
      },
      POST: async ({ request }) => {
        const user = await gate(request);
        if (!user) return new Response("Not found", { status: 404 });
        let body: {
          unban?: string;
          wipe?: string;
          openDoor?: string;
          challenge?: { label?: string; blurb?: string; rack?: string };
        };
        try {
          body = (await request.json()) as typeof body;
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
        if (body.openDoor === "way") {
          const ids = [...readDoorIds(request), "way"];
          return new Response(JSON.stringify({ ok: true, href: DOOR_PATH }), {
            headers: {
              "content-type": "application/json",
              "set-cookie": doorCookie(ids, request),
            },
          });
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
