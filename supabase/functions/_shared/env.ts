// PROVIDETECH — shared helpers (copied into each function folder by sync-shared.mjs).
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
export function keyFrom(dictVar: string, legacyVar: string): string {
  const legacy = Deno.env.get(legacyVar);
  if (legacy) return legacy;
  try { const d = JSON.parse(Deno.env.get(dictVar) || "{}"); return d.default || (Object.values(d)[0] as string) || ""; } catch { return ""; }
}
export const SUPABASE_URL = () => Deno.env.get("SUPABASE_URL")!;
export const ANON_KEY = () => keyFrom("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
export const SERVICE_KEY = () => keyFrom("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
