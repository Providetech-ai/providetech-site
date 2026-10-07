// PROVIDETECH — shared Zoom-link email (used by send-workshop-email and paymongo-webhook).
// Edit this file in supabase/functions/_shared/, then run:  node supabase/sync-shared.mjs
// (each function folder keeps its own copy so it deploys on its own).
// deno-lint-ignore-file no-explicit-any

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export type Lang = "en" | "tl" | "ceb";
const T: Record<Lang, Record<string, string>> = {
  en: {
    subject: "You're in, {name} · your Zoom link for {short}",
    eyebrow: "Seat confirmed",
    headline: "You're in, {name}.",
    intro: "Your payment went through and your seat in the {title} is locked in. Here's everything you need for {when}.",
    lWhen: "When", lBatch: "Batch", lWhere: "Where", where: "Online via Zoom (button below)", lDetails: "Meeting details",
    button: "Open the Zoom call",
    early: "Log in 10 minutes early and use a laptop if you can. The opening sets up everything that follows, so the first minutes matter most.",
    private: "This link is just for you, so please don't share it.",
    sign: "See you there,\nThe PROVIDETECH team",
    ps: "P.S. Save this email. It's your way in on the day. Questions? Just hit reply.",
    linkHelp: "Button not working? Copy this link:",
  },
  tl: {
    subject: "Pasok ka na, {name} · ang Zoom link mo para sa {short}",
    eyebrow: "Kumpirmado ang upuan",
    headline: "Pasok ka na, {name}.",
    intro: "Natanggap na namin ang bayad mo at naka-reserve na ang upuan mo sa {title}. Narito ang lahat ng kailangan mo para sa {when}.",
    lWhen: "Kailan", lBatch: "Batch", lWhere: "Saan", where: "Online sa Zoom (button sa ibaba)", lDetails: "Detalye ng meeting",
    button: "Buksan ang Zoom call",
    early: "Mag-log in 10 minuto bago magsimula at gumamit ng laptop kung maaari. Mahalaga ang unang mga minuto dahil dito nakasalalay ang lahat ng susunod.",
    private: "Para sa iyo lang ang link na ito, kaya huwag itong ibahagi.",
    sign: "Kita-kits,\nAng PROVIDETECH team",
    ps: "P.S. I-save ang email na ito. Ito ang daan mo papasok sa mismong araw. May tanong? Mag-reply lang.",
    linkHelp: "Hindi gumagana ang button? Kopyahin ang link na ito:",
  },
  ceb: {
    subject: "Sulod na ka, {name} · ang imong Zoom link para sa {short}",
    eyebrow: "Kumpirmado ang lingkoranan",
    headline: "Sulod na ka, {name}.",
    intro: "Nadawat na namo ang imong bayad ug naka-reserve na ang imong lingkoranan sa {title}. Ania ang tanan nimong kinahanglan para sa {when}.",
    lWhen: "Kanus-a", lBatch: "Batch", lWhere: "Asa", where: "Online sa Zoom (button sa ubos)", lDetails: "Detalye sa meeting",
    button: "Ablihi ang Zoom call",
    early: "Pag-log in 10 ka minuto sa dili pa magsugod ug gamit og laptop kung mahimo. Importante ang unang mga minuto kay diri nagsugod ang tanan.",
    private: "Para ra kanimo kini nga link, busa ayaw kini ipaambit.",
    sign: "Kita-kits,\nAng PROVIDETECH team",
    ps: "P.S. I-save kini nga email. Mao kini ang imong agianan pagsulod sa mismong adlaw. Naay pangutana? Pag-reply lang.",
    linkHelp: "Dili mugana ang button? Kopyaha kini nga link:",
  },
};
export function fill(s: string, v: Record<string, string>) { return s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? ""); }

