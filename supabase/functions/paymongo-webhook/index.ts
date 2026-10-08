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
  // Mix-and-match orders: every booking in the same order is paid by this one payment.
  let group: any[] = [r];
  if (r.order_id) {
    const { data: g } = await db.from("reservations").select("*").eq("order_id", r.order_id).eq("pm_checkout_id", csId).order("created_at");
    if (g && g.length) group = g;
  }
  if (group.every((x) => x.pm_payment_id === payment.id)) return json({ ok: true, duplicate: true });

  const now = new Date().toISOString();
  const paidCentavos = Number(payment.attributes.amount || 0);
  const method = methodFrom(payment.attributes.source?.type, r.method);
  const due = group.reduce((t, x) => t + Math.round(Number(x.amount) * 100), 0);

  if (paidCentavos < due) {
    for (const x of group) {
      const history = (x.history || []).concat([{ at: now, text: `PayMongo payment ${payment.id} was ₱${paidCentavos / 100}, less than ₱${due / 100}. Not marked as paid — please check.` }]);
      await db.from("reservations").update({ history }).eq("id", x.id);
    }
    return json({ ok: true, flagged: "amount" });
  }

  for (const x of group) {
    if (x.pm_payment_id === payment.id) continue;
    const { data: s } = await db.from("sessions").select("*").eq("id", x.session_id).maybeSingle();
    // Mark as paid
    const history = (x.history || []).slice();
    const was = x.status !== "pending" && x.status !== "paid" ? ` (was ${x.status.replace("_", " ")})` : "";
    history.push({ at: now, text: `Paid via PayMongo · ${METHOD_LABEL[method] || method} (ref ${payment.id})${group.length > 1 ? ` · order of ${group.length}` : ""}${was}` });
    const { data: updated, error } = await db.from("reservations")
      .update({ status: "paid", method, ref: payment.id, pm_payment_id: payment.id, paid_at: now, history })
      .eq("id", x.id).select().single();
    if (error) { console.error("update failed", error.message); return json({ error: "DB" }, 500); } // retried by PayMongo

    // Confirmation email (Zoom link / venue / 1-on-1). Problems are logged in the history, not retried.
    if (s && s.format !== "hub" && !updated.zoom_email_sent_at) {
      const sent = await sendZoomEmail(db, updated, s);
      if (!sent.ok && sent.error !== "SEND_FAILED") {
        const { data: cur } = await db.from("reservations").select("history").eq("id", x.id).single();
        await db.from("reservations").update({ history: (cur?.history || []).concat([{ at: new Date().toISOString(), text: `Confirmation not emailed yet: ${sent.message}` }]) }).eq("id", x.id);
      }
    }
    // Builder Hub: create their member login and email the access link
    if (updated.addon_hub) {
      try {
        const hub = await grantFromReservation(db, updated, siteBase(updated.site_url));
        if (!hub.ok) console.error("hub grant", hub.error, (hub as any).message);
      } catch (e) {
        console.error("hub grant failed", e);
        const { data: cur } = await db.from("reservations").select("history").eq("id", x.id).single();
        await db.from("reservations").update({ history: (cur?.history || []).concat([{ at: new Date().toISOString(), text: `Builder Hub access not created yet: ${String((e as Error)?.message || e).slice(0, 160)}` }]) }).eq("id", x.id);
      }
    }
  }
  return json({ ok: true, reservation_id: r.id });
});
