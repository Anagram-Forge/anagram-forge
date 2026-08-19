import { createFileRoute } from "@tanstack/react-router";

type Payload = {
  kind?: string;
  name?: string;
  email?: string;
  message?: string;
  image?: { name?: string; type?: string; data?: string };
};

function envGet(key: string): string {
  const fromProcess = typeof process !== "undefined" ? process.env[key] : undefined;
  return (fromProcess || "").trim();
}

export const Route = createFileRoute("/api/report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let data: Payload;
        try {
          data = (await request.json()) as Payload;
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const message = String(data.message || "").trim();
        if (!message) return Response.json({ ok: false }, { status: 400 });
        const kind = data.kind === "feature" ? "feature" : "bug";

        const url = envGet("MAIL_WORKER_URL");
        if (!url) return Response.json({ ok: false }, { status: 503 });

        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-mail-key": envGet("MAIL_KEY"),
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
