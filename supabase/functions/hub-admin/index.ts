// PROVIDETECH — Builder Hub member management for /admin (admins only).
//
// provision {reservation_id, site_url, force?}   give access for a paid reservation with the add-on
// resend    {user_id, site_url, kind?}           email a new "set password" (or login) link
// grant     {email, name, months, lang, site_url} add a member by hand
// extend    {user_id, months}                    add months to their access
// revoke    {user_id}                            end access now
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, json, SUPABASE_URL, ANON_KEY, SERVICE_KEY } from "./env.ts";
import { grantFromReservation, provisionMember, sendHubAccess, siteBase } from "./hub.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const userClient = createClient(SUPABASE_URL(), ANON_KEY(), { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "AUTH", message: "Please sign in again." }, 401);
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });
  const { data: adminRow } = await db.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
  if (!adminRow) return json({ error: "FORBIDDEN", message: "Admins only." }, 403);

  let b: any = {};
  try { b = await req.json(); } catch { /* empty */ }
  const site = siteBase(b.site_url, req.headers.get("origin"));
  const uuid = (x: any) => /^[0-9a-f-]{36}$/i.test(String(x || ""));
  const months = Math.max(1, Math.min(60, parseInt(b.months, 10) || 12));
  try {
    switch (b.action) {
      case "provision": {
        if (!uuid(b.reservation_id)) return json({ error: "BAD_ID", message: "Missing reservation." }, 400);
        const { data: r } = await db.from("reservations").select("*").eq("id", b.reservation_id).maybeSingle();
        if (!r) return json({ error: "NOT_FOUND", message: "Reservation not found." }, 404);
        const out = await grantFromReservation(db, r, site, { force: !!b.force });
        return out.ok ? json(out) : json(out, 400);
      }
      case "resend": {
        if (!uuid(b.user_id)) return json({ error: "BAD_ID", message: "Missing member." }, 400);
        const { data: m } = await db.from("members").select("*").eq("user_id", b.user_id).maybeSingle();
        if (!m) return json({ error: "NOT_FOUND", message: "Member not found." }, 404);
        const out = await sendHubAccess(db, m, site, b.kind === "login" ? "login" : "welcome");
        if (!out.ok) return json(out, 400);
        await db.from("members").update({ history: (m.history || []).concat([{ at: new Date().toISOString(), text: "Access email re-sent by admin" }]) }).eq("user_id", m.user_id);
        return json({ ok: true });
      }
      case "grant": {
        const { member, isNew } = await provisionMember(db, { email: b.email, name: String(b.name || "").trim(), lang: b.lang, months, source: "admin", note: "Added by admin" });
        const out = await sendHubAccess(db, member, site, "welcome");
        return json({ ok: true, member, isNew, emailed: out.ok, message: out.ok ? "" : (out as any).message });
      }
      case "extend": case "revoke": {
        if (!uuid(b.user_id)) return json({ error: "BAD_ID", message: "Missing member." }, 400);
        const { data: m } = await db.from("members").select("*").eq("user_id", b.user_id).maybeSingle();
        if (!m) return json({ error: "NOT_FOUND", message: "Member not found." }, 404);
        const now = new Date();
        let until: string, text: string;
        if (b.action === "revoke") { until = now.toISOString(); text = "Access ended by admin"; }
        else { const d = new Date(Math.max(now.getTime(), new Date(m.access_until).getTime())); d.setMonth(d.getMonth() + months); until = d.toISOString(); text = `Extended ${months} month${months === 1 ? "" : "s"} by admin · access until ${until.slice(0, 10)}`; }
        const { data, error } = await db.from("members").update({ access_until: until, history: (m.history || []).concat([{ at: now.toISOString(), text }]) }).eq("user_id", m.user_id).select().single();
        if (error) return json({ error: "DB", message: error.message }, 500);
        return json({ ok: true, member: data });
      }
    }
    return json({ error: "ACTION", message: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: "FAILED", message: String((e as Error)?.message || e) }, 500);
  }
});
