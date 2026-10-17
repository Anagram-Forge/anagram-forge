import { createFileRoute } from "@tanstack/react-router";
import { envGet, publicSiteKey, rejectTurnstile } from "@/lib/turnstile";

type Payload = {
  kind?: string;
  name?: string;
  email?: string;
  message?: string;
  image?: { name?: string; type?: string; data?: string };
};

export const Route = createFileRoute("/api/report")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({ siteKey: await publicSiteKey() });
      },
      POST: async ({ request }) => {
        let data: Payload & { "cf-turnstile-response"?: string };
        try {
          data = (await request.json()) as Payload & { "cf-turnstile-response"?: string };
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const captcha = await rejectTurnstile(request, String(data["cf-turnstile-response"] || ""));
        if (captcha) return captcha;
        const message = String(data.message || "").trim();
        if (!message) return Response.json({ ok: false }, { status: 400 });
        const kind = data.kind === "feature" ? "feature" : "bug";

        const url = await envGet("MAIL_WORKER_URL");
        if (!url) return Response.json({ ok: false }, { status: 503 });

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-mail-key": await envGet("MAIL_KEY"),
            },
            body: JSON.stringify({
              kind,
              name: String(data.name || "").trim(),
              email: String(data.email || "").trim(),
              message,
              image: data.image || null,
            }),
          });
          if (!res.ok) return Response.json({ ok: false }, { status: 503 });
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
