/** True inside a Cloudflare Worker / Pages Function. */
export function isCloudflareWorker(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.userAgent === "string" &&
      navigator.userAgent.includes("Cloudflare-Workers")
    );
  } catch {
    return false;
  }
}
