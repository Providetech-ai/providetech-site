// PROVIDETECH — "Connect PayMongo" button in /admin → Settings (admin only).
//
// action "status":  is a PayMongo key set, test or live, is the webhook connected?
// action "connect": registers (or re-enables) the PayMongo webhook that points at
//                   paymongo-webhook, and stores its signing secret privately.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, json, SUPABASE_URL, ANON_KEY, SERVICE_KEY } from "./env.ts";
import { pm, pmKey, pmMode } from "./paymongo.ts";

const EVENTS = ["checkout_session.payment.paid"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  const userClient = createClient(SUPABASE_URL(), ANON_KEY(), { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "AUTH", message: "Please sign in again." }, 401);
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });
  const { data: adminRow } = await db.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!adminRow) return json({ error: "FORBIDDEN", message: "Admins only." }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const hookUrl = `${SUPABASE_URL()}/functions/v1/paymongo-webhook`;
  const mode = pmMode();
  const { data: rows } = await db.from("private_config").select("key,value").in("key", ["paymongo_webhook_id", "paymongo_webhook_mode", "paymongo_webhook_secret"]);
  const cfg: Record<string, string> = {}; (rows || []).forEach((x: any) => { cfg[x.key] = x.value; });
  const status = () => ({
    ok: true, key_set: !!pmKey(), mode,
    connected: !!(cfg.paymongo_webhook_secret && cfg.paymongo_webhook_id && cfg.paymongo_webhook_mode === mode),
    webhook_mode: cfg.paymongo_webhook_mode || "",
  });

  if (body.action !== "connect") return json(status());
  if (!pmKey()) return json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Add PAYMONGO_SECRET_KEY in Supabase → Edge Functions → Secrets first." }, 400);
  if (!mode) return json({ error: "BAD_KEY", message: "PAYMONGO_SECRET_KEY should start with sk_test_ or sk_live_." }, 400);

  // Find an existing webhook for our URL, else create one
  const list = await pm("/webhooks");
  if (!list.ok) return json({ error: "PAYMONGO", message: list.message }, 502);
  let hook = (list.data || []).find((w: any) => w?.attributes?.url === hookUrl);
  if (hook) {
    const evs: string[] = hook.attributes.events || [];
    if (!EVENTS.every((e) => evs.includes(e))) {
      const up = await pm(`/webhooks/${hook.id}`, "PUT", { data: { attributes: { url: hookUrl, events: Array.from(new Set([...evs, ...EVENTS])) } } });
      if (!up.ok) return json({ error: "PAYMONGO", message: up.message }, 502);
      hook = up.data;
    }
    if (hook.attributes.status !== "enabled") {
      const en = await pm(`/webhooks/${hook.id}/enable`, "POST");
      if (!en.ok) return json({ error: "PAYMONGO", message: en.message }, 502);
      hook = en.data;
    }
  } else {
    const made = await pm("/webhooks", "POST", { data: { attributes: { url: hookUrl, events: EVENTS } } });
    if (!made.ok) return json({ error: "PAYMONGO", message: made.message }, 502);
    hook = made.data;
  }
  const secret = hook?.attributes?.secret_key || "";
  if (!secret) return json({ error: "NO_SECRET", message: "PayMongo didn't return the webhook signing secret. Open PayMongo → Developers → Webhooks, copy the secret, and add it in Supabase as PAYMONGO_WEBHOOK_SECRET." }, 502);

  const now = new Date().toISOString();
  const { error } = await db.from("private_config").upsert([
    { key: "paymongo_webhook_id", value: hook.id, updated_at: now },
    { key: "paymongo_webhook_mode", value: mode, updated_at: now },
    { key: "paymongo_webhook_secret", value: secret, updated_at: now },
  ]);
  if (error) return json({ error: "DB", message: error.message }, 500);
  cfg.paymongo_webhook_id = hook.id; cfg.paymongo_webhook_mode = mode; cfg.paymongo_webhook_secret = secret;
  return json(status());
});
