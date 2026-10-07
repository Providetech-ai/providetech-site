// PROVIDETECH — PayMongo helpers (copied into each function folder by sync-shared.mjs).
// deno-lint-ignore-file no-explicit-any
export const PM_API = "https://api.paymongo.com/v1";

export function pmKey(): string { return (Deno.env.get("PAYMONGO_SECRET_KEY") || "").trim(); }
export function pmMode(key = pmKey()): "test" | "live" | "" { return key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : ""; }

export async function pm(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: any; message: string }> {
  const res = await fetch(PM_API + path, {
    method,
    headers: { Authorization: "Basic " + btoa(pmKey() + ":"), "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  const message = res.ok ? "" : ((out?.errors || []).map((e: any) => e.detail || e.code).join(" ") || `PayMongo error ${res.status}`);
  return { ok: res.ok, status: res.status, data: out?.data, message };
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sameText(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
/** Checks the Paymongo-Signature header: t=<timestamp>,te=<test sig>,li=<live sig>. */
export async function verifyPaymongoSignature(rawBody: string, header: string, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts: Record<string, string> = {};
  for (const p of header.split(",")) { const i = p.indexOf("="); if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim(); }
  if (!parts.t) return false;
  const expected = await hmacHex(secret, `${parts.t}.${rawBody}`);
  return sameText(expected, parts.te || "") || sameText(expected, parts.li || "");
}

/** PayMongo payment source type → our method code. */
export function methodFrom(type: string, fallback: string): string {
  const m: Record<string, string> = { gcash: "gcash", card: "card", qrph: "qrph", paymaya: "maya" };
  return m[String(type || "").toLowerCase()] || fallback;
}
export const METHOD_LABEL: Record<string, string> = { gcash: "GCash", card: "Credit Card", qrph: "QR Ph (bank)", maya: "Maya", bank: "Bank transfer", cash: "Cash" };