export function formatDate(ymd: string, lang: Lang, short = false) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const opts: Intl.DateTimeFormatOptions = short
    ? { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Manila" }
    : { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Manila" };
  try { return dt.toLocaleDateString(lang === "en" ? "en-US" : "fil-PH", opts); } catch { return ymd; }
}

export const C = { page: "#F2F5F8", card: "#FFFFFF", line: "#E3E9EF", ink: "#0B1623", ink2: "#3B4B5D", ink3: "#6A7888", blue: "#0096FF", blueInk: "#0077D6", tint: "#F0F8FF" };
export const SANS = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const SERIF = "Georgia,'Times New Roman',Times,serif";

export function buildEmail(r: any, s: any) {
  const lang: Lang = (["en", "tl", "ceb"].includes(r.lang) ? r.lang : "en") as Lang;
  const t = T[lang];
  const first = String(r.name || "").trim().split(/\s+/)[0] || "there";
  const date = formatDate(s.date, lang);
  const when = date + (s.time_label ? " · " + s.time_label : "");
  const v = { name: first, title: s.title, code: s.code, when, short: formatDate(s.date, lang, true) };
  const subject = fill(t.subject, v);
  const notes = String(s.zoom_notes || "").trim();
  const intro = esc(fill(t.intro, v))
    .replace(esc(s.title), `<strong style="color:${C.ink}">${esc(s.title)}</strong>`)
    .replace(esc(when), `<strong style="color:${C.ink}">${esc(when)}</strong>`);
  const row = (label: string, value: string, last = false) =>
    `<tr><td style="padding:10px 0;${last ? "" : `border-bottom:1px solid ${C.line};`}font:500 13px/1.4 ${SANS};color:${C.ink3};width:110px;vertical-align:top">${esc(label)}</td>` +
    `<td style="padding:10px 0;${last ? "" : `border-bottom:1px solid ${C.line};`}font:600 14px/1.5 ${SANS};color:${C.ink};white-space:pre-line">${value}</td></tr>`;
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "fil"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(when)} · ${esc(t.button)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-top:4px solid ${C.blue};border-radius:14px">
<tr><td style="padding:34px 36px 0">
  <div style="font:800 15px/1 ${SANS};letter-spacing:.02em;color:${C.ink}">PROVIDETECH<span style="color:${C.blue}">&nbsp;AI</span></div>
  <div style="margin-top:26px;font:700 11px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${C.blueInk}">${esc(t.eyebrow)}</div>
  <h1 style="margin:12px 0 0;font:400 34px/1.18 ${SERIF};letter-spacing:-.01em;color:${C.ink}">${esc(fill(t.headline, v))}</h1>
  <p style="margin:18px 0 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">${intro}</p>
</td></tr>
<tr><td style="padding:22px 36px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tint};border-radius:10px"><tr><td style="padding:6px 18px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  ${row(t.lWhen, esc(when))}${row(t.lBatch, esc(s.code))}${row(t.lWhere, esc(t.where), !notes)}${notes ? row(t.lDetails, esc(notes), true) : ""}
  </table></td></tr></table>
</td></tr>
<tr><td style="padding:28px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${C.blueInk}">
  <a href="${esc(s.zoom_link)}" style="display:inline-block;padding:15px 30px;font:700 15px/1 ${SANS};color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(t.button)}</a>
  </td></tr></table>
</td></tr>
<tr><td style="padding:26px 36px 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">
  <p style="margin:0 0 14px">${esc(t.early)}</p>
  <p style="margin:0 0 22px">${esc(t.private)}</p>
  <p style="margin:0;white-space:pre-line;color:${C.ink}">${esc(t.sign)}</p>
</td></tr>
<tr><td style="padding:22px 36px 30px">
  <p style="margin:0;padding-top:18px;border-top:1px solid ${C.line};font:italic 400 14px/1.6 ${SERIF};color:${C.ink3}">${esc(t.ps)}</p>
  <p style="margin:16px 0 0;font:400 12px/1.6 ${SANS};color:${C.ink3}">${esc(t.linkHelp)}<br><a href="${esc(s.zoom_link)}" style="color:${C.blueInk};word-break:break-all">${esc(s.zoom_link)}</a></p>
</td></tr>
</table>
<p style="margin:18px 0 0;font:400 12px/1.6 ${SANS};color:${C.ink3}">PROVIDETECH AI Assistance</p>
</td></tr></table></body></html>`;
  const text = [
    fill(t.headline, v), "", fill(t.intro, v), "",
    `${t.lWhen}: ${when}`, `${t.lBatch}: ${s.code}`, `${t.lWhere}: Zoom`, ...(notes ? [`${t.lDetails}:`, notes] : []), "",
    `${t.button}: ${s.zoom_link}`, "", t.early, t.private, "", t.sign, "", t.ps,
  ].join("\n");
  return { subject, html, text };
}


// ---------- Minimal SMTP (implicit TLS, port 465) with clean MIME encoding ----------
const enc = new TextEncoder();
function b64(s: string) { let bin = ""; for (const b of enc.encode(s)) bin += String.fromCharCode(b); return btoa(bin); }
function wrap76(s: string) { return s.replace(/.{1,76}/g, "$&\r\n").trimEnd(); }
/** RFC 2047 header word(s): ASCII stays readable, anything else becomes =?UTF-8?B?...?= chunks. */
function encodeHeader(s: string) {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  const words: string[] = []; let chunk = "";
  for (const ch of s) { // split on characters so multi-byte letters never break
    if (enc.encode(chunk + ch).length > 42) { words.push(chunk); chunk = ""; }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${b64(w)}?=`).join("\r\n ");
}
export function buildMime(o: { fromName: string; from: string; to: string; replyTo?: string; subject: string; text: string; html: string }) {
  const boundary = "pt-" + crypto.randomUUID();
  const domain = o.from.split("@")[1] || "localhost";
  const head = [
    `From: ${encodeHeader(o.fromName)} <${o.from}>`,
    `To: <${o.to}>`,
    ...(o.replyTo ? [`Reply-To: <${o.replyTo}>`] : []),
    `Subject: ${encodeHeader(o.subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", wrap76(b64(body))].join("\r\n");
  return head.join("\r\n") + "\r\n\r\n" + part("text/plain", o.text.replace(/\r?\n/g, "\r\n")) + "\r\n" + part("text/html", o.html.replace(/\r?\n/g, "\r\n")) + `\r\n--${boundary}--\r\n`;
}
type Conn = { read(p: Uint8Array): Promise<number | null>; write(p: Uint8Array): Promise<number>; close(): void };
export async function smtpSend(cfg: { host: string; port: number; user: string; pass: string; plain?: boolean }, mime: string, from: string, to: string) {
  const conn: Conn = cfg.plain ? await Deno.connect({ hostname: cfg.host, port: cfg.port }) : await Deno.connectTls({ hostname: cfg.host, port: cfg.port });
  const dec = new TextDecoder(); let buf = "";
  const reply = async (): Promise<string> => {
    const lines: string[] = [];
    for (;;) {
      const i = buf.indexOf("\r\n");
      if (i >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 2); lines.push(line); if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) return lines.join("\n"); continue; }
      const chunk = new Uint8Array(4096); const n = await conn.read(chunk);
      if (n === null) throw new Error("Connection closed: " + lines.join(" "));
      buf += dec.decode(chunk.subarray(0, n), { stream: true });
    }
  };
  const expect = async (ok: string) => { const r = await reply(); if (!r.split("\n").pop()!.startsWith(ok)) throw new Error(r.split("\n").pop()); return r; };
  const send = async (cmd: string, ok: string) => { await conn.write(enc.encode(cmd + "\r\n")); return await expect(ok); };
  try {
    await expect("220");
    await send("EHLO providetech", "250");
    await send("AUTH LOGIN", "334");
    await send(btoa(cfg.user), "334");
    await send(btoa(cfg.pass), "235");
    await send(`MAIL FROM:<${from}>`, "250");
    await send(`RCPT TO:<${to}>`, "25");
    await send("DATA", "354");
    const body = mime.split("\r\n").map((l) => (l.startsWith(".") ? "." + l : l)).join("\r\n");
    await conn.write(enc.encode(body + "\r\n.\r\n"));
    await expect("250");
    try { await conn.write(enc.encode("QUIT\r\n")); } catch { /* ignore */ }
  } finally { try { conn.close(); } catch { /* ignore */ } }
}

export type SendResult = { ok: true; sent_at: string; email_id: string | null } | { ok: false; error: string; message: string; status: number };

export type Mail = { to: string; subject: string; html: string; text: string };

/**
 * Sends one email. Uses your Gmail when GMAIL_USER + GMAIL_APP_PASSWORD are set
 * (works for any recipient, ~500/day, no domain needed); otherwise Resend
 * (RESEND_API_KEY + EMAIL_FROM; needs a verified domain to reach other people).
 */
export async function deliver(m: Mail): Promise<{ ok: true; id: string | null } | { ok: false; error: string; message: string; status: number }> {
  const replyTo = Deno.env.get("EMAIL_REPLY_TO") || undefined;
  const gUser = (Deno.env.get("GMAIL_USER") || "").trim();
  const gPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
  if (gUser && gPass) {
    try {
      await smtpSend({ host: "smtp.gmail.com", port: 465, user: gUser, pass: gPass }, buildMime({ fromName: "PROVIDETECH AI Assistance", from: gUser, to: m.to, replyTo, subject: m.subject, text: m.text, html: m.html }), gUser, m.to);
      return { ok: true, id: null };
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      return { ok: false, error: "SEND_FAILED", message: /^5\d\d.*(auth|username|password|535|534)|535|534/i.test(msg) ? "Gmail rejected the login. Check GMAIL_USER and the 16-letter app password." : "Gmail: " + msg.slice(0, 200), status: 502 };
    }
  }
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) return { ok: false, error: "EMAIL_NOT_CONFIGURED", message: "Email sending isn't set up yet.", status: 503 };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `zoom-${crypto.randomUUID()}` },
    body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: "SEND_FAILED", message: (out && (out.message || out.name)) || `Resend error ${res.status}`, status: 502 };
  return { ok: true, id: out?.id || null };
}

/** Sends the Zoom email for a paid reservation and records it in its history. */
export async function sendZoomEmail(db: any, r: any, s: any): Promise<SendResult> {
  if (r.status !== "paid") return { ok: false, error: "NOT_PAID", message: "The Zoom link is only sent to paid participants.", status: 409 };
  if (!/^https:\/\/\S+$/.test(String(s.zoom_link || ""))) {
    return { ok: false, error: "NO_ZOOM_LINK", message: `Add the Zoom link to ${s.code} in Workshops first.`, status: 422 };
  }
  const mail = buildEmail(r, s);
  const sent = await deliver({ to: r.email, subject: mail.subject, html: mail.html, text: mail.text });
  if (!sent.ok && sent.error === "EMAIL_NOT_CONFIGURED") return sent;
  const { data: cur } = await db.from("reservations").select("history").eq("id", r.id).maybeSingle();
  const history = (cur?.history || r.history || []);
  if (!sent.ok) {
    await db.from("reservations").update({ history: history.concat([{ at: new Date().toISOString(), text: `Zoom email failed: ${sent.message}` }]) }).eq("id", r.id);
    return sent;
  }
  const sentAt = new Date().toISOString();
  await db.from("reservations").update({ zoom_email_sent_at: sentAt, history: history.concat([{ at: sentAt, text: `Zoom link emailed to ${r.email}` }]) }).eq("id", r.id);
  return { ok: true, sent_at: sentAt, email_id: sent.id };
}
