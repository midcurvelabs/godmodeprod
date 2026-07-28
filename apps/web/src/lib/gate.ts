/** Shared closed-beta gate helpers (Edge + Node). */

export const GATE_COOKIE = "gmp_gate";
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashAccessCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Expected cookie value for the access code, or null if gate is off.
 * Production defaults to `1996` so the closed beta is gated even if the
 * Vercel env var is missing. Local/preview: set GODMODEPROD_ACCESS_CODE
 * to enable, leave unset to skip the gate.
 */
export async function expectedGateToken(): Promise<string | null> {
  const fromEnv = process.env.GODMODEPROD_ACCESS_CODE;
  const code =
    typeof fromEnv === "string" && fromEnv.trim()
      ? fromEnv.trim()
      : process.env.VERCEL_ENV === "production"
        ? "1996"
        : "";
  if (!code) return null;
  return hashAccessCode(code);
}
