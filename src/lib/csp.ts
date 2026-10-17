/**
 * Enforcing policy for the built site. Dev (Vite) does not send this —
 * the dev client needs its own eval and websocket setup.
 *
 * 'unsafe-inline' stays because the page boot script, TanStack's stream
 * script, and Cloudflare's own injected script are inline and not hash-stable.
 *
 * 'unsafe-eval' stays because the built page compiles a small checker
 * with new Function. Without it the forge does not start.
 *
 * Cloudflare's Web Analytics beacon (static.cloudflareinsights.com) is
 * intentionally not allowed. This site does not run trackers.
 */
export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://grok.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: https://api.dictionaryapi.dev",
  "connect-src 'self' https://challenges.cloudflare.com https://api.dictionaryapi.dev https://api.datamuse.com https://en.wiktionary.org https://app-builder-deployer.grok.com",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
