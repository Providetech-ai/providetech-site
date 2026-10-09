// PROVIDETECH — "Starting in 15 minutes" reminder emails for online (Zoom) sessions.
//
// Called every 2 minutes by the database (pg_cron → run_session_reminders()).
// Each paid participant of an online batch gets ONE email shortly before it starts,
// in the language they used at checkout. Settings: Admin → Settings → Reminder emails.
//
// Deployed with JWT verification OFF; protected by a secret header that only the
// database knows (private_config.cron_secret).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, SUPABASE_URL, SERVICE_KEY } from "./env.ts";
import { C, SANS, SERIF, deliver, esc, fill, type Lang } from "./zoom-email.ts";

const T: Record<Lang, Record<string, string>> = {
  en: {
    subject: "🔔 Starting in {m} minutes — where are you, {name}?",
    badge: "{m} minutes",
    headline: "Where are you, {name}?",
    intro: "We start in {m} minutes. Open Zoom now, grab a coffee, and meet us at {time} PHT sharp.",
    button: "Open the Zoom call",
    tip: "Bring one business problem you want to fix. We'll show you how to build the system for it.",
    sign: "— The PROVIDETECH team",
    details: "Meeting details",
    help: "Button not working? Copy this link:",
  },
  tl: {
    subject: "🔔 Magsisimula na sa {m} minuto — nasaan ka na, {name}?",
    badge: "{m} minuto",
    headline: "Nasaan ka na, {name}?",
    intro: "Magsisimula na tayo sa loob ng {m} minuto. Buksan na ang Zoom, magkape muna, at kita-kits sa {time} PHT sharp.",
    button: "Buksan ang Zoom call",
    tip: "Magdala ng isang problema sa negosyo na gusto mong ayusin. Ipapakita namin kung paano gawin ang system para dito.",
    sign: "— Ang PROVIDETECH team",
    details: "Detalye ng meeting",
    help: "Hindi gumagana ang button? Kopyahin ang link na ito:",
  },
  ceb: {
    subject: "🔔 Magsugod na sa {m} ka minuto — asa na ka, {name}?",
    badge: "{m} ka minuto",
    headline: "Asa na ka, {name}?",
    intro: "Magsugod na ta sulod sa {m} ka minuto. Ablihi na ang Zoom, pagkape sa, ug kita-kits sa {time} PHT sharp.",
    button: "Ablihi ang Zoom call",
    tip: "Pagdala og usa ka problema sa negosyo nga gusto nimong ayohon. Ipakita namo unsaon paghimo sa system para niini.",
    sign: "— Ang PROVIDETECH team",
    details: "Detalye sa meeting",
    help: "Dili mugana ang button? Kopyaha kini nga link:",
  },
};

