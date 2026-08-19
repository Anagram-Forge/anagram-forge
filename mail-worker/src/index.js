import { EmailMessage } from "cloudflare:email";

const FROM_ADDR = "sponsors@anagramforge.com";
const FROM = `Anagram Forge <${FROM_ADDR}>`;

function allowedOrigins(env) {
  const raw =
    env.ALLOWED_ORIGINS ||
    "https://anagramforge.com,https://www.anagramforge.com,https://anagram-forge.pages.dev";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allow = allowedOrigins(env);
  const matched = allow.includes(origin) ? origin : allow[0];
  return {
    "access-control-allow-origin": matched,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-mail-key",
    vary: "Origin",
  };
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(request, env) },
  });
}

function rfc822(to, replyTo, subject, text) {
  return [
    `From: ${FROM}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject.replace(/[\r\n]+/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
  ].join("\r\n");
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== "POST") {
      return json({ ok: false }, 405, request, env);
    }
    if (env.MAIL_KEY) {
      const got = request.headers.get("x-mail-key") || "";
      if (got !== env.MAIL_KEY) return json({ ok: false }, 401, request, env);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false }, 400, request, env);
    }
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    if (!name || !email.includes("@")) return json({ ok: false }, 400, request, env);
    if (!env.EMAIL) return json({ ok: false, reason: "no binding" }, 503, request, env);
    const to = String(env.MAIL_TO || "").trim();
    if (!to) return json({ ok: false, reason: "no MAIL_TO" }, 503, request, env);

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${String(data.company || "").trim()}`,
      `Budget: ${String(data.budget || "").trim()}`,
      "",
      String(data.message || "").trim(),
    ].join("\n");
    const subject = `Sponsor application — ${String(data.company || name).trim()}`;

    try {
      await env.EMAIL.send(new EmailMessage(FROM_ADDR, to, rfc822(to, email, subject, text)));
      return json({ ok: true }, 200, request, env);
    } catch (err) {
      return json({ ok: false, error: String(err) }, 502, request, env);
    }
  },
};
