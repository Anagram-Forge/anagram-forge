import { createFileRoute } from "@tanstack/react-router";
import { envGet, rejectTurnstile } from "@/lib/turnstile";

type Payload = {
  name?: string;
  email?: string;
  company?: string;
  budget?: string;
  message?: string;
  "cf-turnstile-response"?: string;
};

export const Route = createFileRoute("/api/sponsor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let data: Payload;
        try {
          data = (await request.json()) as Payload;
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const captcha = await rejectTurnstile(request, String(data["cf-turnstile-response"] || ""));
        if (captcha) return captcha;
        const name = String(data.name || "").trim();
        const email = String(data.email || "").trim();
        if (!name || !email || !email.includes("@")) {
          return Response.json({ ok: false }, { status: 400 });
        }

        const url = await envGet("MAIL_WORKER_URL");
        if (!url) return Response.json({ ok: false, reason: "mailto" }, { status: 503 });

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-mail-key": await envGet("MAIL_KEY"),
            },
            body: JSON.stringify({
              name,
              email,
              company: String(data.company || "").trim(),
              budget: String(data.budget || "").trim(),
              message: String(data.message || "").trim(),
            }),
          });
          if (!res.ok) return Response.json({ ok: false, reason: "mailto" }, { status: 503 });
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false, reason: "mailto" }, { status: 503 });
        }
      },
    },
  },
});
