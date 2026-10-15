// PROVIDETECH — automatic "We got your message" reply for website inquiries
// ("Talk to Our Team" / "Discuss Your Business Idea").
//
// Called by the database right after an inquiry is saved (trigger → pg_net).
// Sends ONE thank-you email to the visitor, in the language they used on the site,
// and records it on the inquiry (autoreply_sent_at / autoreply_status).
// On/off: Admin → Settings → Inquiry auto-reply.
//
// Deployed with JWT verification OFF; protected by a secret header that only the
// database knows (private_config.cron_secret).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, SUPABASE_URL, SERVICE_KEY } from "./env.ts";
import { C, SANS, SERIF, deliver, esc, fill, type Lang } from "./zoom-email.ts";

const T: Record<Lang, Record<string, string>> = {
  en: {
    subject: "We got your message, {name} — PROVIDETECH",
    headline: "Thanks, {name}. We got your message.",
    intro: "Thank you for reaching out to PROVIDETECH AI Assistance. A real person from our team will read it and reply to you personally within 1 business day.",
    recap: "What you sent us",
    need: "You need",
    business: "Business",
    message: "Your message",
    next: "Want to add details, like your budget, timeline or how you do things today? Just reply to this email.",
    sign: "— The PROVIDETECH team",
    why: "You're getting this because you sent a message on our website. This is an automatic reply.",
  },
  tl: {
    subject: "Natanggap namin ang mensahe mo, {name} — PROVIDETECH",
    headline: "Salamat, {name}. Natanggap namin ang mensahe mo.",
    intro: "Salamat sa pag-message sa PROVIDETECH AI Assistance. Babasahin ito ng isang tao mula sa team namin at personal ka naming sasagutin sa loob ng 1 business day.",
    recap: "Ang ipinadala mo",
    need: "Kailangan mo",
    business: "Negosyo",
    message: "Mensahe mo",
    next: "Gusto mo bang magdagdag ng detalye, gaya ng budget, timeline o kung paano mo ito ginagawa ngayon? I-reply mo lang ang email na ito.",
    sign: "— Ang PROVIDETECH team",
    why: "Natanggap mo ito dahil nag-message ka sa aming website. Automatic na reply ito.",
  },
  ceb: {
    subject: "Nadawat namo ang imong mensahe, {name} — PROVIDETECH",
    headline: "Salamat, {name}. Nadawat namo ang imong mensahe.",
    intro: "Salamat sa pag-message sa PROVIDETECH AI Assistance. Basahon kini sa usa ka tawo gikan sa among team ug personal ka namong tubagon sulod sa 1 business day.",
    recap: "Ang imong gipadala",
    need: "Imong kinahanglan",
    business: "Negosyo",
    message: "Imong mensahe",
    next: "Gusto ka modugang og detalye, sama sa budget, timeline o unsaon nimo kini pagbuhat karon? I-reply lang kini nga email.",
    sign: "— Ang PROVIDETECH team",
    why: "Nadawat nimo kini kay nag-message ka sa among website. Automatic kini nga reply.",
  },
};

