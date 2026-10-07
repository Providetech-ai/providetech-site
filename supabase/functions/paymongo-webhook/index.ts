// PROVIDETECH — PayMongo calls this when someone pays. No admin clicks needed.
//
// 1. Checks the Paymongo-Signature (signing secret saved by "Connect PayMongo" in /admin).
// 2. Re-reads the checkout session from PayMongo to confirm it's really paid.
// 3. Marks the reservation as paid and emails the Zoom link.
//
// Deployed with JWT verification OFF because PayMongo can't sign in;
// the signature check and the PayMongo re-check are the protection.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, SUPABASE_URL, SERVICE_KEY } from "./env.ts";
import { pm, pmKey, verifyPaymongoSignature, methodFrom, METHOD_LABEL } from "./paymongo.ts";
import { sendZoomEmail } from "./zoom-email.ts";
import { grantFromReservation, siteBase } from "./hub.ts";

const PAID_EVENTS = ["checkout_session.payment.paid"];

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const raw = await req.text();
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });

  // 1. Signature
  const { data: cfg } = await db.from("private_config").select("value").eq("key", "paymongo_webhook_secret").maybeSingle();
  const secret = cfg?.value || Deno.env.get("PAYMONGO_WEBHOOK_SECRET") || "";
  if (!(await verifyPaymongoSignature(raw, req.headers.get("paymongo-signature") || "", secret))) {
    console.warn("Rejected webhook: bad signature");
    return json({ error: "SIGNATURE" }, 401);
  }

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return json({ error: "BAD_JSON" }, 400); }
  const type = evt?.data?.attributes?.type;
  if (!PAID_EVENTS.includes(type)) return json({ ok: true, ignored: type || "unknown" });
  const csId = String(evt?.data?.attributes?.data?.id || "");
  if (!/^cs_[A-Za-z0-9]+$/.test(csId)) return json({ ok: true, ignored: "no checkout session" });
  if (!pmKey()) return json({ error: "PAYMENTS_NOT_CONFIGURED" }, 503); // PayMongo will retry

  // 2. Confirm with PayMongo directly (never trust the event body alone)
  const cs = await pm(`/checkout_sessions/${csId}`);
  if (!cs.ok) { console.error("re-check failed", cs.status, cs.message); return json({ error: "RECHECK" }, 502); }
  const a = cs.data?.attributes || {};
  const payment = (a.payments || []).find((p: any) => p?.attributes?.status === "paid");
  const reservationId = String(a.metadata?.reservation_id || "");
  if (!payment || !/^[0-9a-f-]{36}$/i.test(reservationId)) return json({ ok: true, ignored: "not paid" });

  const { data: r } = await db.from("reservations").select("*").eq("id", reservationId).maybeSingle();
  if (!r) return json({ ok: true, ignored: "unknown reservation" });
  if (r.pm_payment_id === payment.id) return json({ ok: true, duplicate: true });
  const { data: s } = await db.from("sessions").select("*").eq("id", r.session_id).maybeSingle();

  const now = new Date().toISOString();
  const paidCentavos = Number(payment.attributes.amount || 0);
  const method = methodFrom(payment.attributes.source?.type, r.method);
  const history = (r.history || []).slice();

  if (paidCentavos < Math.round(Number(r.amount) * 100)) {
    history.push({ at: now, text: `PayMongo payment ${payment.id} was ₱${paidCentavos / 100}, less than ₱${r.amount}. Not marked as paid — please check.` });
    await db.from("reservations").update({ history }).eq("id", r.id);
    return json({ ok: true, flagged: "amount" });
  }

  // 3. Mark as paid
  const was = r.status !== "pending" && r.status !== "paid" ? ` (was ${r.status.replace("_", " ")})` : "";
  history.push({ at: now, text: `Paid via PayMongo · ${METHOD_LABEL[method] || method} (ref ${payment.id})${was}` });
  const { data: updated, error } = await db.from("reservations")
    .update({ status: "paid", method, ref: payment.id, pm_payment_id: payment.id, paid_at: now, history })
    .eq("id", r.id).select().single();
  if (error) { console.error("update failed", error.message); return json({ error: "DB" }, 500); } // retried by PayMongo

  // 4. Email the Zoom link (problems are logged in the participant history, not retried)
  if (s && !updated.zoom_email_sent_at) {
    const sent = await sendZoomEmail(db, updated, s);
    if (!sent.ok && sent.error !== "SEND_FAILED") {
      const { data: cur } = await db.from("reservations").select("history").eq("id", r.id).single();
      await db.from("reservations").update({ history: (cur?.history || []).concat([{ at: new Date().toISOString(), text: `Zoom link not emailed yet: ${sent.message}` }]) }).eq("id", r.id);
    }
  }
  // 5. Builder Hub add-on: create their member login and email the access link
  if (updated.addon_hub) {
    try {
      const hub = await grantFromReservation(db, updated, siteBase(updated.site_url));
      if (!hub.ok) console.error("hub grant", hub.error, (hub as any).message);
    } catch (e) {
      console.error("hub grant failed", e);
      const { data: cur } = await db.from("reservations").select("history").eq("id", r.id).single();
      await db.from("reservations").update({ history: (cur?.history || []).concat([{ at: new Date().toISOString(), text: `Builder Hub access not created yet: ${String((e as Error)?.message || e).slice(0, 160)}` }]) }).eq("id", r.id);
    }
  }
  return json({ ok: true, reservation_id: r.id });
});
