// GENERATED from _shared/hub.ts — edit that file instead.
// PROVIDETECH — Builder Hub membership: create/extend members, one-time password links, access emails.
// Copied into each function folder by sync-shared.mjs.
// deno-lint-ignore-file no-explicit-any
import { C, SANS, SERIF, deliver, esc, fill, type Lang } from "./zoom-email.ts";

export const HUB_NAME = "PROVIDETECH Builder Hub";

// ---------- tokens ----------
function b64url(bytes: Uint8Array) { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Creates a one-time link token. Only its hash is stored. */
export async function makeToken(db: any, userId: string, purpose: "welcome" | "reset") {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const hours = purpose === "welcome" ? 24 * 7 : 1;
  const { error } = await db.from("member_tokens").insert({ token_hash: await sha256Hex(token), user_id: userId, purpose, expires_at: new Date(Date.now() + hours * 3600e3).toISOString() });
  if (error) throw new Error("Couldn't create link: " + error.message);
  return token;
}
export function siteBase(...candidates: (string | null | undefined)[]) {
  for (const c of [Deno.env.get("SITE_URL"), ...candidates]) {
    const v = String(c || "").trim().replace(/\/+$/, "");
    if (/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(v)) return v;
  }
  return "";
}

// ---------- members ----------
export async function hubMonths(db: any) {
  const { data } = await db.from("settings").select("value").eq("key", "hub_offer").maybeSingle();
  return Math.max(1, Math.min(60, Number(data?.value?.months) || 12));
}
function addMonths(from: Date, months: number) { const d = new Date(from); d.setMonth(d.getMonth() + months); return d; }

/**
 * Gives someone Builder Hub access (or extends it). Creates their login if needed.
 * Returns the member row and whether they still need to set a password.
 */
export async function provisionMember(db: any, o: { email: string; name: string; lang?: string; months: number; source: string; reservationId?: string | null; note: string }) {
  const email = String(o.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Invalid email.");
  const lang = ["en", "tl", "ceb"].includes(String(o.lang)) ? o.lang : "en";
  const now = new Date();
  const { data: existing } = await db.from("members").select("*").eq("email", email).maybeSingle();
  if (existing && o.reservationId && existing.reservation_id === o.reservationId) {
    return { member: existing, isNew: false }; // same purchase seen again: don't add another year
  }
  if (existing) {
    const base = new Date(existing.access_until) > now ? new Date(existing.access_until) : now;
    const until = addMonths(base, o.months).toISOString();
    const history = (existing.history || []).concat([{ at: now.toISOString(), text: `${o.note} · access until ${until.slice(0, 10)}` }]);
    const { data, error } = await db.from("members").update({ access_until: until, history, ...(o.reservationId ? { reservation_id: o.reservationId } : {}) }).eq("user_id", existing.user_id).select().single();
    if (error) throw new Error(error.message);
    return { member: data, isNew: false };
  }
  // Find or create the login
  let userId: string | null = null;
  const { data: found } = await db.rpc("auth_user_id_by_email", { p_email: email });
  if (found) userId = found as string;
  else {
    const { data: made, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { name: o.name } });
    if (error) {
      const { data: again } = await db.rpc("auth_user_id_by_email", { p_email: email });
      if (!again) throw new Error("Couldn't create login: " + error.message);
      userId = again as string;
    } else userId = made.user.id;
  }
  const until = addMonths(now, o.months).toISOString();
  const { data, error } = await db.from("members").insert({
    user_id: userId, email, name: String(o.name || "").slice(0, 120), lang, access_until: until, source: o.source,
    reservation_id: o.reservationId || null, history: [{ at: now.toISOString(), text: `${o.note} · access until ${until.slice(0, 10)}` }],
  }).select().single();
  if (error) throw new Error(error.message);
  return { member: data, isNew: true };
}

// ---------- emails ----------
const T: Record<Lang, Record<string, string>> = {
  en: {
    subject: "Your Builder Hub access is ready, {name}",
    rsubject: "Reset your Builder Hub password",
    eyebrow: "Builder Hub access", reyebrow: "Password reset",
    headline: "Your Builder Hub is ready, {name}.", rheadline: "Let's get you back in, {name}.",
    intro: "Your PROVIDETECH Builder Hub membership is active. Set your password once and that's your single key in.",
    rintro: "Someone (hopefully you) asked to reset your Builder Hub password. Choose a new one with the button below.",
    lLogin: "Your login (email)", lUntil: "Access until",
    bSet: "Set your password", bLogin: "Log in to the Builder Hub", bReset: "Choose a new password",
    expires: "For your security, this button works once and expires in 7 days.", rexpires: "This button works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.",
    inside: "Inside the hub", i1: "Every past live build recording, end to end", i2: "Step-by-step AI build tutorials, growing every month", i3: "Prompt library and ready-to-use templates", i4: "A private community for questions, wins and help",
    forgot: "Forgot your password later? Use \"Forgot password\" on the login page.",
    sign: "See you inside,\nThe PROVIDETECH team",
  },
  tl: {
    subject: "Handa na ang Builder Hub access mo, {name}",
    rsubject: "I-reset ang password mo sa Builder Hub",
    eyebrow: "Builder Hub access", reyebrow: "Pag-reset ng password",
    headline: "Handa na ang Builder Hub mo, {name}.", rheadline: "Ibalik ka natin sa loob, {name}.",
    intro: "Aktibo na ang membership mo sa PROVIDETECH Builder Hub. Mag-set ng password nang isang beses at iyon na ang susi mo papasok.",
    rintro: "May humiling na i-reset ang password mo sa Builder Hub. Pumili ng bago gamit ang button sa ibaba.",
    lLogin: "Ang login mo (email)", lUntil: "Access hanggang",
    bSet: "I-set ang password mo", bLogin: "Mag-log in sa Builder Hub", bReset: "Pumili ng bagong password",
    expires: "Para sa seguridad mo, isang beses lang gumagana ang button na ito at mag-e-expire sa loob ng 7 araw.", rexpires: "Isang beses lang gumagana ang button at mag-e-expire sa loob ng 1 oras. Kung hindi ikaw ang humiling, huwag pansinin ang email na ito.",
    inside: "Nasa loob ng hub", i1: "Lahat ng nakaraang live build recording, buo mula simula hanggang dulo", i2: "Step-by-step na AI build tutorials, nadadagdagan bawat buwan", i3: "Prompt library at ready-to-use na templates", i4: "Pribadong community para sa tanong, wins at tulong",
    forgot: "Nakalimutan ang password? Gamitin ang \"Forgot password\" sa login page.",
    sign: "Kita-kits sa loob,\nAng PROVIDETECH team",
  },
  ceb: {
    subject: "Andam na ang imong Builder Hub access, {name}",
    rsubject: "I-reset ang imong password sa Builder Hub",
    eyebrow: "Builder Hub access", reyebrow: "Pag-reset sa password",
    headline: "Andam na ang imong Builder Hub, {name}.", rheadline: "Ibalik ta ka sa sulod, {name}.",
    intro: "Aktibo na ang imong membership sa PROVIDETECH Builder Hub. Pag-set og password kausa ug mao na kana ang imong yawe pagsulod.",
    rintro: "Adunay mihangyo nga i-reset ang imong password sa Builder Hub. Pagpili og bag-o gamit ang button sa ubos.",
    lLogin: "Imong login (email)", lUntil: "Access hangtod",
    bSet: "I-set ang imong password", bLogin: "Pag-log in sa Builder Hub", bReset: "Pagpili og bag-ong password",
    expires: "Para sa imong seguridad, kausa ra mugana kini nga button ug mo-expire sulod sa 7 ka adlaw.", rexpires: "Kausa ra mugana ang button ug mo-expire sulod sa 1 ka oras. Kung dili ikaw ang nihangyo, ayaw lang tagda kini nga email.",
    inside: "Sulod sa hub", i1: "Tanang nangaging live build recording, tibuok gikan sugod hangtod katapusan", i2: "Step-by-step nga AI build tutorials, nagdugang matag bulan", i3: "Prompt library ug ready-to-use nga templates", i4: "Pribadong community para sa pangutana, wins ug tabang",
    forgot: "Nakalimtan ang password? Gamita ang \"Forgot password\" sa login page.",
    sign: "Kita-kits sa sulod,\nAng PROVIDETECH team",
  },
};
function untilText(iso: string, lang: Lang) {
  try { return new Date(iso).toLocaleDateString(lang === "en" ? "en-US" : "fil-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Manila" }); } catch { return iso.slice(0, 10); }
}
export function buildHubEmail(m: any, link: string, kind: "welcome" | "login" | "reset") {
  const lang: Lang = (["en", "tl", "ceb"].includes(m.lang) ? m.lang : "en") as Lang;
  const t = T[lang];
  const first = String(m.name || "").trim().split(/\s+/)[0] || "there";
  const v = { name: first };
  const reset = kind === "reset";
  const subject = fill(reset ? t.rsubject : t.subject, v);
  const button = reset ? t.bReset : kind === "welcome" ? t.bSet : t.bLogin;
  const rows = `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.line};font:500 13px/1.4 ${SANS};color:${C.ink3};width:130px">${esc(t.lLogin)}</td><td style="padding:10px 0;border-bottom:1px solid ${C.line};font:600 14px/1.5 ${SANS};color:${C.ink}">${esc(m.email)}</td></tr>` +
    `<tr><td style="padding:10px 0;font:500 13px/1.4 ${SANS};color:${C.ink3}">${esc(t.lUntil)}</td><td style="padding:10px 0;font:600 14px/1.5 ${SANS};color:${C.ink}">${esc(untilText(m.access_until, lang))}</td></tr>`;
  const items = [t.i1, t.i2, t.i3, t.i4].map((x) => `<li style="margin:0 0 6px">${esc(x)}</li>`).join("");
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "fil"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:32px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-top:4px solid ${C.blue};border-radius:14px">
<tr><td style="padding:34px 36px 0">
  <div style="font:800 15px/1 ${SANS};letter-spacing:.02em;color:${C.ink}">PROVIDETECH<span style="color:${C.blue}">&nbsp;AI</span></div>
  <div style="margin-top:26px;font:700 11px/1 ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${C.blueInk}">${esc(reset ? t.reyebrow : t.eyebrow)}</div>
  <h1 style="margin:12px 0 0;font:400 32px/1.2 ${SERIF};letter-spacing:-.01em;color:${C.ink}">${esc(fill(reset ? t.rheadline : t.headline, v))}</h1>
  <p style="margin:18px 0 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">${esc(reset ? t.rintro : t.intro)}</p>
</td></tr>
${reset ? "" : `<tr><td style="padding:22px 36px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tint};border-radius:10px"><tr><td style="padding:6px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table></td></tr>`}
<tr><td style="padding:28px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:999px;background:${C.blueInk}">
  <a href="${esc(link)}" style="display:inline-block;padding:15px 30px;font:700 15px/1 ${SANS};color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(button)} &rarr;</a>
  </td></tr></table>
  ${kind === "login" ? "" : `<p style="margin:12px 0 0;font:400 12.5px/1.6 ${SANS};color:${C.ink3}">${esc(reset ? t.rexpires : t.expires)}</p>`}
</td></tr>
${reset ? "" : `<tr><td style="padding:24px 36px 0;font:400 15px/1.7 ${SANS};color:${C.ink2}">
  <p style="margin:0 0 8px;font-weight:600;color:${C.ink}">${esc(t.inside)}</p>
  <ul style="margin:0;padding-left:20px">${items}</ul>
</td></tr>`}
<tr><td style="padding:22px 36px 30px;font:400 15px/1.7 ${SANS};color:${C.ink2}">
  <p style="margin:0 0 18px;white-space:pre-line;color:${C.ink}">${esc(t.sign)}</p>
  <p style="margin:0;padding-top:16px;border-top:1px solid ${C.line};font:400 12.5px/1.6 ${SANS};color:${C.ink3}">${esc(t.forgot)}<br><a href="${esc(link)}" style="color:${C.blueInk};word-break:break-all">${esc(link)}</a></p>
</td></tr>
</table>
<p style="margin:18px 0 0;font:400 12px/1.6 ${SANS};color:${C.ink3}">PROVIDETECH AI Assistance</p>
</td></tr></table></body></html>`;
  const text = [fill(reset ? t.rheadline : t.headline, v), "", reset ? t.rintro : t.intro, "",
    ...(reset ? [] : [`${t.lLogin}: ${m.email}`, `${t.lUntil}: ${untilText(m.access_until, lang)}`, ""]),
    `${button}: ${link}`, kind === "login" ? "" : (reset ? t.rexpires : t.expires), "", t.sign, "", t.forgot].join("\n");
  return { subject, html, text };
}

/** Emails the member a link: a one-time "set password" link (new or reset), or a plain login link. */
export async function sendHubAccess(db: any, m: any, site: string, kind: "welcome" | "login" | "reset") {
  if (!site) return { ok: false as const, error: "SITE_URL", message: "Unknown website address for the hub link. Add SITE_URL in Supabase secrets." };
  const link = kind === "login" ? `${site}/hub/` : `${site}/hub/#/set-password?t=${await makeToken(db, m.user_id, kind === "reset" ? "reset" : "welcome")}`;
  const mail = buildHubEmail(m, link, kind);
  const sent = await deliver({ to: m.email, subject: mail.subject, html: mail.html, text: mail.text });
  if (!sent.ok) return sent;
  return { ok: true as const };
}