/** First time in a label like "7:00 PM – 9:00 PM" → minutes after midnight, or null. */
export function startMinutes(label: string): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]/.exec(String(label || ""));
  if (!m) return null;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === "P" ? 12 : 0);
  return h * 60 + (Number(m[2]) || 0);
}
/** Session start as a Date (Philippine time, UTC+8, no daylight saving). */
export function startsAt(s: { date: string; time_label: string }): Date | null {
  const mins = startMinutes(s.time_label);
  if (mins === null || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return null;
  const hh = String(Math.floor(mins / 60)).padStart(2, "0"), mm = String(mins % 60).padStart(2, "0");
  return new Date(`${s.date}T${hh}:${mm}:00+08:00`);
}
function timeText(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
}

export function buildReminder(r: any, s: any, minutes: number) {
  const lang: Lang = (["en", "tl", "ceb"].includes(r.lang) ? r.lang : "en") as Lang;
  const t = T[lang];
  const first = String(r.name || "").trim().split(/\s+/)[0] || "there";
  const start = startsAt(s)!;
  const v = { name: first, m: String(minutes), time: timeText(start) };
  const subject = fill(t.subject, v);
  const notes = String(s.zoom_notes || "").trim();
  const link = String(s.zoom_link || "");
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "fil"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(fill(t.intro, v))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-top:4px solid ${C.blue};border-radius:14px">
<tr><td style="padding:34px 36px 0">
  <div style="font:800 15px/1 ${SANS};letter-spacing:.02em;color:${C.ink}">PROVIDETECH<span style="color:${C.blue}">&nbsp;AI</span></div>
  <div style="margin-top:24px"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${C.tint};font:700 12px/1 ${SANS};letter-spacing:.06em;color:${C.blueInk}">&#128276; ${esc(fill(t.badge, v))}</span></div>
  <h1 style="margin:16px 0 0;font:400 34px/1.18 ${SERIF};letter-spacing:-.01em;color:${C.ink}">${esc(fill(t.headline, v))}</h1>
  <p style="margin:16px 0 0;font:400 16px/1.7 ${SANS};color:${C.ink2}">${esc(fill(t.intro, v)).replace(esc(v.time + " PHT"), `<strong style="color:${C.ink}">${esc(v.time)} PHT</strong>`)}</p>
</td></tr>
<tr><td style="padding:26px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${C.blueInk}">
  <a href="${esc(link)}" style="display:inline-block;padding:16px 32px;font:700 16px/1 ${SANS};color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(t.button)}</a>
  </td></tr></table>
</td></tr>
${notes ? `<tr><td style="padding:18px 36px 0;font:400 13.5px/1.6 ${SANS};color:${C.ink3}"><b style="color:${C.ink2}">${esc(t.details)}:</b><br>${esc(notes).replace(/\n/g, "<br>")}</td></tr>` : ""}
<tr><td style="padding:24px 36px 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">
  <p style="margin:0 0 18px">${esc(t.tip)}</p>
  <p style="margin:0;color:${C.ink}">${esc(t.sign)}</p>
</td></tr>
<tr><td style="padding:22px 36px 30px">
  <p style="margin:0;padding-top:16px;border-top:1px solid ${C.line};font:400 12px/1.6 ${SANS};color:${C.ink3}">${esc(t.help)}<br><a href="${esc(link)}" style="color:${C.blueInk};word-break:break-all">${esc(link)}</a></p>
</td></tr>
</table>
<p style="margin:18px 0 0;font:400 12px/1.6 ${SANS};color:${C.ink3}">PROVIDETECH AI Assistance · ${esc(s.code)}</p>
</td></tr></table></body></html>`;
  const text = [fill(t.headline, v), "", fill(t.intro, v), "", `${t.button}: ${link}`, ...(notes ? ["", `${t.details}:`, notes] : []), "", t.tip, "", t.sign].join("\n");
  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD" }, 405);
  const db = createClient(SUPABASE_URL(), SERVICE_KEY(), { auth: { persistSession: false } });

  // Only the database's scheduled job knows this secret
  const { data: cfg } = await db.from("private_config").select("value").eq("key", "cron_secret").maybeSingle();
  const given = req.headers.get("x-cron-secret") || "";
  if (!cfg?.value || given !== cfg.value) return json({ error: "FORBIDDEN" }, 403);

  const { data: st } = await db.from("settings").select("value").eq("key", "reminders").maybeSingle();
  const conf = { enabled: st?.value?.enabled !== false, minutes: Math.max(5, Math.min(180, Number(st?.value?.minutes) || 15)) };
  if (!conf.enabled) return json({ ok: true, skipped: "disabled" });

  // Online batches today or tomorrow (Philippine date) that have a Zoom link
  const now = Date.now();
  const ymd = (ms: number) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
  const { data: sessions } = await db.from("sessions").select("*")
    .eq("format", "online").in("status", ["open", "full"]).in("date", [ymd(now), ymd(now + 864e5)]);

  const results: any[] = [];
  for (const s of sessions || []) {
    if (!/^https:\/\/\S+$/.test(String(s.zoom_link || ""))) continue;
    const start = startsAt(s);
    if (!start) continue;
    const untilMin = (start.getTime() - now) / 60000;
    if (untilMin <= 0 || untilMin > conf.minutes) continue; // not in the reminder window

    const { data: people } = await db.from("reservations").select("*")
      .eq("session_id", s.id).eq("status", "paid").is("reminder_sent_at", null);
    for (const r of people || []) {
      // Claim it first so two overlapping runs can never email the same person twice
      const at = new Date().toISOString();
      const { data: claimed } = await db.from("reservations").update({ reminder_sent_at: at })
        .eq("id", r.id).is("reminder_sent_at", null).select("id").maybeSingle();
      if (!claimed) continue;
      const minutes = Math.max(1, Math.round(untilMin / 5) * 5 || Math.ceil(untilMin));
      const mail = buildReminder(r, s, minutes);
      const sent = await deliver({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
      const { data: cur } = await db.from("reservations").select("history").eq("id", r.id).maybeSingle();
      const history = (cur?.history || []).concat([{ at: new Date().toISOString(), text: sent.ok ? `Reminder emailed (${minutes} min before start)` : `Reminder email failed: ${(sent as any).message}` }]);
      // On failure, release the claim so the next run tries again (while still before the start)
      await db.from("reservations").update({ history, ...(sent.ok ? {} : { reminder_sent_at: null }) }).eq("id", r.id);
      results.push({ id: r.id, ok: sent.ok });
    }
  }
  return json({ ok: true, sent: results.filter((x) => x.ok).length, failed: results.filter((x) => !x.ok).length });
});
