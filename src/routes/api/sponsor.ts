import { createFileRoute } from "@tanstack/react-router";

type Payload = {
  name?: string;
  email?: string;
  company?: string;
  budget?: string;
  message?: string;
};

function rfc822(from: string, to: string, replyTo: string, subject: string, text: string) {
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject.replace(/[\r\n]+/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n");
}

async function deliver(to: string, replyTo: string, subject: string, text: string) {
  const from = "sponsors@anagramforge.com";
  const emailMod = await import(/* @vite-ignore */ "cloudflare:email");
  const workersMod = await import(/* @vite-ignore */ "cloudflare:workers");
  const EmailMessage = (emailMod as { EmailMessage: new (a: string, b: string, c: string) => unknown }).EmailMessage;
  const env = (workersMod as { env: { EMAIL?: { send: (m: unknown) => Promise<void> } } }).env;
  if (!env?.EMAIL) throw new Error("EMAIL binding missing");
  await env.EMAIL.send(new EmailMessage(from, to, rfc822(`Anagram Forge <${from}>`, to, replyTo, subject, text)));
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
        const workersMod = await import(/* @vite-ignore */ "cloudflare:workers").catch(() => null);
        const envTo =
          (workersMod && typeof (workersMod as { env?: { SPONSOR_TO?: string } }).env?.SPONSOR_TO === "string"
            ? (workersMod as { env: { SPONSOR_TO: string } }).env.SPONSOR_TO
            : "") || "";
        const to = (typeof process !== "undefined" ? process.env.SPONSOR_TO : "")?.trim() || envTo.trim();
        if (!to) return Response.json({ ok: false, reason: "mailto" }, { status: 503 });

        const text = [
          `Name: ${name}`,
          `Email: ${email}`,
          `Company: ${String(data.company || "").trim()}`,
          `Budget: ${String(data.budget || "").trim()}`,
          "",
          String(data.message || "").trim(),
        ].join("\n");

        try {
          await deliver(to, email, `Sponsor application — ${String(data.company || name).trim()}`, text);
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false, reason: "mailto" }, { status: 503 });
        }
      },
    },
  },
});
