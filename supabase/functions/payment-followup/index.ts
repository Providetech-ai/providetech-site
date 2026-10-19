// PROVIDETECH — "Still interested?" follow-up emails for unpaid checkouts.
//
// Called every 15 minutes by the database (pg_cron → run_payment_followups()).
// Someone who started checkout but didn't pay gets at most 2 friendly emails:
//   #1  {first_hours} after they started checkout (default 1 hour)
//   #2  {second_hours} after the first one (default 24 hours) — "last reminder"
// Each email shows their order and a Pay button that opens a fresh QR Ph payment page.
// Nothing is sent once they've paid, the booking is cancelled, or registration for
// that session has closed. Settings: Admin → Settings → Payment follow-ups.
//
// Deployed with JWT verification OFF; protected by a secret header that only the
// database knows (private_config.cron_secret).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, SUPABASE_URL, SERVICE_KEY } from "./env.ts";
import { C, SANS, SERIF, deliver, esc, fill, formatDate, type Lang } from "./zoom-email.ts";

const T: Record<Lang, Record<string, string>> = {
  en: {
    subject1: "{name}, your seat isn't confirmed yet",
    subject2: "Last reminder: your seat for {date} is still open, {name}",
    badge: "Payment pending",
    head1: "Still want to join, {name}?",
    head2: "Last call, {name}",
    intro1: "You started signing up, but we haven't received your payment yet, so your seat isn't confirmed. Seats are limited — pay now to keep your spot.",
    intro2: "This is our last reminder. Your order is still waiting, but your seat is only confirmed once you pay.",
    order: "Your order",
    zoom: "Live on Zoom",
    hub: "Builder Hub (1 year)",
    hubSub: "Courses, tutorials, prompt library and community",
    total: "Total",
    button: "Pay {amt} and confirm my seat",
    easy: "Pay in a minute with QR Ph — GCash, Maya or any bank app. Right after you pay, we'll email your Zoom link{hub}.",
    hubMail: " and your Builder Hub access",
    help: "Trouble paying? Just reply to this email and we'll help you.",
    ignore1: "Changed your mind? No problem — ignore this email. We'll send at most one more reminder.",
    ignore2: "Changed your mind? No problem — this is the last reminder we'll send.",
    sign: "— The PROVIDETECH team",
    link: "Button not working? Copy this link:",
  },
  tl: {
    subject1: "{name}, hindi pa kumpirmado ang upuan mo",
    subject2: "Huling paalala: bukas pa ang upuan mo para sa {date}, {name}",
    badge: "Hinihintay ang bayad",
    head1: "Gusto mo pa bang sumali, {name}?",
    head2: "Huling tawag, {name}",
    intro1: "Nagsimula kang mag-sign up, pero hindi pa namin natatanggap ang bayad mo, kaya hindi pa kumpirmado ang upuan mo. Limitado ang upuan — magbayad na para makuha ito.",
    intro2: "Ito na ang huling paalala namin. Naghihintay pa ang order mo, pero kumpirmado lang ang upuan kapag nakabayad ka na.",
    order: "Ang order mo",
    zoom: "Live sa Zoom",
    hub: "Builder Hub (1 taon)",
    hubSub: "Courses, tutorials, prompt library at community",
    total: "Kabuuan",
    button: "Magbayad ng {amt} at kumpirmahin ang upuan",
    easy: "Magbayad sa loob ng isang minuto gamit ang QR Ph — GCash, Maya o kahit anong bank app. Pagkabayad mo, ie-email namin agad ang Zoom link mo{hub}.",
    hubMail: " at ang Builder Hub access mo",
    help: "May problema sa pagbayad? I-reply mo lang ang email na ito at tutulungan ka namin.",
    ignore1: "Nagbago ang isip mo? Okay lang — huwag nang pansinin ang email na ito. Isa pang paalala lang ang ipapadala namin.",
    ignore2: "Nagbago ang isip mo? Okay lang — ito na ang huling paalala na ipapadala namin.",
    sign: "— Ang PROVIDETECH team",
    link: "Hindi gumagana ang button? Kopyahin ang link na ito:",
  },
  ceb: {
    subject1: "{name}, wala pa makumpirma ang imong lingkoranan",
    subject2: "Katapusang pahinumdom: abli pa ang imong lingkoranan para sa {date}, {name}",
    badge: "Gihulat ang bayad",
    head1: "Gusto pa ka moapil, {name}?",
    head2: "Katapusang tawag, {name}",
    intro1: "Nagsugod ka og sign up, pero wala pa namo madawat ang imong bayad, busa wala pa makumpirma ang imong lingkoranan. Limitado ang lingkoranan — bayri na aron makuha kini.",
    intro2: "Mao na kini ang among katapusang pahinumdom. Naghulat pa ang imong order, pero kumpirmado ra ang lingkoranan kung nakabayad na ka.",
    order: "Imong order",
    zoom: "Live sa Zoom",
    hub: "Builder Hub (1 ka tuig)",
    hubSub: "Courses, tutorials, prompt library ug community",
    total: "Total",
    button: "Bayri ang {amt} ug kumpirmaha ang lingkoranan",
    easy: "Bayri sulod sa usa ka minuto gamit ang QR Ph — GCash, Maya o bisan unsang bank app. Human nimo mobayad, i-email dayon namo ang imong Zoom link{hub}.",
    hubMail: " ug ang imong Builder Hub access",
    help: "Naa kay problema sa pagbayad? I-reply lang kini nga email ug tabangan ka namo.",
    ignore1: "Nausab ang imong hunahuna? Okay ra — ayaw na lang tagda kini nga email. Usa na lang ka pahinumdom among ipadala.",
    ignore2: "Nausab ang imong hunahuna? Okay ra — mao na kini ang katapusang pahinumdom nga among ipadala.",
    sign: "— Ang PROVIDETECH team",
    link: "Dili mugana ang button? Kopyaha kini nga link:",
  },
};