/** After a paid reservation with the add-on: give access and email it. Safe to call twice. */
export async function grantFromReservation(db: any, r: any, site: string, opts: { force?: boolean } = {}) {
  if (!r.addon_hub || r.status !== "paid") return { ok: false as const, error: "NO_ADDON", message: "This reservation has no paid Builder Hub add-on." };
  if (r.hub_email_sent_at && !opts.force) return { ok: true as const, already: true };
  const months = await hubMonths(db);
  const { member, isNew } = await provisionMember(db, { email: r.email, name: r.name, lang: r.lang, months, source: "checkout", reservationId: r.id, note: `Builder Hub from ${r.ref || "checkout"}` });
  const sent = await sendHubAccess(db, member, site, "welcome");
  const now = new Date().toISOString();
  const { data: cur } = await db.from("reservations").select("history").eq("id", r.id).maybeSingle();
  const hist = (cur?.history || r.history || []).concat([{ at: now, text: sent.ok ? `Builder Hub access emailed to ${r.email}${isNew ? "" : " (membership extended)"}` : `Builder Hub access created, but email failed: ${(sent as any).message}` }]);
  await db.from("reservations").update({ history: hist, ...(sent.ok ? { hub_email_sent_at: now } : {}) }).eq("id", r.id);
  return sent.ok ? { ok: true as const, member } : { ok: false as const, error: (sent as any).error, message: (sent as any).message };
}
