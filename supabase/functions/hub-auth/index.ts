// PROVIDETECH — Builder Hub sign-in helpers for members (no admin rights).
//
// action "check_token":  is this set-password link still valid? → { email, purpose }
// action "set_password": use the link to choose a password      → { email }
// action "forgot":       email a 1-hour reset link (always answers ok, so emails can't be probed)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, json, SUPABASE_URL, SERVICE_KEY } from "./env.ts";
import { sha256Hex, sendHubAccess, siteBase } from "./hub.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });
  const action = String(body.action || "");

  if (action === "check_token" || action === "set_password") {
    const token = String(body.token || "");
    if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return json({ error: "BAD_LINK", message: "This link isn't valid. Ask for a new one with \"Forgot password\"." }, 400);
    const { data: t } = await db.from("member_tokens").select("*").eq("token_hash", await sha256Hex(token)).maybeSingle();
    if (!t || t.used_at || new Date(t.expires_at) < new Date()) return json({ error: "EXPIRED", message: "This link has expired or was already used. Ask for a new one with \"Forgot password\"." }, 410);
    const { data: m } = await db.from("members").select("email,name,access_until").eq("user_id", t.user_id).maybeSingle();
    if (!m) return json({ error: "NO_MEMBER", message: "This account doesn't have Builder Hub access." }, 403);
    if (action === "check_token") return json({ ok: true, email: m.email, name: m.name, purpose: t.purpose });

    const password = String(body.password || "");
    if (password.length < 8 || password.length > 72) return json({ error: "WEAK", message: "Use 8 to 72 characters." }, 400);
    // Mark used first so the same link can't be used twice at the same time
    const { data: claimed } = await db.from("member_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", t.token_hash).is("used_at", null).select().maybeSingle();
    if (!claimed) return json({ error: "EXPIRED", message: "This link was already used." }, 410);
    const { error } = await db.auth.admin.updateUserById(t.user_id, { password, email_confirm: true });
    if (error) {
      await db.from("member_tokens").update({ used_at: null }).eq("token_hash", t.token_hash);
      return json({ error: "AUTH", message: /weak|pwned|leaked/i.test(error.message) ? "That password is too common. Please choose another." : "Couldn't save the password. Try again." }, 400);
    }
    return json({ ok: true, email: m.email });
  }

  if (action === "forgot") {
    const email = String(body.email || "").trim().toLowerCase();
    const site = siteBase(body.site_url, req.headers.get("origin"));
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && site) {
      const { data: m } = await db.from("members").select("*").eq("email", email).maybeSingle();
      if (m && new Date(m.access_until) > new Date()) {
        const since = new Date(Date.now() - 3600e3).toISOString();
        const { count } = await db.from("member_tokens").select("token_hash", { count: "exact", head: true }).eq("user_id", m.user_id).eq("purpose", "reset").gte("created_at", since);
        if ((count || 0) < 3) await sendHubAccess(db, m, site, "reset");
      }
    }
    return json({ ok: true }); // same answer whether or not the email exists
  }
  return json({ error: "ACTION" }, 400);
});