const peso = (n: number) => "₱" + Number(n || 0).toLocaleString("en-PH");

/** First time in a label like "7:00 PM – 9:30 PM" → session start (Philippine time). */
function startsAt(s: any): Date | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]/.exec(String(s.time_label || ""));
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(String(s.date || ""))) return null;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "P" ? 12 : 0);
  return new Date(`${s.date}T${String(h).padStart(2, "0")}:${String(Number(m[2]) || 0).padStart(2, "0")}:00+08:00`);
}

/** Can this session still be paid for right now? */
function stillOpen(s: any, now: number): boolean {
  if (!s || !["open", "full"].includes(s.status)) return false;
  if (s.format === "hub") return true;
  const today = new Date(now + 8 * 3600e3).toISOString().slice(0, 10);
  if (String(s.date) < today) return false;
  if ((s.format || "online") === "online") {
    const st = startsAt(s);
    if (st && now >= st.getTime() - 60 * 60e3) return false; // registration closes 1 hour before
  }
  return true;
}

export function buildFollowup(r: any, group: any[], sessById: Record<string, any>, n: 1 | 2, payUrl: string) {
  const lang: Lang = (["en", "tl", "ceb"].includes(r.lang) ? r.lang : "en") as Lang;
  const t = T[lang];
  const first = String(r.name || "").trim().split(/\s+/)[0] || "there";
  const main = group.map((x) => sessById[x.session_id]).find((s) => s && s.format !== "hub");
  const total = group.reduce((a, x) => a + Number(x.amount || 0), 0);
  const hasHub = group.some((x) => x.addon_hub) || group.some((x) => sessById[x.session_id]?.format === "hub");
  const v = { name: first, date: main ? formatDate(main.date, lang, true) : "PROVIDETECH", amt: peso(total), hub: hasHub ? t.hubMail : "" };
  const subject = fill(n === 1 ? t.subject1 : t.subject2, v);
  const head = fill(n === 1 ? t.head1 : t.head2, v);
  const intro = n === 1 ? t.intro1 : t.intro2;

  const rows: string[] = [];
  const textRows: string[] = [];
  for (const x of group) {
    const s = sessById[x.session_id];
    if (!s) continue;
    const addon = x.addon_hub ? Number(x.addon_amount || 0) : 0;
    if (s.format !== "hub") {
      const where = s.format === "f2f" ? String(s.venue || "") : s.format === "home" ? String(x.address || "") : t.zoom;
      const when = s.format === "home" ? "" : `${formatDate(s.date, lang)}${s.time_label ? " · " + s.time_label : ""}`;
      rows.push(`<tr><td style="padding:14px 18px;border-bottom:1px solid ${C.line}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font:700 15px/1.4 ${SANS};color:${C.ink}">${esc(s.title)}</td>
          <td align="right" style="font:600 15px/1.4 ${SANS};color:${C.ink};white-space:nowrap;padding-left:12px">${esc(peso(Number(x.amount || 0) - addon))}</td></tr></table>
        ${when ? `<div style="font:400 13.5px/1.6 ${SANS};color:${C.ink3}">${esc(when)}</div>` : ""}
        ${where ? `<div style="font:400 13.5px/1.6 ${SANS};color:${C.ink3}">${esc(where)}</div>` : ""}
      </td></tr>`);
      textRows.push(`- ${s.title} — ${peso(Number(x.amount || 0) - addon)}${when ? " · " + when : ""}${where ? " · " + where : ""}`);
    }
    if (addon > 0 || s.format === "hub") {
      const amt = addon > 0 ? addon : Number(x.amount || 0);
      rows.push(`<tr><td style="padding:14px 18px;border-bottom:1px solid ${C.line}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font:700 15px/1.4 ${SANS};color:${C.ink}">${esc(t.hub)}</td>
          <td align="right" style="font:600 15px/1.4 ${SANS};color:${C.ink};white-space:nowrap;padding-left:12px">${esc(peso(amt))}</td></tr></table>
        <div style="font:400 13.5px/1.6 ${SANS};color:${C.ink3}">${esc(t.hubSub)}</div>
      </td></tr>`);
      textRows.push(`- ${t.hub} — ${peso(amt)}`);
    }
  }
  const button = fill(t.button, v);
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "fil"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-top:4px solid #E8A33D;border-radius:14px">
<tr><td style="padding:34px 36px 0">
  <div style="font:800 15px/1 ${SANS};letter-spacing:.02em;color:${C.ink}">PROVIDETECH<span style="color:${C.blue}">&nbsp;AI</span></div>
  <div style="margin-top:24px"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:#FFF3DF;font:800 12px/1 ${SANS};letter-spacing:.08em;text-transform:uppercase;color:#975400">&#9679; ${esc(t.badge)}</span></div>
  <h1 style="margin:16px 0 0;font:400 32px/1.18 ${SERIF};letter-spacing:-.01em;color:${C.ink}">${esc(head)}</h1>
  <p style="margin:16px 0 0;font:400 16px/1.7 ${SANS};color:${C.ink2}">${esc(intro)}</p>
</td></tr>
<tr><td style="padding:24px 36px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:12px;border-collapse:separate">
    <tr><td style="padding:12px 18px;border-bottom:1px solid ${C.line};font:700 11px/1 ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${C.blueInk}">${esc(t.order)}</td></tr>
    ${rows.join("")}
    <tr><td style="padding:14px 18px;background:${C.tint};border-radius:0 0 12px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:800 17px/1.3 ${SANS};color:${C.ink}">${esc(t.total)}</td>
        <td align="right" style="font:800 17px/1.3 ${SANS};color:${C.ink}">${esc(peso(total))}</td></tr></table>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${C.blueInk}">
  <a href="${esc(payUrl)}" style="display:inline-block;padding:16px 30px;font:700 16px/1.2 ${SANS};color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(button)} &rarr;</a>
  </td></tr></table>
  <p style="margin:14px 0 0;font:400 14px/1.6 ${SANS};color:${C.ink3}">${esc(fill(t.easy, v))}</p>
</td></tr>
<tr><td style="padding:22px 36px 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">
  <p style="margin:0 0 12px">${esc(t.help)}</p>
  <p style="margin:0 0 18px">${esc(n === 1 ? t.ignore1 : t.ignore2)}</p>
  <p style="margin:0;color:${C.ink}">${esc(t.sign)}</p>
</td></tr>
<tr><td style="padding:22px 36px 30px">
  <p style="margin:0;padding-top:16px;border-top:1px solid ${C.line};font:400 12px/1.6 ${SANS};color:${C.ink3}">${esc(t.link)}<br><a href="${esc(payUrl)}" style="color:${C.blueInk};word-break:break-all">${esc(payUrl)}</a></p>
</td></tr>
</table>
<p style="margin:18px 0 0;font:400 12px/1.6 ${SANS};color:${C.ink3}">PROVIDETECH AI Assistance · providetechai.live</p>
</td></tr></table></body></html>`;
  const text = [head, "", intro, "", t.order + ":", ...textRows, `${t.total}: ${peso(total)}`, "", `${button}: ${payUrl}`, "", fill(t.easy, v), "", t.help, n === 1 ? t.ignore1 : t.ignore2, "", t.sign].join("\n");
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });

  const { data: cfg } = await db.from("private_config").select("value").eq("key", "cron_secret").maybeSingle();
  const given = req.headers.get("x-cron-secret") || "";
  if (!cfg?.value || given !== cfg.value) return json({ error: "FORBIDDEN" }, 403);

  const body = await req.json().catch(() => ({}));
  // Test mode: only this address, right now, whatever the timing or on/off switch.
  const testEmail = String(body?.test_email || "").trim().toLowerCase();

  const { data: st } = await db.from("settings").select("value").eq("key", "followups").maybeSingle();
  const conf = {
    enabled: st?.value?.enabled === true,
    first: Math.max(0.25, Math.min(72, Number(st?.value?.first_hours) || 1)),
    second: Math.max(1, Math.min(168, Number(st?.value?.second_hours) || 24)),
  };
  if (!conf.enabled && !testEmail) return json({ ok: true, skipped: "disabled" });

  const now = Date.now();
  let q = db.from("reservations").select("*").eq("status", "pending").lt("followup_count", 2).order("created_at");
  if (testEmail) q = q.eq("email", testEmail);
  const { data: pend } = await q;
  if (!pend?.length) return json({ ok: true, sent: 0 });

  const { data: sessRows } = await db.from("sessions").select("*").in("id", [...new Set(pend.map((x: any) => x.session_id))]);
  const sessById: Record<string, any> = Object.fromEntries((sessRows || []).map((x: any) => [x.id, x]));
  const site = String(Deno.env.get("SITE_URL") || "https://providetechai.live").trim().replace(/\/+$/, "");

  const done = new Set<string>();
  const results: any[] = [];
  for (const r of pend) {
    const key = r.order_id || r.id;
    if (done.has(key)) continue;
    done.add(key);
    const group = r.order_id ? pend.filter((x: any) => x.order_id === r.order_id) : [r];
    const count = Number(r.followup_count || 0);
    if (!testEmail) {
      const due = count === 0
        ? new Date(r.created_at).getTime() + conf.first * 3600e3
        : new Date(r.followup_last_at || r.created_at).getTime() + conf.second * 3600e3;
      if (now < due) continue;
    }
    // Only for sessions that can still be paid for
    if (!group.every((x: any) => stillOpen(sessById[x.session_id], now))) continue;
    // Already paid with another attempt? Then stop for good.
    const { count: paid } = await db.from("reservations").select("id", { count: "exact", head: true })
      .eq("email", r.email).in("session_id", group.map((x: any) => x.session_id)).in("status", ["paid", "refund_requested"]);
    if ((paid || 0) > 0) continue;

    // Claim first so overlapping runs never send twice
    const at = new Date().toISOString();
    const { data: claimed } = await db.from("reservations").update({ followup_count: count + 1, followup_last_at: at })
      .eq("id", r.id).eq("followup_count", count).select("id").maybeSingle();
    if (!claimed) continue;
    for (const x of group) if (x.id !== r.id) await db.from("reservations").update({ followup_count: count + 1, followup_last_at: at }).eq("id", x.id);

    const n = (count + 1) as 1 | 2;
    const lang = ["en", "tl", "ceb"].includes(r.lang) ? r.lang : "en";
    const payUrl = `${site}/checkout?pay=${r.id}&lang=${lang}`;
    const mail = buildFollowup(r, group, sessById, n, payUrl);
    const sent = await deliver({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
    for (const x of group) {
      const { data: cur } = await db.from("reservations").select("history").eq("id", x.id).maybeSingle();
      const history = (cur?.history || []).concat([{ at: new Date().toISOString(), text: sent.ok ? `Payment follow-up email #${n} sent${testEmail ? " (test)" : ""}` : `Payment follow-up email failed: ${(sent as any).message}` }]);
      await db.from("reservations").update({ history, ...(sent.ok ? {} : { followup_count: count, followup_last_at: x.followup_last_at || null }) }).eq("id", x.id);
    }
    results.push({ id: r.id, email: r.email, n, ok: sent.ok });
  }
  return json({ ok: true, sent: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length, results });
});
