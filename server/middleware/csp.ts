import { CSP } from "../../src/lib/csp";

/**
 * Document CSP for the built worker. Vite dev does not load this middleware,
 * so the live preview keeps working.
 */
export default async function cspMiddleware(_event: unknown, next: () => Promise<unknown>) {
  const result = await next();
  if (!(result instanceof Response)) return result;
  const type = result.headers.get("content-type") || "";
  if (!type.includes("text/html")) return result;
  if (result.headers.has("content-security-policy")) return result;
  const headers = new Headers(result.headers);
  headers.set("content-security-policy", CSP);
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}
