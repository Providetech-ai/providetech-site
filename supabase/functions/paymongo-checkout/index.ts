// PROVIDETECH — open a personal PayMongo checkout for one reservation.
//
// The checkout page calls this right after a seat is reserved. It creates a
// PayMongo Checkout Session tagged with the reservation id, so when the person
// pays, paymongo-webhook knows exactly whose seat to mark as paid.
//
// Secret (Supabase → Edge Functions → Secrets):
//   PAYMONGO_SECRET_KEY   sk_test_... while testing, sk_live_... when you go live
//   SITE_URL              your live address, e.g. https://providetech.vercel.app (where people return after paying)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, json, SUPABASE_URL, SERVICE_KEY } from "./env.ts";
import { pm, pmKey } from "./paymongo.ts";

function siteFrom(req: Request, body: any): string {
  // Where PayMongo sends people back after paying. Local testing (localhost) returns to localhost;
  // otherwise SITE_URL wins when it's set, so a payment can never be sent back to someone else's site.
  const clean = (v: unknown) => String(v || "").trim().replace(/\/+$/, "");
  const cands = [clean(body?.site_url), clean(req.headers.get("origin"))];
  const local = cands.find((v) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(v));
  if (local) return local;
  const env = clean(Deno.env.get("SITE_URL"));
  if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(env)) return env;
  return cands.find((v) => /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v)) || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const id = String(body.reservation_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "BAD_ID", message: "Missing reservation." }, 400);
  if (!pmKey()) return json({ error: "PAYMENTS_NOT_CONFIGURED", message: "Online payment isn't connected yet." }, 503);

  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });
  const { data: r } = await db.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!r) return json({ error: "NOT_FOUND", message: "Reservation not found." }, 404);
  if (r.status === "paid") return json({ ok: true, already_paid: true });
  if (r.status !== "pending") return json({ error: "CLOSED", message: "This reservation is no longer waiting for payment." }, 409);
  const { data: s } = await db.from("sessions").select("*").eq("id", r.session_id).maybeSingle();
  if (!s) return json({ error: "NOT_FOUND", message: "Batch not found." }, 404);

  // Reuse an open checkout so refreshing the page doesn't create duplicates
  if (r.pm_checkout_id) {
    const cur = await pm(`/checkout_sessions/${encodeURIComponent(r.pm_checkout_id)}`);
    const a = cur.data?.attributes;
    if (cur.ok && a?.status === "active" && a?.checkout_url) return json({ ok: true, checkout_url: a.checkout_url, reused: true });
  }

  const site = siteFrom(req, body);
  if (!site) return json({ error: "SITE_URL", message: "Unknown website address." }, 400);
  const lang = ["en", "tl", "ceb"].includes(r.lang) ? r.lang : "en";
  // Vercel/Netlify serve checkout.html at /checkout; the local preview server needs the .html
  const page = /^http:\/\//.test(site) ? "/checkout.html" : "/checkout";
  const addon = r.addon_hub && Number(r.addon_amount) > 0 ? Math.round(Number(r.addon_amount) * 100) : 0; // centavos
  const seat = Math.round(Number(r.amount || s.price) * 100) - addon;
  const all = ["gcash", "card", "qrph"];
  const first = all.includes(r.method) ? r.method : "gcash";
  const attrs = (methods: string[]) => ({
    data: {
      attributes: {
        billing: { name: r.name, email: r.email, phone: "+63" + r.phone },
        line_items: [
          { currency: "PHP", amount: seat, name: `${s.title} (${s.code})`, quantity: 1, description: `${s.date}${s.time_label ? " · " + s.time_label : ""}` },
          ...(addon ? [{ currency: "PHP", amount: addon, name: "PROVIDETECH Builder Hub (1 year)", quantity: 1, description: "Members' hub: recordings, tutorials, prompts, community" }] : []),
        ],
        payment_method_types: methods,
        description: `${s.title} · ${s.code} · seat for ${r.name}${addon ? " + Builder Hub" : ""}`,
        reference_number: `PT-${String(r.id).slice(0, 8).toUpperCase()}`,
        metadata: { reservation_id: r.id, batch: s.code },
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        success_url: `${site}${page}?paid=1&lang=${lang}`,
        cancel_url: `${site}${page}?batch=${s.id}&cancelled=1`,
      },
    },
  });
  // Offer all three methods (their choice first). If PayMongo hasn't activated some of them yet,
  // try smaller sets until one works: their choice alone, then QR Ph (works with GCash, Maya and bank apps).
  const tries = [[first, ...all.filter((m) => m !== first)], [first], ["qrph"], ...all.filter((m) => m !== first && m !== "qrph").map((m) => [m])];
  let res = await pm("/checkout_sessions", "POST", attrs(tries[0]));
  for (let i = 1; i < tries.length && !res.ok && res.status === 400; i++) {
    if (i > 1 && tries.slice(0, i).some((t) => t.length === 1 && t[0] === tries[i][0])) continue;
    res = await pm("/checkout_sessions", "POST", attrs(tries[i]));
  }
  if (!res.ok || !res.data?.attributes?.checkout_url) {
    console.error("checkout_sessions failed", res.status, res.message);
    return json({ error: "PAYMONGO", message: res.message || "Couldn't open the payment page." }, 502);
  }

  const history = (r.history || []).concat([{ at: new Date().toISOString(), text: "PayMongo checkout opened" }]);
  await db.from("reservations").update({ pm_checkout_id: res.data.id, site_url: site, history }).eq("id", r.id);
  return json({ ok: true, checkout_url: res.data.attributes.checkout_url });
});
