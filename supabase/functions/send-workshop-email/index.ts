// PROVIDETECH — send the Zoom link email to a paid participant (admin only).
//
// Called by /admin after "Mark as paid" and by the "Resend Zoom link" button.
// Payments made through PayMongo are emailed by paymongo-webhook instead.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   your Resend API key (re_...)
//   EMAIL_FROM       e.g.  PROVIDETECH AI Assistance <workshops@yourdomain.com>
//   EMAIL_REPLY_TO   optional, e.g. providetechaiassistance@gmail.com
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, json, SUPABASE_URL, ANON_KEY, SERVICE_KEY } from "./env.ts";
import { buildEmail, sendZoomEmail } from "./zoom-email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);

  // 1. Only signed-in admins may send
  const userClient = createClient(SUPABASE_URL(), ANON_KEY(), { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "AUTH", message: "Please sign in again." }, 401);
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });
  const { data: adminRow } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return json({ error: "FORBIDDEN", message: "Only admins can send workshop emails." }, 403);

  // 2. Load the reservation and its batch
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const id = String(body.reservation_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "BAD_ID", message: "Missing reservation." }, 400);
  const { data: r } = await db.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!r) return json({ error: "NOT_FOUND", message: "Reservation not found." }, 404);
  const { data: s } = await db.from("sessions").select("*").eq("id", r.session_id).maybeSingle();
  if (!s) return json({ error: "NOT_FOUND", message: "Batch not found." }, 404);

  if (body.preview === true) {
    if (!s.zoom_link) return json({ error: "NO_ZOOM_LINK", message: `Add the Zoom link to ${s.code} in Workshops first.` }, 422);
    return json({ ok: true, preview: true, to: r.email, ...buildEmail(r, s) });
  }

  // 3. Send and record
  const out = await sendZoomEmail(db, r, s);
  if (!out.ok) return json({ error: out.error, message: out.message }, out.status);
  return json(out);
});