export function buildAutoReply(q: any) {
  const lang: Lang = (["en", "tl", "ceb"].includes(q.lang) ? q.lang : "en") as Lang;
  const t = T[lang];
  const first = String(q.name || "").trim().split(/\s+/)[0] || "there";
  const v = { name: first };
  const subject = fill(t.subject, v);
  const rows: [string, string][] = [];
  if (String(q.need || "").trim()) rows.push([t.need, String(q.need).trim()]);
  if (String(q.business || "").trim()) rows.push([t.business, String(q.business).trim()]);
  const msg = String(q.message || "").trim().slice(0, 1200);
  const recapHtml = rows.length || msg ? `
<tr><td style="padding:24px 36px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tint};border-radius:12px"><tr><td style="padding:18px 20px;font:400 14px/1.6 ${SANS};color:${C.ink2}">
    <div style="font:700 12px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:${C.blueInk};margin-bottom:10px">${esc(t.recap)}</div>
    ${rows.map(([k, val]) => `<div><b style="color:${C.ink}">${esc(k)}:</b> ${esc(val)}</div>`).join("")}
    ${msg ? `<div style="margin-top:${rows.length ? 10 : 0}px"><b style="color:${C.ink}">${esc(t.message)}:</b><br>${esc(msg).replace(/\n/g, "<br>")}</div>` : ""}
  </td></tr></table>
</td></tr>` : "";
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "fil"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(t.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-top:4px solid ${C.blue};border-radius:14px">
<tr><td style="padding:34px 36px 0">
  <div style="font:800 15px/1 ${SANS};letter-spacing:.02em;color:${C.ink}">PROVIDETECH<span style="color:${C.blue}">&nbsp;AI</span></div>
  <h1 style="margin:24px 0 0;font:400 30px/1.2 ${SERIF};letter-spacing:-.01em;color:${C.ink}">${esc(fill(t.headline, v))}</h1>
  <p style="margin:16px 0 0;font:400 16px/1.7 ${SANS};color:${C.ink2}">${esc(t.intro)}</p>
</td></tr>${recapHtml}
<tr><td style="padding:24px 36px 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">
  <p style="margin:0 0 18px">${esc(t.next)}</p>
  <p style="margin:0;color:${C.ink}">${esc(t.sign)}</p>
</td></tr>
<tr><td style="padding:22px 36px 30px">
  <p style="margin:0;padding-top:16px;border-top:1px solid ${C.line};font:400 12px/1.6 ${SANS};color:${C.ink3}">${esc(t.why)}</p>
</td></tr>
</table>
<p style="margin:18px 0 0;font:400 12px/1.6 ${SANS};color:${C.ink3}">PROVIDETECH AI Assistance · providetechai.live</p>
</td></tr></table></body></html>`;
  const text = [fill(t.headline, v), "", t.intro, "",
    ...(rows.length || msg ? [t.recap + ":", ...rows.map(([k, val]) => `${k}: ${val}`), ...(msg ? [`${t.message}: ${msg}`] : []), ""] : []),
    t.next, "", t.sign, "", t.why].join("\n");
  return { subject, html, text };
}

const MAX_PER_DAY = 60;          // safety cap for the whole site
const ONE_PER_EMAIL_HOURS = 24;  // never auto-reply the same address twice within a day

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });

  // Only the database knows this secret
  const { data: cfg } = await db.from("private_config").select("value").eq("key", "cron_secret").maybeSingle();
  const given = req.headers.get("x-cron-secret") || "";
  if (!cfg?.value || given !== cfg.value) return json({ error: "FORBIDDEN" }, 403);

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "ID" }, 400);

  const { data: st } = await db.from("settings").select("value").eq("key", "inquiry_reply").maybeSingle();
  if (st?.value?.enabled === false) {
    await db.from("inquiries").update({ autoreply_status: "off" }).eq("id", id).is("autoreply_sent_at", null);
    return json({ ok: true, skipped: "disabled" });
  }

  const { data: q } = await db.from("inquiries").select("*").eq("id", id).maybeSingle();
  if (!q) return json({ ok: true, skipped: "not found" });
  const email = String(q.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    await db.from("inquiries").update({ autoreply_status: "no email" }).eq("id", id);
    return json({ ok: true, skipped: "no email" });
  }
  if (q.autoreply_sent_at) return json({ ok: true, skipped: "already sent" });

  // Anti-abuse: one auto-reply per address per day, and a daily cap for the whole site
  const since = new Date(Date.now() - ONE_PER_EMAIL_HOURS * 3600e3).toISOString();
  const { count: sameAddr } = await db.from("inquiries").select("id", { count: "exact", head: true })
    .eq("email", email).gte("autoreply_sent_at", since);
  const { count: today } = await db.from("inquiries").select("id", { count: "exact", head: true })
    .gte("autoreply_sent_at", new Date(Date.now() - 864e5).toISOString());
  if ((sameAddr || 0) > 0 || (today || 0) >= MAX_PER_DAY) {
    await db.from("inquiries").update({ autoreply_status: "skipped (limit)" }).eq("id", id);
    return json({ ok: true, skipped: "limit" });
  }

  // Claim first so a retry can never send twice
  const at = new Date().toISOString();
  const { data: claimed } = await db.from("inquiries").update({ autoreply_sent_at: at, autoreply_status: "sending" })
    .eq("id", id).is("autoreply_sent_at", null).select("id").maybeSingle();
  if (!claimed) return json({ ok: true, skipped: "already sent" });

  const mail = buildAutoReply(q);
  const sent = await deliver({ to: email, subject: mail.subject, html: mail.html, text: mail.text });
  if (sent.ok) {
    await db.from("inquiries").update({ autoreply_status: "sent" }).eq("id", id);
    return json({ ok: true, sent: true });
  }
  await db.from("inquiries").update({ autoreply_sent_at: null, autoreply_status: "failed: " + String((sent as any).message || "").slice(0, 140) }).eq("id", id);
  return json({ ok: false, error: (sent as any).error, message: (sent as any).message }, 502);
});
