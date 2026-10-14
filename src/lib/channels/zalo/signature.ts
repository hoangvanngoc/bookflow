/**
 * Zalo signs each webhook with the header
 *   X-ZEvent-Signature: mac=sha256(appId + rawBody + timestamp + oaSecretKey)
 * Check the formula against the current Zalo OA docs before going live; it is
 * isolated here so a change touches one function.
 *
 * Uses Web Crypto so the same code runs in Workers, Node 18+ and browsers.
 */
export async function expectedSignature(appId: string, rawBody: string, timestamp: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(appId + rawBody + timestamp + secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifySignature(
  header: string | null,
  appId: string,
  rawBody: string,
  timestamp: string,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const given = header.replace(/^mac=/, "").trim().toLowerCase();
  const expected = await expectedSignature(appId, rawBody, timestamp, secret);
  return timingSafeEqual(given, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
