import { createFileRoute } from "@tanstack/react-router";

type Payload = {
  name?: string;
  email?: string;
  company?: string;
  budget?: string;
  message?: string;
};

function envGet(key: string): string {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return (fromProcess || "").trim();
}

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
        const name = String(data.name || "").trim();
        const email = String(data.email || "").trim();
        if (!name || !email || !email.includes("@")) {
          return Response.json({ ok: false }, { status: 400 });
        }

        const url = envGet("MAIL_WORKER_URL");
        if (!url) return Response.json({ ok: false, reason: "mailto" }, { status: 503 });

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-mail-key": envGet("MAIL_KEY"),
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
