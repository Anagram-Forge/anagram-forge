#!/usr/bin/env node
/**
 * Fail if a tracked file looks like a token, a private key, a personal
 * email, or a phone number. Public addresses we mean to publish are allowed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOW_EMAIL =
  /^(sponsors@anagramforge\.com|anagramforge@local|[^@\s]+@example\.com|[^@\s]+@viewer\.grok\.invalid)$/i;

const TOKEN = [
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\bsk_live_[A-Za-z0-9]{8,}/,
];

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /\b(?:\+?1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;

const SKIP = [
  /^node_modules\//,
  /^dist\//,
  /^\.output\//,
  /^public\/dict\//,
  /^package-lock\.json$/,
  /\.(png|jpe?g|gif|webp|ico|woff2?|mp3|ogg|zip)$/i,
];

function tracked() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  return out.toString("utf8").split("\0").filter(Boolean);
}

const hits = [];
for (const file of tracked()) {
  if (SKIP.some((re) => re.test(file))) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const re of TOKEN) {
      if (re.test(line)) hits.push(`${file}:${i + 1}: token`);
      re.lastIndex = 0;
    }
    for (const match of line.matchAll(EMAIL)) {
      if (!ALLOW_EMAIL.test(match[0])) hits.push(`${file}:${i + 1}: email`);
    }
    if (PHONE.test(line)) hits.push(`${file}:${i + 1}: phone`);
    PHONE.lastIndex = 0;
  });
}

if (hits.length) {
  console.error("scan-secrets: refused");
  for (const hit of hits) console.error(hit);
  process.exit(1);
}
console.log("scan-secrets: clean");
