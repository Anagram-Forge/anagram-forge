import { EmailMessage } from "cloudflare:email";

const FROM_ADDR = "sponsors@anagramforge.com";
const FROM = `Anagram Forge <${FROM_ADDR}>`;
const MAX_IMAGE = 5 * 1024 * 1024;

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

function wrapB64(s) {
  return (s.match(/.{1,76}/g) || [s]).join("\r\n");
}

function buildRaw({ to, replyTo, subject, text, image }) {
  const safeSubject = subject.replace(/[\r\n]+/g, " ");
  const headers = [
    `From: ${FROM}`,
    `To: ${to}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `Subject: ${safeSubject}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);

  if (!image) {
    return [...headers, "Content-Type: text/plain; charset=utf-8", "", text].join("\r\n");
  }

  const boundary = `af${crypto.randomUUID().replace(/-/g, "")}`;
  const rawB64 = String(image.data || "")
    .replace(/^data:[^;]+;base64,/i, "")
    .replace(/\s/g, "");
  const filename = String(image.name || "screenshot.png").replace(/[^\w.\-]+/g, "_");
  const ctype = /^image\/(png|jpeg|jpg|gif|webp)$/i.test(image.type || "")
    ? image.type.replace("jpg", "jpeg")
    : "application/octet-stream";

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    `--${boundary}`,
    `Content-Type: ${ctype}`,
    `Content-Disposition: attachment; filename="${filename}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapB64(rawB64),
    `--${boundary}--`,
    "",
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

    const kind = data.kind === "bug" || data.kind === "feature" ? data.kind : "sponsor";
    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const message = String(data.message || "").trim();
    if (!env.EMAIL) return json({ ok: false, reason: "no binding" }, 503, request, env);
    const to = String(env.MAIL_TO || "").trim();
    if (!to) return json({ ok: false, reason: "no MAIL_TO" }, 503, request, env);

    let image = null;
    if (data.image && typeof data.image === "object") {
      const raw = String(data.image.data || "").replace(/^data:[^;]+;base64,/i, "");
      if (raw) {
        const bytes = Math.floor((raw.length * 3) / 4);
        if (bytes > MAX_IMAGE) return json({ ok: false, reason: "image too large" }, 413, request, env);
        image = {
          name: data.image.name,
          type: data.image.type,
          data: raw,
        };
      }
    }

    let subject;
    let text;
    let replyTo = email.includes("@") ? email : "";

    if (kind === "sponsor") {
      if (!name || !email.includes("@")) return json({ ok: false }, 400, request, env);
      subject = `Sponsor application — ${String(data.company || name).trim()}`;
      text = [
        `Name: ${name}`,
        `Email: ${email}`,
        `Company: ${String(data.company || "").trim()}`,
        `Budget: ${String(data.budget || "").trim()}`,
        "",
        message,
      ].join("\n");
    } else {
      if (!message) return json({ ok: false }, 400, request, env);
      const label = kind === "feature" ? "Feature request" : "Bug report";
      subject = `${label} — ${name || "anonymous"}`;
      text = [
        `Kind: ${label}`,
        `Name: ${name || "(not given)"}`,
        `Email: ${email || "(not given)"}`,
        "",
        message,
      ].join("\n");
    }

    try {
      await env.EMAIL.send(new EmailMessage(FROM_ADDR, to, buildRaw({ to, replyTo, subject, text, image })));
      return json({ ok: true }, 200, request, env);
    } catch (err) {
      return json({ ok: false, error: String(err) }, 502, request, env);
    }
  },
};
