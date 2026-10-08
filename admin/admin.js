/* PROVIDETECH Admin — runs at /admin, works in demo mode and with Supabase */
(function () {
  "use strict";
  function hubLevel(p) { p = Number(p) || 0; var L = [[0, "Starter"], [50, "Builder"], [150, "Maker"], [300, "Pro"], [600, "Expert"], [1000, "Legend"]], k = 0; L.forEach(function (l, j) { if (p >= l[0]) k = j; }); return "Lv " + (k + 1) + " " + L[k][1]; }
  var PT = window.PT, H = PT.helpers;
  var app = document.getElementById("app");

  var S = {
    user: null, data: null, route: "overview", menu: false, busy: false,
    h: { tab: "active", q: "", sel: null, view: "members" },
    p: { batch: null, tab: "all", q: "", sel: null },
    i: { tab: "new", sel: null },
    pay: { period: "30" }
  };

  /* ------------------------------------------------------------------ icons */
  var I = {
    hub: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="m8 1.8 5.6 3.1v6.2L8 14.2l-5.6-3.1V4.9z"/><path d="M2.4 4.9 8 8l5.6-3.1M8 8v6.2"/></svg>',
    overview: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg>',
    workshops: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="11" rx="1.6"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>',
    participants: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4M11 3.2a2.4 2.4 0 0 1 0 4.6M12.4 10.2c1 .6 1.7 1.9 2.1 3.8"/></svg>',
    payments: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="3.5" width="13" height="9" rx="1.6"/><path d="M1.5 6.5h13M4 10h3"/></svg>',
    inquiries: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 3.5h12v7.5H6l-3.5 3v-3H2z"/></svg>',
    projects: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M2 6h12M6 6v8"/></svg>',
    promo: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 8.6V2.5a.5.5 0 0 1 .5-.5h6.1l5.4 5.4-6.6 6.6z"/><circle cx="5.3" cy="5.3" r="1"/></svg>',
    reports: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 13.5h12M4 11V7M8 11V4M12 11V8.5"/></svg>',
    content: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2.5" width="13" height="11" rx="1.6"/><path d="M1.5 5.5h13M4.5 8.5h4M4.5 11h7"/></svg>',
    settings: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#5A697A" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
    plus: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
    down: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10"/></svg>',
    copy: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.6"/><path d="M11 5V3.6A1.6 1.6 0 0 0 9.4 2H3.6A1.6 1.6 0 0 0 2 3.6v5.8A1.6 1.6 0 0 0 3.6 11H5"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 6h14M3 14h14"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m4 4 8 8M12 4l-8 8"/></svg>',
    refund: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 8a5 5 0 1 1 1.5 3.5M3 12V8.5h3.5"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.3"/></svg>',
    chat: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2 3.5h12v7.5H6l-3.5 3v-3H2z"/></svg>',
    cal: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="2" y="3" width="12" height="11" rx="1.6"/><path d="M2 6.5h12M8 9v3M6.5 10.5h3"/></svg>',
    seat: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.3 3 3 7-7"/></svg>'
  };

  /* ---------------------------------------------------------------- helpers */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function peso(n) { return "₱" + Math.round(Number(n) || 0).toLocaleString("en-PH"); }
  function parseYmd(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s) { return parseYmd(s).toLocaleDateString("en-PH", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); }
  function fmtLong(s) { return parseYmd(s).toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
  function fmtDT(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return d.toLocaleDateString("en-PH", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  }
  function fmtDay(d) { return d.toLocaleDateString("en-PH", { day: "numeric", month: "short" }); }
  function rel(iso) {
    var ms = Date.now() - new Date(iso).getTime(), m = Math.round(ms / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.round(h / 24); if (d === 1) return "Yesterday";
    if (d < 7) return d + " days ago";
    return fmtDay(new Date(iso));
  }
  function daysUntil(ymd) { var t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((parseYmd(ymd) - t) / 86400000); }
  function initials(n) { return String(n || "?").split(/\s+/).filter(function (w) { return /^[A-ZÀ-Ý]/.test(w); }).map(function (w) { return w[0]; }).slice(0, 2).join("") || String(n || "?").charAt(0).toUpperCase(); }
  function firstName(n) { return String(n || "").split(/\s+/)[0]; }
  function maskPhone(p) { p = String(p || ""); return p.length === 10 ? "+63 " + p.slice(0, 3) + " ••• " + p.slice(6) : p || "—"; }
  function fullPhone(p) { p = String(p || ""); return p.length === 10 ? "+63 " + p.slice(0, 3) + " " + p.slice(3, 6) + " " + p.slice(6) : p || "—"; }
  var METHOD = { gcash: "GCash", card: "Credit Card", qrph: "QR Ph (bank)", maya: "Maya", cash: "Cash", bank: "Bank transfer" };
  var RST = { pending: ["Pending", "pending"], paid: ["Paid", "ok"], refund_requested: ["Refund requested", "warn"], refunded: ["Refunded", "mute"], cancelled: ["Cancelled", "mute"] };
  var IST = { new: ["New", "solid"], contacted: ["Contacted", "pending"], proposal: ["Proposal sent", "mute"], won: ["Won", "ok"], lost: ["Lost", "mute"] };
  function pill(map, k) { var x = map[k] || [k, "mute"]; return '<span class="pill ' + x[1] + '">' + esc(x[0]) + "</span>"; }

  /* ------------------------------------------------------------- derived data */
  function D() { return S.data; }
  function setting(k) { return D().settings[k]; }
  function sess(id) { return D().sessions.filter(function (s) { return s.id === id; })[0]; }
  function isActive(r) { return !!H.ACTIVE[r.status]; }
  // Money split: the Builder Hub add-on is tracked on its own, never as workshop revenue
  function hubAmt(r) { return r.addon_hub ? (Number(r.addon_amount) || 0) : 0; }
  function wsAmt(r) { return Math.max(0, (Number(r.amount) || 0) - hubAmt(r)); }
  function resFor(sid) { return D().reservations.filter(function (r) { return r.session_id === sid; }); }
  function stats(s) {
    // paid = confirmed seats · held = unpaid but still inside the seat hold · pending = all unpaid
    var rs = resFor(s.id), o = { paid: 0, pending: 0, held: 0, refund: 0, active: 0, collected: 0, total: rs.length };
    rs.forEach(function (r) {
      if (r.status === "paid") o.paid++;
      if (r.status === "pending") { o.pending++; if (holdActive(r)) o.held++; }
      if (r.status === "refund_requested") o.refund++;
      if (r.status === "paid" || r.status === "refund_requested" || holdActive(r)) o.active++;
      if (r.status === "paid" || r.status === "refund_requested") o.collected += wsAmt(r);
    });
    o.left = Math.max(0, s.capacity - o.active);
    return o;
  }
  function sessLabel(s) { var x = s.status; if (x === "open" && stats(s).left === 0) x = "full"; if ((x === "open" || x === "full") && daysUntil(s.date) < 0) x = "done"; return x; }
  var SST = { draft: ["Draft", "mute"], open: ["Open for reservations", "ok"], full: ["Full", "warn"], done: ["Done", "mute"] };
  function upcoming() {
    return D().sessions.filter(function (s) { return daysUntil(s.date) >= 0 && s.status !== "done"; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function nextSession() { return upcoming().filter(function (s) { return s.status === "open" || s.status === "full"; })[0] || null; }
  function holdEnd(r) { return r.hold_until ? new Date(r.hold_until) : new Date(new Date(r.created_at).getTime() + (Number(setting("hold_hours")) || 1) * 3600000); }
  function holdActive(r) { return r.status === "pending" && holdEnd(r).getTime() > Date.now(); }
  function holdExpired(r) { return r.status === "pending" && !holdActive(r); }
  function refundDeadline(r) { var b = new Date(r.paid_at || r.created_at); b.setDate(b.getDate() + (Number(setting("refund_days")) || 7)); return b; }
  function paidIn(r, from, to) { if (!(r.status === "paid" || r.status === "refund_requested") || !r.paid_at) return false; var t = new Date(r.paid_at).getTime(); return t >= from && t < to; }
  function payLink(r) {
    var l = setting("payment_links") || {};
    return l[r.method] || l.all || (location.origin + "/checkout.html?batch=" + encodeURIComponent(r.session_id));
  }

  /* ------------------------------------------------------------- ui plumbing */
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, msg.length > 48 ? 6000 : 2600);
  }
  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(done || "Copied"); } catch (e) { toast("Select the text and copy it manually"); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(done || "Copied"); }, fallback);
    else fallback();
  }
  function reload(msg) {
    return PT.admin.all().then(function (d) { S.data = d; render(); if (msg) toast(msg); })
      .catch(function (e) { toast(e.message || "Couldn't load data"); });
  }
  function act(promise, msg) {
    S.busy = true;
    return promise.then(function (v) { S.busy = false; closeModal(); return reload(typeof msg === "function" ? msg(v) : msg); })
      .catch(function (e) { S.busy = false; var el = document.querySelector("dialog .form-error"); if (el) { el.textContent = e.message || "Something went wrong."; el.hidden = false; } else toast(e.message || "Something went wrong."); });
  }

  /* -------------------------------------------------------------- zoom email */
  // Never rejects: the payment update already succeeded, so email problems are reported, not thrown.
  function emailZoom(id) {
    return PT.admin.sendZoomEmail(id).then(function (res) { return { sent: true, demo: res && res.demo }; },
      function (e) { return { sent: false, code: e.code, message: e.message }; });
  }
  function emailNote(res, lead) {
    lead = lead ? lead + " · " : "";
    if (res.sent) return lead + "Zoom link emailed" + (res.demo ? " (demo)" : "");
    if (res.code === "NO_ZOOM_LINK") return lead + "Zoom link not sent: add it to the batch in Workshops";
    if (res.code === "EMAIL_NOT_CONFIGURED") return lead + "Zoom link not sent: email isn't set up yet (Settings)";
    return lead + "Zoom email failed: " + (res.message || "try again");
  }
  function zoomPending(s) {
    return D().reservations.filter(function (r) { return r.session_id === s.id && r.status === "paid" && !r.zoom_email_sent_at; });
  }
  function emailMany(list) {
    var sent = 0, last = null;
    return list.reduce(function (p, r) {
      return p.then(function () { return emailZoom(r.id).then(function (x) { if (x.sent) sent++; else last = x; }); });
    }, Promise.resolve()).then(function () { return { sent: sent, total: list.length, last: last }; });
  }

  /* -------------------------------------------------------------- modal */
  var modalSubmit = null;
  function openModal(title, body, opts) {
    opts = opts || {};
    var dlg = document.getElementById("modal");
    dlg.innerHTML = '<form class="modal-body" novalidate>' +
      '<div class="modal-head"><h2>' + esc(title) + '</h2><button type="button" class="icon-btn" data-act="modal-close" aria-label="Close">' + I.close + "</button></div>" +
      body + '<p class="form-error" role="alert" hidden></p>' +
      '<div class="modal-foot">' + (opts.extra || "") + '<button type="button" class="btn btn-g" data-act="modal-close">Cancel</button>' +
      (opts.submit ? '<button type="submit" class="btn ' + (opts.danger ? "btn-danger" : "btn-p") + '">' + esc(opts.submit) + "</button>" : "") + "</div></form>";
    modalSubmit = opts.onSubmit || null;
    dlg.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault(); if (S.busy || !modalSubmit) return;
      var err = dlg.querySelector(".form-error"); err.hidden = true;
      var fd = {}; [].forEach.call(dlg.querySelectorAll("[name]"), function (el) { fd[el.name] = el.type === "checkbox" ? el.checked : el.value; });
      try { modalSubmit(fd); } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    var f = dlg.querySelector("input:not([type=hidden]),select,textarea"); if (f) f.focus();
  }
  function closeModal() { var dlg = document.getElementById("modal"); if (dlg && dlg.open) dlg.close(); modalSubmit = null; }
  function field(label, html, hint) { return '<div class="field">' + label + html + (hint ? "<small>" + esc(hint) + "</small>" : "") + "</div>"; }
  function lbl(id, t) { return '<label for="' + id + '">' + esc(t) + "</label>"; }
  function opt(v, t, cur) { return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + esc(t) + "</option>"; }

  /* -------------------------------------------------------------- login */
  function renderLogin(err) {
    var demo = PT.mode === "demo";
    app.innerHTML = '<main class="login"><form class="login-card" id="loginForm" novalidate>' +
      '<div class="login-brand"><img src="/assets/logo-mark.png" alt=""><img src="/assets/logo-word.png" alt="PROVIDETECH AI Assistance"></div>' +
      '<div><h1 style="font-size:24px;font-weight:700">Admin sign in</h1><p class="muted" style="margin:4px 0 0">Manage workshops, participants, payments and inquiries.</p></div>' +
      (demo ? '<div class="demo-hint"><b>Demo mode.</b> Data is sample data saved in this browser. Sign in with <code>admin@providetech.demo</code> and password <code>demo1234</code>.</div>' : "") +
      field(lbl("lemail", "Email"), '<input class="input" id="lemail" name="email" type="email" autocomplete="username" required' + (demo ? ' value="admin@providetech.demo"' : "") + ">") +
      field(lbl("lpass", "Password"), '<input class="input" id="lpass" name="password" type="password" autocomplete="current-password" required>') +
      '<p class="form-error" role="alert"' + (err ? "" : " hidden") + ">" + esc(err || "") + "</p>" +
      '<button class="btn btn-p" type="submit" style="width:100%;min-height:46px">Sign in</button>' +
      '<a href="/" class="muted" style="font-size:13px;text-align:center">← Back to website</a></form></main>';
    var f = document.getElementById("loginForm");
    (demo ? f.lpass : f.lemail).focus();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Signing in…";
      PT.auth.signIn(f.email.value, f.password.value).then(function (u) { S.user = u; return reload(); })
        .catch(function (ex) { renderLogin(ex.message); });
    });
  }

  /* -------------------------------------------------------------- shell */
  var ROUTES = ["overview", "workshops", "participants", "payments", "inquiries", "hub", "settings"];
  function navLink(key, label, badge) {
    var on = S.route === key;
    return '<a class="nav-link' + (on ? " on" : "") + '" href="#/' + key + '"' + (on ? ' aria-current="page"' : "") + ">" + I[key] + esc(label) + (badge || "") + "</a>";
  }
  function soon(icon, label) { return '<span class="nav-link soon" aria-disabled="true">' + I[icon] + esc(label) + '<span class="count">Soon</span></span>'; }
  function shell(content) {
    var openB = upcoming().filter(function (s) { return s.status === "open"; }).length;
    var newQ = D().inquiries.filter(function (q) { return q.status === "new"; }).length;
    var demo = PT.mode === "demo";
    return '<div class="shell' + (S.menu ? " menu-open" : "") + '">' +
      '<header class="topbar"><a class="brand" href="#/overview"><img src="/assets/logo-mark.png" alt=""><img src="/assets/logo-word.png" alt="PROVIDETECH Admin"></a>' +
      '<button class="icon-btn" data-act="menu" aria-label="Open menu" aria-expanded="' + S.menu + '">' + I.menu + "</button></header>" +
      (S.menu ? '<div class="scrim" data-act="menu-close"></div>' : "") +
      '<aside class="side" aria-label="Admin navigation">' +
      '<a class="side-brand" href="#/overview"><img src="/assets/logo-mark.png" alt=""><img src="/assets/logo-word.png" alt="PROVIDETECH Admin"></a>' +
      '<nav style="display:grid;gap:18px">' +
      '<div class="nav-group"><span class="mono-label">Operations</span>' +
      navLink("overview", "Overview") +
      navLink("workshops", "Workshops", openB ? '<span class="count soft">' + openB + " open</span>" : "") +
      navLink("participants", "Participants") +
      navLink("payments", "Payments") +
      navLink("inquiries", "Inquiries", newQ ? '<span class="count hot">' + newQ + " new</span>" : "") +
      navLink("hub", "Builder Hub", activeMembers().length ? '<span class="count soft">' + activeMembers().length + "</span>" : "") +
      "</div>" +
      '<div class="nav-group"><span class="mono-label">Business</span>' +
      soon("projects", "Client Projects") + soon("promo", "Promo Codes") + soon("reports", "Reports") + soon("content", "Website Content") +
      "</div></nav>" +
      '<div class="side-foot">' + navLink("settings", "Settings") +
      '<div class="mode-chip">' + (demo ? "<b>Demo mode</b> · sample data in this browser" : "<b>Live</b> · connected to your database") + "</div>" +
      '<div class="me"><span class="av">' + esc(initials(S.user.name || S.user.email)) + '</span><span style="min-width:0"><b>' + esc(S.user.name || S.user.email) + "</b><span>Admin</span></span>" +
      '<button class="btn btn-g btn-sm" data-act="signout">Sign out</button></div>' +
      '<a href="/" class="muted" style="font-size:12.5px;padding:0 10px">← View website</a></div></aside>' +
      '<main class="main" id="main">' + content + "</main></div>" +
      '<dialog class="modal" id="modal" aria-label="Dialog"></dialog>';
  }

  /* -------------------------------------------------------------- overview */
  function viewOverview() {
    var d = D(), now = Date.now(), day = 86400000;
    var last30 = 0, prev30 = 0, hub30 = 0, hubN30 = 0, seats30 = 0, methods = { gcash: 0, card: 0, qrph: 0, other: 0 }, payCount = 0;
    d.reservations.forEach(function (r) {
      if (paidIn(r, now - 30 * day, now + day)) { last30 += wsAmt(r); if (hubAmt(r)) { hub30 += hubAmt(r); hubN30++; } payCount++; methods[methods.hasOwnProperty(r.method) ? r.method : "other"]++; }
      if (paidIn(r, now - 60 * day, now - 30 * day)) prev30 += wsAmt(r);
      if (new Date(r.created_at).getTime() > now - 30 * day && r.status !== "cancelled") seats30++;
    });
    var change = prev30 ? Math.round((last30 - prev30) / prev30 * 100) : null;
    var nx = nextSession(), ns = nx ? stats(nx) : null;
    var openQ = d.inquiries.filter(function (q) { return q.status === "new" || q.status === "contacted" || q.status === "proposal"; });
    var newQ = d.inquiries.filter(function (q) { return q.status === "new"; });

    var kpis = '<section class="kpis" aria-label="Key numbers">' +
      '<div class="card kpi"><span class="label">Workshop revenue · last 30 days</span><span class="value">' + peso(last30) + "</span>" +
      '<span class="sub">' + (change === null ? "No sales in the previous 30 days" : '<span class="' + (change >= 0 ? "up" : "down") + '">' + (change >= 0 ? "▲ " : "▼ ") + Math.abs(change) + "%</span> vs previous 30 days") + "</span>" +
      '<span class="sub">Builder Hub, tracked separately: <a href="#/hub">' + peso(hub30) + " · " + hubN30 + (hubN30 === 1 ? " member" : " members") + "</a></span></div>" +
      '<div class="card kpi"><span class="label">Seats reserved · last 30 days</span><span class="value">' + seats30 + '</span><span class="sub">Across all batches</span></div>' +
      (nx ? '<div class="card kpi"><span class="label">Seats left · ' + esc(nx.code) + '</span><span class="value">' + ns.left + " <small>of " + nx.capacity + "</small></span>" +
        '<span class="sub ' + (ns.left / nx.capacity <= .25 ? "warnTxt" : "") + '">' + (ns.left === 0 ? "Full" : ns.left / nx.capacity <= .25 ? "Almost full" : "Open") + " · " + (daysUntil(nx.date) === 0 ? "today" : daysUntil(nx.date) + " days to go") + "</span></div>"
        : '<div class="card kpi"><span class="label">Next workshop</span><span class="value">—</span><span class="sub"><a href="#/workshops">Open a batch</a> to start taking reservations</span></div>') +
      '<div class="card kpi"><span class="label">Open inquiries</span><span class="value">' + openQ.length + '</span><span class="sub blueTxt">' + (newQ.length ? newQ.length + " new, not yet contacted" : "All contacted") + "</span></div></section>";

    // next workshop
    var next = '<section class="card grow3" aria-label="Next workshop">';
    if (nx) {
      var pct = function (n) { return (n / nx.capacity * 100).toFixed(1) + "%"; };
      next += '<div class="batch-top"><div><span class="mono-label" style="color:var(--blue-ink)">Next workshop · ' + esc(nx.code) + '</span><h2 style="font-size:21px;margin-top:6px">' + esc(nx.title) + '</h2><p class="muted" style="margin:4px 0 0;color:var(--ink-2)">' +
        esc(fmtLong(nx.date)) + (nx.time_label ? " · " + esc(nx.time_label) : "") + " · " + (nx.venue ? esc(nx.venue) : '<span class="warnTxt">No venue yet</span>') + "</p></div>" + pill(SST, sessLabel(nx)) + "</div>" +
        '<div style="display:grid;gap:8px;margin:18px 0"><div class="batch-stats"><span><b class="num">' + (ns.paid + ns.refund) + " of " + nx.capacity + '</b> seats paid</span><span class="muted num">' + ns.pending + " waiting for payment · " + ns.refund + " refund requests</span></div>" +
        '<div class="seatbar" aria-hidden="true"><span style="width:' + pct(ns.paid) + ';background:var(--blue)"></span><span style="width:' + pct(ns.held) + ';background:var(--blue-300)"></span><span style="width:' + pct(ns.refund) + ';background:var(--warn-bar)"></span></div>' +
        '<div class="legend"><span><i style="background:var(--blue)"></i>Paid</span><span><i style="background:var(--blue-300)"></i>Held while paying</span><span><i style="background:var(--warn-bar)"></i>Refund requested</span><span><i style="background:var(--mute-bg);border:1px solid var(--rule)"></i>Available</span></div></div>' +
        '<div class="batch-actions"><a class="btn btn-p" href="#/participants" data-act="go-batch" data-id="' + esc(nx.id) + '">View participants →</a>' +
        '<button class="btn btn-g" data-act="copy-link" data-id="' + esc(nx.id) + '">' + I.copy + "Copy reservation link</button>" +
        '<button class="btn btn-g" data-act="edit-batch" data-id="' + esc(nx.id) + '">Edit batch</button></div>';
    } else {
      next += '<h2 style="font-size:17px">No upcoming workshop</h2><p class="muted">Create a batch and set it to “Open” so people can reserve seats on the checkout page.</p><div class="batch-actions" style="margin-top:14px"><button class="btn btn-p" data-act="new-batch">' + I.plus + "New batch</button></div>";
    }
    next += "</section>";

    // needs attention
    var att = [];
    var refunds = d.reservations.filter(function (r) { return r.status === "refund_requested"; });
    if (refunds.length) {
      var soonest = refunds.map(refundDeadline).sort(function (a, b) { return a - b; })[0];
      var dl = Math.ceil((soonest - now) / day);
      att.push(['<span class="badge-ic" style="background:var(--warn-bg);color:var(--warn)">' + I.refund + "</span>", refunds.length + (refunds.length === 1 ? " refund request" : " refund requests"),
        "Within the " + (setting("refund_days") || 7) + "-day guarantee · " + (dl <= 0 ? "one window ends today" : "next window ends in " + dl + (dl === 1 ? " day" : " days")), "go-tab", "refund_requested", "Review"]);
    }
    var expired = d.reservations.filter(holdExpired), pend = d.reservations.filter(function (r) { return r.status === "pending"; });
    if (pend.length) att.push(['<span class="badge-ic" style="background:var(--blue-50);color:var(--blue-ink)">' + I.clock + "</span>", pend.length + (pend.length === 1 ? " payment pending" : " payments pending"),
      expired.length ? expired.length + " past the seat hold (their seats were released)" : "Waiting for GCash, credit card or QR Ph payment", "go-tab", "pending", "Remind"]);
    var oldNew = newQ.filter(function (q) { return now - new Date(q.created_at).getTime() > day; });
    if (newQ.length) att.push(['<span class="badge-ic" style="background:var(--blue-50);color:var(--blue-ink)">' + I.chat + "</span>", newQ.length + (newQ.length === 1 ? " new inquiry" : " new inquiries"),
      oldNew.length ? oldNew.length + " waiting more than 24 hours" : "Not contacted yet", "go", "inquiries", "Open"]);
    upcoming().forEach(function (s) {
      if (!s.venue) att.push(['<span class="badge-ic" style="background:var(--bg);color:var(--ink-2)">' + I.cal + "</span>", s.code + " has no venue yet", fmtDate(s.date) + " · " + (s.status === "draft" ? "still a draft" : "open for reservations"), "edit-batch", s.id, "Set"]);
      if (!s.zoom_link && s.status !== "draft") att.push(['<span class="badge-ic" style="background:var(--warn-bg);color:var(--warn)">' + I.cal + "</span>", s.code + " has no Zoom link yet", "Paid participants get it by email once you add it", "edit-batch", s.id, "Add"]);
      else if (s.zoom_link && zoomPending(s).length) { var zp = zoomPending(s).length; att.push(['<span class="badge-ic" style="background:var(--warn-bg);color:var(--warn)">' + I.cal + "</span>", zp + (zp === 1 ? " paid participant hasn't" : " paid participants haven't") + " got the Zoom link", s.code + " · open the batch to send it", "edit-batch", s.id, "Send"]); }
    });
    var attention = '<section class="card grow2" aria-label="Needs attention"><div class="card-head"><h2>Needs attention</h2></div>' +
      (att.length ? att.map(function (a) {
        return '<div class="list-row">' + a[0] + '<span class="grow"><b>' + esc(a[1]) + "</b><span>" + esc(a[2]) + '</span></span><button class="btn btn-g btn-sm" data-act="' + a[3] + '" data-id="' + esc(a[4]) + '">' + esc(a[5]) + "</button></div>";
      }).join("") : '<div class="all-clear">' + I.check + "All caught up</div>") + "</section>";

    // weekly revenue chart (Monday-start weeks)
    var start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    var weeks = [];
    for (var w = 7; w >= 0; w--) {
      var a = new Date(start.getTime()); a.setDate(a.getDate() - w * 7);
      var b = new Date(a.getTime()); b.setDate(b.getDate() + 7);
      var sum = 0; d.reservations.forEach(function (r) { if (paidIn(r, a.getTime(), b.getTime())) sum += wsAmt(r); });
      weeks.push({ from: a, sum: sum });
    }
    var max = Math.max.apply(null, weeks.map(function (x) { return x.sum; })) || 1;
    var chart = '<section class="card grow3" aria-label="Weekly revenue"><div class="card-head"><h2>Workshop revenue by week</h2><span class="muted" style="font-size:12.5px">Last 8 weeks · paid seats</span></div>' +
      '<div class="bars" role="img" aria-label="Revenue per week for the last 8 weeks: ' + weeks.map(function (x) { return fmtDay(x.from) + " " + peso(x.sum); }).join(", ") + '">' +
      weeks.map(function (x, k) {
        var h = Math.max(1, Math.round(x.sum / max * 100));
        var label = (k === 7 || x.sum === max) && x.sum ? '<em style="bottom:calc(' + h + '% + 6px)">' + peso(x.sum) + "</em>" : "";
        return '<div class="bar' + (k === 7 ? " now" : k >= 4 ? " recent" : "") + '">' + label + '<span style="height:' + h + '%"></span></div>';
      }).join("") + "</div>" +
      '<div class="bar-labels num">' + weeks.map(function (x, k) { return "<span" + (k === 7 ? ' style="color:var(--ink);font-weight:600"' : "") + ">" + (k === 7 ? "This week" : fmtDay(x.from)) + "</span>"; }).join("") + "</div>" +
      '<div class="legend" style="margin-top:14px"><span><i style="background:var(--blue-200)"></i>Last 30 days · ' + peso(last30) + '</span><span><i style="background:var(--blue-50);border:1px solid #D6EEFF"></i>Previous 30 days · ' + peso(prev30) + "</span></div></section>";

    // payment methods
    var mrow = function (k, label, color) {
      var n = methods[k], p = payCount ? Math.round(n / payCount * 100) : 0;
      return '<div class="list-row"><i style="width:10px;height:10px;border-radius:3px;background:' + color + ';display:inline-block"></i><span style="flex:1">' + label + '</span><span class="muted num">' + n + '</span><b class="num" style="width:48px;text-align:right">' + p + "%</b></div>";
    };
    var refundedAmt = d.reservations.filter(function (r) { return r.status === "refunded" && new Date(r.created_at).getTime() > now - 60 * day; }).reduce(function (s, r) { return s + r.amount; }, 0);
    var pm = '<section class="card grow2" aria-label="Payment methods"><div class="card-head"><h2>How people pay</h2><span class="muted" style="font-size:12.5px">' + payCount + " payments · 30 days</span></div>" +
      (payCount ? '<div class="seatbar" style="height:12px;gap:2px;margin-bottom:6px" aria-hidden="true"><span style="width:' + (methods.gcash / payCount * 100) + '%;background:var(--blue)"></span><span style="width:' + (methods.card / payCount * 100) + '%;background:var(--ink)"></span><span style="width:' + (methods.qrph / payCount * 100) + '%;background:var(--blue-300)"></span><span style="width:' + (methods.other / payCount * 100) + '%;background:var(--ink-4)"></span></div>' : "") +
      mrow("gcash", "GCash", "var(--blue)") + mrow("card", "Credit Card", "var(--ink)") + mrow("qrph", "QR Ph (bank)", "var(--blue-300)") + (methods.other ? mrow("other", "Other", "var(--ink-4)") : "") +
      (refundedAmt ? '<p class="muted" style="margin:10px 0 0;font-size:12.5px">Refunded recently: <b style="color:var(--ink)" class="num">' + peso(refundedAmt) + "</b></p>" : "") + "</section>";

    // recent reservations
    var recent = d.reservations.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, 6);
    var rr = '<section class="card grow3" aria-label="Recent reservations"><div class="card-head"><h2>Recent reservations</h2><a href="#/participants" style="font-size:13px;font-weight:600">See all →</a></div>' +
      (recent.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Participant</th><th>Batch</th><th>Method</th><th>Status</th><th style="text-align:right">When</th></tr></thead><tbody>' +
        recent.map(function (r) {
          var s = sess(r.session_id);
          return '<tr class="click" data-act="open-res" data-id="' + esc(r.id) + '"><td><span class="who"><span class="av">' + esc(initials(r.name)) + "</span><b>" + esc(r.name) + "</b></span></td><td>" + esc(s ? s.code : "—") + "</td><td>" + esc(METHOD[r.method] || r.method) + "</td><td>" + pill(RST, r.status) + '</td><td style="text-align:right" class="muted">' + esc(rel(r.created_at)) + "</td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="empty">No reservations yet. Share your reservation link to get the first one.</div>') + "</section>";

    var recentQ = d.inquiries.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, 4);
    var rq = '<section class="card grow2" aria-label="Recent inquiries"><div class="card-head"><h2>Recent inquiries</h2><a href="#/inquiries" style="font-size:13px;font-weight:600">See all →</a></div>' +
      (recentQ.length ? recentQ.map(function (q) {
        return '<button class="inq" data-act="open-inq" data-id="' + esc(q.id) + '"><span class="inq-top"><b>' + esc(q.business || q.name) + "</b>" + pill(IST, q.status) + '</span><span class="need">' + esc(q.need || "General inquiry") + '</span><span class="meta">' + esc(q.source) + " · " + esc(rel(q.created_at)) + "</span></button>";
      }).join("") : '<div class="empty">No inquiries yet.</div>') + "</section>";

    var hour = new Date().getHours();
    var greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return '<header class="page-head"><div><h1>' + greet + ", " + esc(firstName(S.user.name || "")) + '</h1><p>' + esc(new Date().toLocaleDateString("en-PH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })) + "</p></div>" +
      '<div class="head-actions"><button class="btn btn-p" data-act="new-batch">' + I.plus + "New batch</button></div></header>" +
      kpis + '<div class="row">' + next + attention + '</div><div class="row">' + chart + pm + '</div><div class="row">' + rr + rq + "</div>";
  }

  /* -------------------------------------------------------------- workshops */
  function batchCard(s) {
    var st = stats(s), lab = sessLabel(s);
    var pct = function (n) { return (n / s.capacity * 100).toFixed(1) + "%"; };
    return '<article class="card batch"><div class="batch-top"><div><span class="mono-label">' + esc(s.code) + "</span><h3>" + esc(s.title) + "</h3></div>" + pill(SST, lab) + "</div>" +
      '<div class="meta">' + esc(fmtLong(s.date)) + (s.time_label ? "<br>" + esc(s.time_label) : "") + "<br>" + (s.venue ? esc(s.venue) : '<span class="warnTxt">No venue yet</span>') +
      (s.zoom_link ? "<br>Zoom link added" : daysUntil(s.date) >= 0 && s.status !== "done" ? '<br><span class="warnTxt">No Zoom link yet</span>' : "") + "</div>" +
      '<div style="display:grid;gap:8px"><div class="batch-stats"><span><b class="num">' + (st.paid + st.refund) + " of " + s.capacity + '</b> paid</span><span class="muted num">' + peso(s.price) + " per seat</span></div>" +
      '<div class="seatbar" aria-hidden="true"><span style="width:' + pct(st.paid) + ';background:var(--blue)"></span><span style="width:' + pct(st.held) + ';background:var(--blue-300)"></span><span style="width:' + pct(st.refund) + ';background:var(--warn-bar)"></span></div>' +
      '<div class="batch-stats"><span class="muted num">' + st.pending + " waiting for payment · " + st.refund + " refunds</span><b class=\"num\">" + peso(st.collected) + "</b></div></div>" +
      '<div class="batch-actions"><a class="btn btn-g btn-sm" href="#/participants" data-act="go-batch" data-id="' + esc(s.id) + '">Participants</a>' +
      '<button class="btn btn-g btn-sm" data-act="edit-batch" data-id="' + esc(s.id) + '">Edit</button>' +
      (s.status === "open" ? '<button class="btn btn-g btn-sm" data-act="copy-link" data-id="' + esc(s.id) + '">' + I.copy + "Reservation link</button>" : "") + "</div></article>";
  }
  function viewWorkshops() {
    var up = upcoming(), past = D().sessions.filter(function (s) { return up.indexOf(s) < 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return '<header class="page-head"><div><h1>Workshops</h1><p>Create batches, open them for reservations, and track seats.</p></div>' +
      '<div class="head-actions"><button class="btn btn-p" data-act="new-batch">' + I.plus + "New batch</button></div></header>" +
      '<h2 class="mono-label section-label">Upcoming &amp; drafts</h2>' +
      (up.length ? '<div class="batches">' + up.map(batchCard).join("") + "</div>" : '<div class="card empty">No upcoming batches. Click “New batch” to schedule one.</div>') +
      (past.length ? '<h2 class="mono-label section-label">Past</h2><div class="batches">' + past.map(batchCard).join("") + "</div>" : "");
  }
  function batchForm(s) {
    var isNew = !s;
    if (isNew) {
      var nums = D().sessions.map(function (x) { var m = /(\d+)\s*$/.exec(x.code || ""); return m ? +m[1] : 0; });
      var n = (Math.max.apply(null, nums.concat([0])) + 1);
      var dt = new Date(); dt.setDate(dt.getDate() + 30);
      s = { code: "Batch " + (n < 10 ? "0" : "") + n, title: "AI Business Systems Workshop", date: dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"),
        time_label: "9:00 AM – 5:00 PM", venue: "", capacity: 30, price: 999, status: "draft" };
    }
    var taken = s.id ? stats(s).active : 0;
    var pendingZ = s.id ? zoomPending(s) : [];
    openModal(isNew ? "New batch" : "Edit " + s.code,
      '<div class="form-grid">' +
      field(lbl("bcode", "Batch name"), '<input class="input" id="bcode" name="code" required value="' + esc(s.code) + '">') +
      field(lbl("bstatus", "Status"), '<select class="input" id="bstatus" name="status">' + opt("draft", "Draft (hidden)", s.status) + opt("open", "Open for reservations", s.status) + opt("full", "Full (stop reservations)", s.status) + opt("done", "Done", s.status) + "</select>") +
      '<div class="span2">' + field(lbl("btitle", "Workshop title"), '<input class="input" id="btitle" name="title" required value="' + esc(s.title) + '">') + "</div>" +
      field(lbl("bdate", "Date"), '<input class="input" id="bdate" name="date" type="date" required value="' + esc(s.date) + '">') +
      field(lbl("btime", "Time"), '<input class="input" id="btime" name="time_label" placeholder="9:00 AM – 5:00 PM" value="' + esc(s.time_label) + '">') +
      '<div class="span2">' + field(lbl("bvenue", "Venue or meeting link"), '<input class="input" id="bvenue" name="venue" placeholder="e.g. Online via Zoom, or the venue address" value="' + esc(s.venue) + '">', "Shown on the checkout page.") + "</div>" +
      '<div class="span2">' + field(lbl("bzoom", "Zoom link"), '<input class="input" id="bzoom" name="zoom_link" type="url" inputmode="url" placeholder="https://us06web.zoom.us/j/…" value="' + esc(s.zoom_link || "") + '">', "Emailed automatically to each participant once they're marked as paid. Never shown on the website.") + "</div>" +
      '<div class="span2">' + field(lbl("bznotes", "Zoom details (optional)"), '<textarea class="input" id="bznotes" name="zoom_notes" rows="2" placeholder="Meeting ID: 123 456 7890 · Passcode: 123456">' + esc(s.zoom_notes || "") + "</textarea>", "Added to the email under the date.") + "</div>" +
      (pendingZ.length ? '<label class="span2" style="display:flex;gap:10px;align-items:flex-start;font-size:13.5px"><input type="checkbox" name="send_now" checked style="margin-top:3px;accent-color:var(--blue)"><span>Email the Zoom link now to the <b>' + pendingZ.length + "</b> paid " + (pendingZ.length === 1 ? "participant who hasn't" : "participants who haven't") + " received it</span></label>" : "") +
      field(lbl("bcap", "Seats"), '<input class="input" id="bcap" name="capacity" type="number" min="' + Math.max(1, taken) + '" required value="' + esc(s.capacity) + '">', taken ? taken + " already reserved" : "") +
      field(lbl("bprice", "Price per seat (₱)"), '<input class="input" id="bprice" name="price" type="number" min="0" step="1" required value="' + esc(s.price) + '">') +
      "</div>",
      { submit: isNew ? "Create batch" : "Save changes", onSubmit: function (f) {
        if (!f.code.trim()) throw new Error("Give the batch a name.");
        if (!f.date) throw new Error("Pick a date.");
        if ((parseInt(f.capacity, 10) || 0) < Math.max(1, taken)) throw new Error("Seats can't be lower than the " + taken + " already reserved.");
        if (f.status === "open" && daysUntil(f.date) < 0) throw new Error("A batch in the past can't be open for reservations.");
        f.zoom_link = String(f.zoom_link || "").trim();
        if (f.zoom_link && !/^https:\/\/\S+$/.test(f.zoom_link)) throw new Error("The Zoom link should start with https:// (copy it from Zoom → Meetings → Copy invitation link).");
        var lead = isNew ? "Batch created" : "Batch saved";
        var sendNow = f.send_now && f.zoom_link && pendingZ.length;
        f.id = s.id;
        act(PT.admin.saveSession(f).then(function () {
          if (!sendNow) return null;
          toast("Saved. Sending the Zoom link to " + pendingZ.length + "…");
          return emailMany(pendingZ);
        }), function (m) {
          if (!m) return lead;
          if (m.sent === m.total) return lead + " · Zoom link emailed to " + m.sent;
          return emailNote(m.last, lead + " · " + m.sent + " of " + m.total + " emailed");
        });
      } });
  }

  /* -------------------------------------------------------------- participants */
  var PTABS = [["all", "All"], ["paid", "Paid"], ["pending", "Pending"], ["refund_requested", "Refund requests"], ["closed", "Refunded or cancelled"]];
  function pMatch(r, tab) { return tab === "all" ? true : tab === "closed" ? (r.status === "refunded" || r.status === "cancelled") : r.status === tab; }
  function pRows() {
    var q = S.p.q.trim().toLowerCase();
    return resFor(S.p.batch).filter(function (r) {
      if (!pMatch(r, S.p.tab)) return false;
      if (q && (r.name + " " + r.email + " " + r.phone + " " + r.ref).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  }
  function viewParticipants() {
    var sessions = D().sessions.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (!sessions.length) return '<header class="page-head"><div><h1>Participants</h1></div></header><div class="card empty">Create a workshop batch first. Participants appear here when people reserve seats.</div>';
    if (!S.p.batch || !sess(S.p.batch)) S.p.batch = (nextSession() || sessions[0]).id;
    var s = sess(S.p.batch), st = stats(s), all = resFor(s.id), rows = pRows();
    if (!S.p.sel || !rows.some(function (r) { return r.id === S.p.sel; })) S.p.sel = rows.length ? rows[0].id : null;
    var sel = all.filter(function (r) { return r.id === S.p.sel; })[0];
    var pct = function (n) { return (n / s.capacity * 100).toFixed(1) + "%"; };

    var head = '<header class="page-head"><div><h1>Participants</h1><p>' + esc(s.title) + " · " + esc(fmtLong(s.date)) + "</p></div>" +
      '<div class="head-actions"><label for="pbatch" class="muted" style="font-weight:500">Batch</label><select class="input" id="pbatch" data-model="p.batch" style="width:auto">' +
      sessions.map(function (x) { return opt(x.id, x.code + " · " + fmtDay(parseYmd(x.date)) + (x.status === "draft" ? " (draft)" : sessLabel(x) === "done" ? " (done)" : ""), S.p.batch); }).join("") + "</select>" +
      '<button class="btn btn-g" data-act="export">' + I.down + "Export CSV</button>" +
      '<button class="btn btn-p" data-act="add-res">' + I.plus + "Add participant</button></div></header>";

    var summary = '<section class="card" aria-label="Batch summary" style="display:flex;flex-wrap:wrap;align-items:center;gap:18px 36px;padding:18px 22px">' +
      '<div style="display:grid;gap:8px;flex:1 1 260px;min-width:0"><div class="batch-stats"><span><b class="num">' + (st.paid + st.refund) + " of " + s.capacity + "</b> seats paid</span>" + (st.left ? '<span class="' + (st.left / s.capacity <= .25 ? "warnTxt" : "muted") + '">' + st.left + " left</span>" : '<span class="warnTxt">Full</span>') + "</div>" +
      '<div class="seatbar" style="height:8px" aria-hidden="true"><span style="width:' + pct(st.paid) + ';background:var(--blue)"></span><span style="width:' + pct(st.held) + ';background:var(--blue-300)"></span><span style="width:' + pct(st.refund) + ';background:var(--warn-bar)"></span></div></div>' +
      [["Paid", st.paid], ["Waiting for payment", st.pending], ["Refund requests", st.refund], ["Collected", peso(st.collected)]].map(function (x) {
        return '<div style="display:flex;flex-direction:column"><span class="muted" style="font-size:12.5px">' + x[0] + '</span><b class="num" style="font-family:var(--display);font-size:22px;letter-spacing:-.02em">' + x[1] + "</b></div>";
      }).join("") + "</section>";

    var tabs = '<div class="tabs" role="group" aria-label="Filter by payment status">' + PTABS.map(function (t) {
      var c = all.filter(function (r) { return pMatch(r, t[0]); }).length;
      return '<button type="button" class="tab" data-act="ptab" data-id="' + t[0] + '" aria-pressed="' + (S.p.tab === t[0]) + '">' + esc(t[1]) + '<span class="c num">' + c + "</span></button>";
    }).join("") + "</div>";

    var list = '<section class="card list" aria-label="Participant list" style="padding:16px 18px 12px"><div class="toolbar">' + tabs +
      '<div class="search">' + I.search + '<label for="psearch" class="sr-only">Search by name, email, phone or reference</label><input id="psearch" type="search" placeholder="Search name, email, phone" data-model="p.q" value="' + esc(S.p.q) + '"></div></div>' +
      (rows.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Participant</th><th>Payment</th><th>Status</th><th>Reserved</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr class="click' + (r.id === S.p.sel ? " sel" : "") + '" data-act="psel" data-id="' + esc(r.id) + '" aria-selected="' + (r.id === S.p.sel) + '">' +
            '<td><span class="who"><span class="av">' + esc(initials(r.name)) + "</span><span><b>" + esc(r.name) + "</b><small>" + esc(r.email) + "</small></span></span></td>" +
            '<td>' + esc(METHOD[r.method] || r.method) + "</td><td>" + pill(RST, r.status) + (holdExpired(r) ? ' <span class="pill err">Hold expired</span>' : "") + "</td>" +
            '<td class="muted">' + esc(fmtDay(new Date(r.created_at))) + "</td></tr>";
        }).join("") + "</tbody></table></div>"
        : '<div class="empty">' + (S.p.q ? "No participants match “" + esc(S.p.q) + "”. Try a name, email or phone number." : all.length ? "No one in this group." : "No reservations for this batch yet.") + "</div>") +
      '<div class="tfoot"><span>Showing ' + rows.length + " of " + all.length + "</span><span>" + esc(s.code) + "</span></div></section>";

    return head + summary + '<div class="split">' + list + detailRes(sel) + "</div>";
  }
  function detailRes(r) {
    if (!r) return '<aside class="card detail" aria-label="Participant details"><div class="empty">Select a participant to see their details.</div></aside>';
    var s = sess(r.session_id), st = RST[r.status] || [r.status, "mute"];
    var hist = (r.history || []).slice().reverse();
    var actions = "";
    if (r.status === "pending") actions = '<button class="btn btn-p" data-act="mark-paid" data-id="' + esc(r.id) + '">Mark as paid</button><button class="btn btn-g" data-act="msg-reminder" data-id="' + esc(r.id) + '">Send payment reminder</button><button class="btn btn-danger" data-act="cancel-res" data-id="' + esc(r.id) + '">Cancel reservation</button>';
    if (r.status === "paid") actions = (r.addon_hub && !r.hub_email_sent_at ? '<button class="btn btn-p" data-act="hub-grant" data-id="' + esc(r.id) + '">Send Builder Hub access</button>' : "") + '<button class="btn ' + (r.addon_hub && !r.hub_email_sent_at ? "btn-g" : "btn-p") + '" data-act="send-zoom" data-id="' + esc(r.id) + '">' + (r.zoom_email_sent_at ? "Resend Zoom link" : "Email Zoom link") + '</button><button class="btn btn-g" data-act="msg-details" data-id="' + esc(r.id) + '">Copy workshop details</button><button class="btn btn-g" data-act="move-res" data-id="' + esc(r.id) + '">Move to another batch</button><button class="btn btn-g" data-act="req-refund" data-id="' + esc(r.id) + '">Record refund request</button>';
    if (r.status === "refund_requested") actions = '<button class="btn btn-p" data-act="approve-refund" data-id="' + esc(r.id) + '">Approve refund · ' + peso(r.amount) + '</button><button class="btn btn-g" data-act="move-res" data-id="' + esc(r.id) + '">Offer a seat in another batch</button><button class="btn btn-g" data-act="decline-refund" data-id="' + esc(r.id) + '">Decline refund</button>';
    if (r.status === "refunded" || r.status === "cancelled") actions = '<button class="btn btn-g" data-act="restore-res" data-id="' + esc(r.id) + '">Restore as pending</button>';
    return '<aside class="card detail" aria-label="Participant details">' +
      '<div class="detail-head"><span class="av">' + esc(initials(r.name)) + '</span><span style="display:grid;gap:4px;min-width:0"><b>' + esc(r.name) + "</b>" + '<span class="pill ' + st[1] + '" style="justify-self:start">' + esc(st[0]) + "</span></span></div>" +
      '<dl class="facts"><dt>Email</dt><dd><a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a></dd>" +
      "<dt>Mobile</dt><dd>" + esc(fullPhone(r.phone)) + "</dd>" +
      "<dt>Batch</dt><dd>" + esc(s ? s.code + " · " + fmtDay(parseYmd(s.date)) : "—") + "</dd>" +
      "<dt>Payment</dt><dd>" + esc(METHOD[r.method] || r.method) + " · " + peso(r.amount) + "</dd>" +
      (r.addon_hub ? "<dt>Add-on</dt><dd>Builder Hub · " + peso(r.addon_amount) + (r.status === "paid" ? (r.hub_email_sent_at ? " · access emailed" : ' · <span class="warnTxt">access not sent yet</span>') : "") + "</dd>" : "") +
      '<dt>Reference</dt><dd style="font-family:var(--mono);font-size:12.5px">' + esc(r.ref || (r.status === "pending" ? "Awaiting payment" : "—")) + "</dd>" +
      "<dt>Source</dt><dd>" + esc(r.source) + "</dd>" +
      (r.status === "paid" ? "<dt>Zoom link</dt><dd>" + (r.zoom_email_sent_at ? "Emailed " + esc(fmtDT(r.zoom_email_sent_at)) : s && !s.zoom_link ? '<span class="warnTxt">Batch has no Zoom link yet</span>' : '<span class="warnTxt">Not sent yet</span>') + "</dd>" : "") + "</dl>" +
      (r.status === "refund_requested" ? '<div class="callout warn">Reason: “' + esc(r.refund_reason || "No reason given") + "”. Guarantee window ends " + esc(fmtDay(refundDeadline(r))) + ".</div>" : "") +
      (holdExpired(r) ? '<div class="callout warn">Unpaid, and the seat hold ended ' + esc(fmtDT(holdEnd(r).toISOString())) + ". The seat is free for others again. They can still finish paying by reserving again with the same email and mobile number, or you can cancel this.</div>" : "") +
      '<div style="display:grid;gap:10px"><span class="mono-label">History</span><ol class="timeline">' +
      hist.map(function (h) { return '<li><span class="dot"></span><span><b>' + esc(h.text) + "</b><small>" + esc(fmtDT(h.at)) + "</small></span></li>"; }).join("") + "</ol></div>" +
      '<div class="field"><label for="rnotes">Notes</label><textarea class="input" id="rnotes" rows="3" placeholder="Private notes for your team">' + esc(r.notes || "") + '</textarea><button class="btn btn-g btn-sm" style="justify-self:start" data-act="save-notes" data-id="' + esc(r.id) + '">Save notes</button></div>' +
      '<div class="actions">' + actions + "</div></aside>";
  }
  function findRes(id) { return D().reservations.filter(function (r) { return r.id === id; })[0]; }

  function messageModal(r, kind) {
    var s = sess(r.session_id) || {}, link = payLink(r);
    var holdUntil = holdEnd(r);
    var text = kind === "reminder"
      ? "Hi " + firstName(r.name) + ", this is PROVIDETECH AI ASSISTANCE. Your seat in the " + s.title + " (" + s.code + ", " + fmtLong(s.date) + ") is reserved, but we haven't received your " + peso(r.amount) + " payment yet.\n\nYou can pay here: " + link + "\n\nWe'll hold your seat until " + fmtDT(holdUntil.toISOString()) + ". Thank you!"
      : "Hi " + firstName(r.name) + ", you're all set for the " + s.title + " on " + fmtLong(s.date) + (s.time_label ? ", " + s.time_label : "") + ".\n\nWhere: " + (s.venue || "[Venue or meeting link]") + "\n\nPlease join 15 minutes early and bring a laptop. See you there!\n— PROVIDETECH AI ASSISTANCE";
    var subject = kind === "reminder" ? "Complete your workshop reservation" : "Your workshop details — " + s.code;
    openModal(kind === "reminder" ? "Payment reminder" : "Workshop details",
      '<p class="muted" style="margin:0">To ' + esc(r.name) + " · " + esc(r.email) + " · " + esc(fullPhone(r.phone)) + "</p>" +
      field(lbl("mtext", "Message"), '<textarea class="input" id="mtext" name="text" rows="9">' + esc(text) + "</textarea>", "Edit it if you like, then send it by email, text or Messenger.") +
      '<div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" class="btn btn-g btn-sm" data-act="msg-copy">' + I.copy + 'Copy message</button>' +
      '<a class="btn btn-g btn-sm" data-act="msg-email" href="#" data-to="' + esc(r.email) + '" data-subject="' + esc(subject) + '">Open in email</a>' +
      '<a class="btn btn-g btn-sm" data-act="msg-sms" href="#" data-to="+63' + esc(r.phone) + '">Open in text messages</a></div>',
      { submit: "Mark as sent", onSubmit: function () {
        act(PT.admin.updateReservation(r.id, {}, kind === "reminder" ? "Payment reminder sent" : "Workshop details sent"), "Logged as sent");
      } });
  }
  function exportCsv() {
    var s = sess(S.p.batch), rows = pRows();
    var head = ["Name", "Email", "Mobile", "Batch", "Workshop date", "Method", "Status", "Reference", "Amount", "Reserved at", "Paid at", "Source", "Notes"];
    var lines = [head].concat(rows.map(function (r) {
      return [r.name, r.email, fullPhone(r.phone), s.code, s.date, METHOD[r.method] || r.method, (RST[r.status] || [r.status])[0], r.ref, r.amount, r.created_at, r.paid_at || "", r.source, r.notes];
    })).map(function (row) {
      return row.map(function (v) { v = String(v == null ? "" : v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(",");
    }).join("\r\n");
    var blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = (s.code || "participants").replace(/\s+/g, "-").toLowerCase() + "-participants.csv";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast("Exported " + rows.length + (rows.length === 1 ? " participant" : " participants"));
  }

  /* -------------------------------------------------------------- payments */
  function viewPayments() {
    var now = Date.now(), day = 86400000, from;
    if (S.pay.period === "month") { var m = new Date(); from = new Date(m.getFullYear(), m.getMonth(), 1).getTime(); }
    else if (S.pay.period === "30") from = now - 30 * day; else from = 0;
    var list = D().reservations.filter(function (r) { return r.paid_at && new Date(r.paid_at).getTime() >= from && (r.status === "paid" || r.status === "refund_requested" || r.status === "refunded"); })
      .sort(function (a, b) { return a.paid_at < b.paid_at ? 1 : -1; });
    var collected = 0, refunded = 0, by = {}, wsIn = 0, hubIn = 0, hubN = 0;
    list.forEach(function (r) {
      collected += r.amount; if (r.status === "refunded") refunded += r.amount; by[r.method] = (by[r.method] || 0) + (r.status === "refunded" ? 0 : r.amount);
      if (r.status !== "refunded") { wsIn += wsAmt(r); if (hubAmt(r)) { hubIn += hubAmt(r); hubN++; } }
    });
    var pend = D().reservations.filter(function (r) { return r.status === "pending"; });
    var pendAmt = pend.reduce(function (s, r) { return s + r.amount; }, 0);
    return '<header class="page-head"><div><h1>Payments</h1><p>Money received, refunds and payments still waiting.</p></div>' +
      '<div class="head-actions"><label for="pperiod" class="muted" style="font-weight:500">Period</label><select class="input" id="pperiod" data-model="pay.period" style="width:auto">' +
      opt("month", "This month", S.pay.period) + opt("30", "Last 30 days", S.pay.period) + opt("all", "All time", S.pay.period) + "</select></div></header>" +
      '<section class="kpis">' +
      '<div class="card kpi"><span class="label">Workshop seats</span><span class="value">' + peso(wsIn) + '</span><span class="sub">' + list.filter(function (r) { return r.status !== "refunded"; }).length + " paid seats</span></div>" +
      '<div class="card kpi"><span class="label">Builder Hub</span><span class="value">' + peso(hubIn) + '</span><span class="sub">' + hubN + (hubN === 1 ? " member" : " members") + ' · <a href="#/hub">Hub tracker</a></span></div>' +
      '<div class="card kpi"><span class="label">Refunded</span><span class="value">' + peso(refunded) + '</span><span class="sub">' + list.filter(function (r) { return r.status === "refunded"; }).length + " refunds</span></div>" +
      '<div class="card kpi"><span class="label">Net</span><span class="value">' + peso(collected - refunded) + '</span><span class="sub">' + Object.keys(by).map(function (k) { return (METHOD[k] || k) + " " + peso(by[k]); }).join(" · ") + "</span></div>" +
      '<div class="card kpi"><span class="label">Waiting for payment</span><span class="value">' + peso(pendAmt) + '</span><span class="sub">' + pend.length + ' reservations · <a href="#/participants" data-act="go-tab" data-id="pending">View</a></span></div></section>' +
      '<section class="card"><div class="card-head"><h2>Transactions</h2></div>' +
      (list.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Participant</th><th>Batch</th><th>Method</th><th>Reference</th><th>Status</th><th style="text-align:right">Workshop</th><th style="text-align:right">Builder Hub</th></tr></thead><tbody>' +
        list.map(function (r) {
          var s = sess(r.session_id);
          return '<tr class="click" data-act="open-res" data-id="' + esc(r.id) + '"><td class="muted">' + esc(fmtDT(r.paid_at)) + "</td><td><b style=\"font-weight:600\">" + esc(r.name) + "</b></td><td>" + esc(s ? s.code : "—") + "</td><td>" + esc(METHOD[r.method] || r.method) +
            '</td><td style="font-family:var(--mono);font-size:12.5px">' + esc(r.ref || "—") + "</td><td>" + pill(RST, r.status) + '</td><td style="text-align:right" class="num">' + (r.status === "refunded" ? '<span class="muted">−' + peso(wsAmt(r)) + "</span>" : peso(wsAmt(r))) + '</td><td style="text-align:right" class="num">' + (hubAmt(r) ? (r.status === "refunded" ? '<span class="muted">−' + peso(hubAmt(r)) + "</span>" : peso(hubAmt(r))) : '<span class="muted">—</span>') + "</td></tr>";
        }).join("") + "</tbody></table></div>" : '<div class="empty">No payments in this period.</div>') + "</section>" +
      '<p class="muted" style="font-size:12.5px;margin:0">Payments are confirmed here when you mark a participant as paid. Once your payment provider is connected, this can update automatically.</p>';
  }

  /* -------------------------------------------------------------- inquiries */
  var ITABS = [["new", "New"], ["contacted", "Contacted"], ["proposal", "Proposal sent"], ["won", "Won"], ["lost", "Lost"], ["all", "All"]];
  function viewInquiries() {
    var all = D().inquiries.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    var rows = all.filter(function (q) { return S.i.tab === "all" || q.status === S.i.tab; });
    if (!S.i.sel || !rows.some(function (q) { return q.id === S.i.sel; })) S.i.sel = rows.length ? rows[0].id : null;
    var q = all.filter(function (x) { return x.id === S.i.sel; })[0];
    var tabs = '<div class="tabs" role="group" aria-label="Filter by stage">' + ITABS.map(function (t) {
      var c = all.filter(function (x) { return t[0] === "all" || x.status === t[0]; }).length;
      return '<button type="button" class="tab" data-act="itab" data-id="' + t[0] + '" aria-pressed="' + (S.i.tab === t[0]) + '">' + t[1] + '<span class="c num">' + c + "</span></button>";
    }).join("") + "</div>";
    var list = '<section class="card list" style="padding:16px 18px"><div class="toolbar">' + tabs + "</div>" +
      (rows.length ? '<div class="inq-list">' + rows.map(function (x) {
        return '<button class="inq' + (x.id === S.i.sel ? " sel" : "") + '" data-act="isel" data-id="' + esc(x.id) + '"><span class="inq-top"><b>' + esc(x.business || x.name) + "</b>" + pill(IST, x.status) + '</span><span class="need">' + esc(x.need || "General inquiry") + " · " + esc(x.name) + '</span><span class="meta">' + esc(x.source) + " · " + esc(rel(x.created_at)) + "</span></button>";
      }).join("") + "</div>" : '<div class="empty">No inquiries here.</div>') + "</section>";
    var detail = !q ? '<aside class="card detail"><div class="empty">Select an inquiry.</div></aside>' :
      '<aside class="card detail" aria-label="Inquiry details"><div class="detail-head"><span class="av">' + esc(initials(q.business || q.name)) + '</span><span style="display:grid;gap:4px;min-width:0"><b>' + esc(q.business || q.name) + "</b>" + pill(IST, q.status) + "</span></div>" +
      '<dl class="facts"><dt>Contact</dt><dd>' + esc(q.name) + "</dd>" + (q.email ? '<dt>Email</dt><dd><a href="mailto:' + esc(q.email) + '">' + esc(q.email) + "</a></dd>" : "") +
      (q.phone ? "<dt>Mobile</dt><dd>" + esc(fullPhone(q.phone)) + "</dd>" : "") + "<dt>Needs</dt><dd>" + esc(q.need || "—") + "</dd><dt>From</dt><dd>" + esc(q.source) + "</dd><dt>Received</dt><dd>" + esc(fmtDT(q.created_at)) + "</dd></dl>" +
      (q.message ? '<div class="msg">' + esc(q.message) + "</div>" : "") +
      field(lbl("istatus", "Stage"), '<select class="input" id="istatus">' + ITABS.slice(0, 5).map(function (t) { return opt(t[0], t[1], q.status); }).join("") + "</select>") +
      field(lbl("inotes", "Notes"), '<textarea class="input" id="inotes" rows="4" placeholder="Calls, quotes, next steps">' + esc(q.notes || "") + "</textarea>") +
      '<div class="actions"><button class="btn btn-p" data-act="save-inq" data-id="' + esc(q.id) + '">Save</button>' +
      (q.email ? '<button class="btn btn-g" data-act="copy" data-text="' + esc(q.email) + '">' + I.copy + "Copy email</button>" : "") +
      (q.phone ? '<button class="btn btn-g" data-act="copy" data-text="' + esc(fullPhone(q.phone)) + '">' + I.copy + "Copy mobile number</button>" : "") + "</div></aside>";
    return '<header class="page-head"><div><h1>Inquiries</h1><p>Messages from “Talk to Our Team” and “Discuss Your Business Idea” on the website.</p></div></header><div class="split">' + list + detail + "</div>";
  }

  /* -------------------------------------------------------------- builder hub */
  function members() { return (D().members || []); }
  function memberActive(m) { return new Date(m.access_until).getTime() > Date.now(); }
  function activeMembers() { return members().filter(memberActive); }
  function hubOffer() { return setting("hub_offer") || { enabled: false, price: 0, compare_at: 0, months: 12 }; }
  function hubNote(res, lead) {
    lead = lead ? lead + " · " : "";
    if (res && res.ok) return lead + "Builder Hub access emailed";
    return lead + "Builder Hub: " + ((res && res.message) || "couldn't send access");
  }
  function grantHub(r) {
    return PT.admin.hub("provision", { reservation_id: r.id }).then(function (x) { return x; }, function (e) { return { ok: false, code: e.code, message: e.message }; });
  }
  var HTABS = [["active", "Active"], ["expiring", "Expiring in 30 days"], ["ended", "Ended"], ["all", "All"]];
  function hMatch(m, tab) {
    var left = new Date(m.access_until).getTime() - Date.now();
    if (tab === "active") return left > 0;
    if (tab === "expiring") return left > 0 && left < 30 * 86400000;
    if (tab === "ended") return left <= 0;
    return true;
  }
  /* ---- hub content (stage 2) ---- */
  var PROMPT_CATS = ["Marketing", "Sales", "Customer service", "Operations", "Content", "Coding with AI"];
  var HVIEWS = [["members", "Members"], ["courses", "Courses & lessons"], ["replays", "Replays"], ["prompts", "Prompt Library"]];
  function hubContent(t) { return (D()[t] || []); }
  /** Vimeo or YouTube link → embeddable player URL (or "" if not recognised). */
  function videoEmbed(url) {
    url = String(url || "").trim(); var m;
    if ((m = /^https:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?h=([\w]+))?/.exec(url))) return "https://player.vimeo.com/video/" + m[1] + (m[2] ? "?h=" + m[2] : "");
    if ((m = /^https:\/\/(?:www\.)?vimeo\.com\/(?:.*\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/.exec(url))) return "https://player.vimeo.com/video/" + m[1] + (m[2] ? "?h=" + m[2] : "");
    if ((m = /^https:\/\/(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/.exec(url)) || (m = /^https:\/\/youtu\.be\/([\w-]{6,})/.exec(url)) || (m = /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed|live|shorts)\/([\w-]{6,})/.exec(url))) return "https://www.youtube-nocookie.com/embed/" + m[1];
    return "";
  }
  function pubPill(x) { return x.published ? '<span class="pill ok">Published</span>' : '<span class="pill mute">Draft</span>'; }
  function mins(n) { n = Number(n) || 0; return n ? (n >= 60 ? Math.floor(n / 60) + "h " + (n % 60 ? (n % 60) + "m" : "") : n + " min") : ""; }
  function viewHub() {
    var tabs = '<div class="tabs" role="group" aria-label="Builder Hub sections" style="margin:4px 0 18px">' + HVIEWS.map(function (v) {
      var c = v[0] === "members" ? members().length : hubContent(v[0]).length;
      return '<button type="button" class="tab" data-act="hview" data-id="' + v[0] + '" aria-pressed="' + (S.h.view === v[0]) + '">' + esc(v[1]) + '<span class="c num">' + c + "</span></button>";
    }).join("") + "</div>";
    var head = '<header class="page-head"><div><h1>Builder Hub</h1><p>Members and everything inside the hub. Only <b>Published</b> items are visible to members.</p></div>' +
      '<div class="head-actions"><a class="btn btn-g" href="/hub/" target="_blank" rel="noopener">Open the hub ↗</a>' +
      (S.h.view === "members" ? '<button class="btn btn-p" data-act="hub-add">' + I.plus + "Add member</button>" :
        S.h.view === "courses" ? '<button class="btn btn-p" data-act="course-new">' + I.plus + "New course</button>" :
        S.h.view === "replays" ? '<button class="btn btn-p" data-act="replay-new">' + I.plus + "New replay</button>" :
        '<button class="btn btn-p" data-act="prompt-new">' + I.plus + "New prompt</button>") + "</div></header>";
    var body = S.h.view === "courses" ? viewHubCourses() : S.h.view === "replays" ? viewHubReplays() : S.h.view === "prompts" ? viewHubPrompts() : viewHubMembers();
    return head + tabs + body;
  }
  function viewHubCourses() {
    var cs = hubContent("courses").slice().sort(function (a, b) { return (a.sort - b.sort) || (a.created_at < b.created_at ? -1 : 1); });
    if (!cs.length) return '<div class="card empty">No courses yet. Click <b>New course</b>, then add written lessons.</div>';
    return '<div style="display:grid;gap:16px">' + cs.map(function (c) {
      var ls = hubContent("lessons").filter(function (l) { return l.course_id === c.id; }).sort(function (a, b) { return (a.sort - b.sort) || (a.created_at < b.created_at ? -1 : 1); });
      var total = ls.reduce(function (t, l) { return t + (Number(l.duration_min) || 0); }, 0);
      return '<section class="card" style="padding:20px 22px"><div class="batch-top"><div><span class="mono-label">Course · ' + ls.length + (ls.length === 1 ? " lesson" : " lessons") + (total ? " · " + total + " min read" : "") + '</span><h2 style="font-size:18px;margin-top:4px">' + esc(c.title) + "</h2>" +
        (c.description ? '<p class="muted" style="margin:4px 0 0;max-width:70ch">' + esc(c.description) + "</p>" : "") + "</div>" + pubPill(c) + "</div>" +
        (ls.length ? '<div class="table-wrap" style="margin-top:14px"><table class="t"><thead><tr><th>#</th><th>Lesson</th><th>Reading time</th><th>Status</th><th></th></tr></thead><tbody>' + ls.map(function (l, i) {
          return '<tr><td class="muted num">' + (i + 1) + "</td><td>" + (l.section ? '<small style="display:block;color:var(--ink-3);font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">' + esc(l.section) + "</small>" : "") + "<b>" + esc(l.title) + "</b>" + (String(l.description || "").trim() ? "" : ' <span class="pill warn">No content</span>') + '</td><td class="muted">' + esc(l.duration_min ? l.duration_min + " min" : "—") + "</td><td>" + pubPill(l) +
            '</td><td style="text-align:right;white-space:nowrap"><button class="btn btn-g btn-sm" data-act="lesson-edit" data-id="' + esc(l.id) + '">Edit</button> <button class="btn btn-g btn-sm" data-act="content-del" data-table="lessons" data-id="' + esc(l.id) + '">Delete</button></td></tr>';
        }).join("") + "</tbody></table></div>" : '<p class="muted" style="margin:12px 0 0">No lessons yet.</p>') +
        '<div class="batch-actions" style="margin-top:14px"><button class="btn btn-p btn-sm" data-act="lesson-new" data-id="' + esc(c.id) + '">' + I.plus + 'Add lesson</button><button class="btn btn-g btn-sm" data-act="course-edit" data-id="' + esc(c.id) + '">Edit course</button><button class="btn btn-g btn-sm" data-act="content-del" data-table="courses" data-id="' + esc(c.id) + '">Delete course</button></div></section>';
    }).join("") + "</div>";
  }
  function viewHubReplays() {
    var rs = hubContent("replays").slice().sort(function (a, b) { return String(b.recorded_on || b.created_at) < String(a.recorded_on || a.created_at) ? -1 : 1; });
    if (!rs.length) return '<div class="card empty">No replays yet. Click <b>New replay</b> and paste the Vimeo link of a past live build.</div>';
    return '<section class="card list" style="padding:16px 18px"><div class="table-wrap"><table class="t"><thead><tr><th>Replay</th><th>Recorded</th><th>Length</th><th>Status</th><th></th></tr></thead><tbody>' + rs.map(function (r) {
      return "<tr><td><b>" + esc(r.title) + "</b>" + (videoEmbed(r.video_url) ? "" : ' <span class="pill warn">Check link</span>') + '</td><td class="muted">' + esc(r.recorded_on ? fmtDate(r.recorded_on) : "—") + '</td><td class="muted">' + esc(mins(r.duration_min) || "—") + "</td><td>" + pubPill(r) +
        '</td><td style="text-align:right;white-space:nowrap"><button class="btn btn-g btn-sm" data-act="replay-edit" data-id="' + esc(r.id) + '">Edit</button> <button class="btn btn-g btn-sm" data-act="content-del" data-table="replays" data-id="' + esc(r.id) + '">Delete</button></td></tr>';
    }).join("") + "</tbody></table></div></section>";
  }
  function viewHubPrompts() {
    var ps = hubContent("prompts");
    if (!ps.length) return '<div class="card empty">No prompts yet. Click <b>New prompt</b>. Members can copy them with one click.</div>';
    var cats = PROMPT_CATS.concat(ps.map(function (p) { return p.category; }).filter(function (c, i, a) { return PROMPT_CATS.indexOf(c) < 0 && a.indexOf(c) === i; }));
    return '<div style="display:grid;gap:16px">' + cats.map(function (cat) {
      var list = ps.filter(function (p) { return p.category === cat; }).sort(function (a, b) { return (a.sort - b.sort) || (a.created_at < b.created_at ? -1 : 1); });
      if (!list.length) return "";
      return '<section class="card list" style="padding:16px 18px"><h2 style="font-size:16px;margin-bottom:8px">' + esc(cat) + ' <span class="muted" style="font-weight:500">· ' + list.length + '</span></h2><div class="table-wrap"><table class="t"><tbody>' + list.map(function (p) {
        return '<tr><td><b>' + esc(p.title) + '</b><small style="display:block;color:var(--ink-3);max-width:70ch;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.body.slice(0, 140)) + "</small></td><td>" + pubPill(p) +
          '</td><td style="text-align:right;white-space:nowrap"><button class="btn btn-g btn-sm" data-act="prompt-edit" data-id="' + esc(p.id) + '">Edit</button> <button class="btn btn-g btn-sm" data-act="content-del" data-table="prompts" data-id="' + esc(p.id) + '">Delete</button></td></tr>';
      }).join("") + "</tbody></table></div></section>";
    }).join("") + "</div>";
  }
  function pubField(x) { return '<label class="span2" style="display:flex;gap:10px;align-items:center;font-weight:600"><input type="checkbox" name="published"' + (x.published ? " checked" : "") + ' style="width:18px;height:18px;accent-color:var(--btn)"> Published (visible to members)</label>'; }
  function videoHint() { return "Paste the Vimeo link (for example https://vimeo.com/123456789). YouTube links work too."; }
  function courseForm(c) {
    c = c || { title: "", description: "", sort: hubContent("courses").length + 1, published: false };
    openModal(c.id ? "Edit course" : "New course", '<div class="form-grid">' +
      '<div class="span2">' + field(lbl("ctitle", "Course title"), '<input class="input" id="ctitle" name="title" required value="' + esc(c.title) + '">') + "</div>" +
      '<div class="span2">' + field(lbl("cdesc", "Short description"), '<textarea class="input" id="cdesc" name="description" rows="3">' + esc(c.description) + "</textarea>") + "</div>" +
      field(lbl("csort", "Order"), '<input class="input" id="csort" name="sort" type="number" step="1" value="' + esc(c.sort) + '">', "Lower numbers show first.") + pubField(c) + "</div>",
      { submit: c.id ? "Save course" : "Create course", onSubmit: function (f) {
        if (f.title.trim().length < 2) throw new Error("Give the course a title.");
        act(PT.admin.saveContent("courses", { id: c.id, title: f.title.trim(), description: f.description.trim(), sort: parseInt(f.sort, 10) || 0, published: !!f.published }), c.id ? "Course saved" : "Course created");
      } });
  }
  function lessonForm(l, courseId) {
    var siblings = hubContent("lessons").filter(function (x) { return x.course_id === (l ? l.course_id : courseId); });
    l = l || { course_id: courseId, title: "", section: (siblings[siblings.length - 1] || {}).section || "", description: "", video_url: "", duration_min: "", sort: siblings.length + 1, published: true };
    var secList = siblings.map(function (x) { return x.section || ""; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    openModal(l.id ? "Edit lesson" : "Add lesson", '<div class="form-grid">' +
      '<div class="span2">' + field(lbl("lcourse", "Course"), '<select class="input" id="lcourse" name="course_id">' + hubContent("courses").map(function (c) { return opt(c.id, c.title, l.course_id); }).join("") + "</select>") + "</div>" +
      '<div class="span2">' + field(lbl("ltitle", "Lesson title"), '<input class="input" id="ltitle" name="title" required value="' + esc(l.title) + '">') + "</div>" +
      '<div class="span2">' + field(lbl("lsec", "Section (optional)"), '<input class="input" id="lsec" name="section" maxlength="80" list="lsec-list" placeholder="e.g. Starter Prompts" value="' + esc(l.section || "") + '"><datalist id="lsec-list">' + secList.map(function (x) { return '<option value="' + esc(x) + '">'; }).join("") + "</datalist>", "Lessons with the same section are grouped together (e.g. 01 Starter Prompts, 02 Master Prompts).") + "</div>" +
      field(lbl("ldur", "Reading time (minutes)"), '<input class="input" id="ldur" name="duration_min" type="number" min="0" step="1" value="' + esc(l.duration_min) + '">', "Leave empty to work it out automatically.") +
      field(lbl("lsort", "Order"), '<input class="input" id="lsort" name="sort" type="number" step="1" value="' + esc(l.sort) + '">') +
      '<div class="span2">' + field(lbl("ldesc", "Lesson content"), '<textarea class="input" id="ldesc" name="description" rows="16" maxlength="40000" style="font-family:var(--mono);font-size:13px;line-height:1.55" placeholder="Write the lesson here.">' + esc(l.description) + "</textarea>",
        "Formatting: ## Heading · ### Smaller heading · - bullet · 1. step · **bold** · > Try it box · [link text](https://…) for templates or downloads · put an example prompt between two ``` lines to give it a Copy button.") + "</div>" + pubField(l) + "</div>",
      { submit: l.id ? "Save lesson" : "Add lesson", onSubmit: function (f) {
        if (f.title.trim().length < 2) throw new Error("Give the lesson a title.");
        if (f.published && !f.description.trim()) throw new Error("Write the lesson content before publishing, or untick Published.");
        var words = f.description.trim().split(/\s+/).filter(Boolean).length;
        act(PT.admin.saveContent("lessons", { id: l.id, course_id: f.course_id, title: f.title.trim(), section: (f.section || "").trim(), description: f.description.trim(), video_url: "", duration_min: Math.max(0, parseInt(f.duration_min, 10) || Math.max(1, Math.round(words / 200))), sort: parseInt(f.sort, 10) || 0, published: !!f.published }), l.id ? "Lesson saved" : "Lesson added");
      } });
  }
  function replayForm(r) {
    r = r || { title: "", description: "", video_url: "", recorded_on: "", duration_min: "", published: true };
    openModal(r.id ? "Edit replay" : "New replay", '<div class="form-grid">' +
      '<div class="span2">' + field(lbl("rtitle", "Title"), '<input class="input" id="rtitle" name="title" required placeholder="e.g. Live build: booking system for a clinic" value="' + esc(r.title) + '">') + "</div>" +
      '<div class="span2">' + field(lbl("rvideo", "Video link"), '<input class="input" id="rvideo" name="video_url" type="url" inputmode="url" required placeholder="https://vimeo.com/…" value="' + esc(r.video_url) + '">', videoHint()) + "</div>" +
      field(lbl("rdate", "Recorded on"), '<input class="input" id="rdate" name="recorded_on" type="date" value="' + esc(r.recorded_on || "") + '">') +
      field(lbl("rdur", "Length (minutes)"), '<input class="input" id="rdur" name="duration_min" type="number" min="0" step="1" value="' + esc(r.duration_min) + '">') +
      '<div class="span2">' + field(lbl("rdesc", "What's inside (optional)"), '<textarea class="input" id="rdesc" name="description" rows="4">' + esc(r.description) + "</textarea>") + "</div>" + pubField(r) + "</div>",
      { submit: r.id ? "Save replay" : "Add replay", onSubmit: function (f) {
        if (f.title.trim().length < 2) throw new Error("Give the replay a title.");
        if (!videoEmbed(f.video_url)) throw new Error("Paste a Vimeo or YouTube video link.");
        act(PT.admin.saveContent("replays", { id: r.id, title: f.title.trim(), description: f.description.trim(), video_url: f.video_url.trim(), recorded_on: f.recorded_on || null, duration_min: Math.max(0, parseInt(f.duration_min, 10) || 0), published: !!f.published }), r.id ? "Replay saved" : "Replay added");
      } });
  }
  function promptForm(p) {
    p = p || { category: PROMPT_CATS[0], title: "", body: "", sort: 0, published: true };
    var cats = PROMPT_CATS.concat(hubContent("prompts").map(function (x) { return x.category; })).filter(function (c, i, a) { return a.indexOf(c) === i; });
    openModal(p.id ? "Edit prompt" : "New prompt", '<div class="form-grid">' +
      field(lbl("pcat", "Category"), '<input class="input" id="pcat" name="category" list="pcats" required value="' + esc(p.category) + '"><datalist id="pcats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>", "Pick one or type a new category.") +
      field(lbl("psort", "Order"), '<input class="input" id="psort" name="sort" type="number" step="1" value="' + esc(p.sort) + '">') +
      '<div class="span2">' + field(lbl("ptitle", "Title"), '<input class="input" id="ptitle" name="title" required placeholder="e.g. Write a Facebook ad for a promo" value="' + esc(p.title) + '">') + "</div>" +
      '<div class="span2">' + field(lbl("pbody", "Prompt"), '<textarea class="input" id="pbody" name="body" rows="9" required placeholder="Write the full prompt. Use [BRACKETS] for parts members should replace.">' + esc(p.body) + "</textarea>") + "</div>" + pubField(p) + "</div>",
      { submit: p.id ? "Save prompt" : "Add prompt", onSubmit: function (f) {
        if (!f.category.trim()) throw new Error("Choose a category.");
        if (f.title.trim().length < 2) throw new Error("Give the prompt a title.");
        if (!f.body.trim()) throw new Error("Write the prompt.");
        act(PT.admin.saveContent("prompts", { id: p.id, category: f.category.trim().slice(0, 60), title: f.title.trim(), body: f.body.trim(), sort: parseInt(f.sort, 10) || 0, published: !!f.published }), p.id ? "Prompt saved" : "Prompt added");
      } });
  }
  function viewHubMembers() {
    var all = members().slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    var q = S.h.q.trim().toLowerCase();
    var rows = all.filter(function (m) { return hMatch(m, S.h.tab) && (!q || (m.name + " " + m.email).toLowerCase().indexOf(q) >= 0); });
    if (!S.h.sel || !rows.some(function (m) { return m.user_id === S.h.sel; })) S.h.sel = rows.length ? rows[0].user_id : null;
    var sel = all.filter(function (m) { return m.user_id === S.h.sel; })[0];
    var addonRev = D().reservations.filter(function (r) { return r.addon_hub && (r.status === "paid" || r.status === "refund_requested"); }).reduce(function (t, r) { return t + (r.addon_amount || 0); }, 0);
    var addonCount = D().reservations.filter(function (r) { return r.addon_hub && r.status === "paid"; }).length;
    var paidAll = D().reservations.filter(function (r) { return r.status === "paid"; }).length;
    var o = hubOffer();
    var kpis = '<section class="kpis">' +
      '<div class="card kpi"><span class="label">Active members</span><span class="value">' + activeMembers().length + '</span><span class="sub">' + all.filter(function (m) { return hMatch(m, "expiring"); }).length + " expiring in 30 days</span></div>" +
      '<div class="card kpi"><span class="label">Add-on revenue</span><span class="value">' + peso(addonRev) + '</span><span class="sub">' + addonCount + " paid add-ons</span></div>" +
      '<div class="card kpi"><span class="label">Add-on take rate</span><span class="value">' + (paidAll ? Math.round(addonCount / paidAll * 100) : 0) + '%</span><span class="sub">of paid workshop seats</span></div>' +
      '<div class="card kpi"><span class="label">Checkout offer</span><span class="value" style="font-size:22px">' + (o.enabled ? peso(o.price) : "Off") + '</span><span class="sub">' + (o.enabled ? (o.months || 12) + " months · <a href=\"#/settings\">Edit</a>" : '<a href="#/settings">Turn on in Settings</a>') + "</span></div></section>";
    var tabs = '<div class="tabs" role="group" aria-label="Filter members">' + HTABS.map(function (t) {
      var c = all.filter(function (m) { return hMatch(m, t[0]); }).length;
      return '<button type="button" class="tab" data-act="htab" data-id="' + t[0] + '" aria-pressed="' + (S.h.tab === t[0]) + '">' + esc(t[1]) + '<span class="c num">' + c + "</span></button>";
    }).join("") + "</div>";
    var list = '<section class="card list" style="padding:16px 18px 12px"><div class="toolbar">' + tabs +
      '<div class="search">' + I.search + '<label for="hsearch" class="sr-only">Search members</label><input id="hsearch" type="search" placeholder="Search name or email" data-model="h.q" value="' + esc(S.h.q) + '"></div></div>' +
      (rows.length ? '<div class="table-wrap"><table class="t"><thead><tr><th>Member</th><th>Access until</th><th>Status</th></tr></thead><tbody>' + rows.map(function (m) {
        var on = memberActive(m);
        return '<tr class="click' + (m.user_id === S.h.sel ? " sel" : "") + '" data-act="hsel" data-id="' + esc(m.user_id) + '"><td><span class="who"><span class="av">' + esc(initials(m.name || m.email)) + "</span><span><b>" + esc(m.name || m.email) + "</b><small>" + esc(m.email) + "</small></span></span></td>" +
          '<td class="muted">' + esc(fmtDay(new Date(m.access_until))) + " " + new Date(m.access_until).getFullYear() + "</td><td>" + (on ? '<span class="pill ok">Active</span>' : '<span class="pill mute">Ended</span>') + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="empty">' + (all.length ? "No members match." : "No members yet. People who add the Builder Hub at checkout appear here automatically after paying.") + "</div>") + "</section>";
    var detail = !sel ? '<aside class="card detail"><div class="empty">Select a member.</div></aside>' :
      '<aside class="card detail" aria-label="Member details"><div class="detail-head"><span class="av">' + esc(initials(sel.name || sel.email)) + '</span><span style="display:grid;gap:4px;min-width:0"><b>' + esc(sel.name || sel.email) + "</b>" + (memberActive(sel) ? '<span class="pill ok" style="justify-self:start">Active</span>' : '<span class="pill mute" style="justify-self:start">Ended</span>') + "</span></div>" +
      '<dl class="facts"><dt>Email</dt><dd><a href="mailto:' + esc(sel.email) + '">' + esc(sel.email) + "</a></dd><dt>Access until</dt><dd>" + esc(new Date(sel.access_until).toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" })) + "</dd><dt>Joined</dt><dd>" + esc(fmtDT(sel.created_at)) + "</dd><dt>From</dt><dd>" + esc(sel.source === "admin" ? "Added by admin" : "Checkout add-on") + "</dd><dt>Points</dt><dd>" + (sel.points || 0) + " · " + hubLevel(sel.points) + "</dd><dt>Language</dt><dd>" + esc({ en: "English", tl: "Tagalog", ceb: "Bisaya" }[sel.lang] || "English") + "</dd></dl>" +
      '<div style="display:grid;gap:10px"><span class="mono-label">History</span><ol class="timeline">' + (sel.history || []).slice().reverse().map(function (h) { return '<li><span class="dot"></span><span><b>' + esc(h.text) + "</b><small>" + esc(fmtDT(h.at)) + "</small></span></li>"; }).join("") + "</ol></div>" +
      '<div class="actions"><button class="btn btn-p" data-act="hub-resend" data-id="' + esc(sel.user_id) + '">Resend “set password” email</button>' +
      '<button class="btn btn-g" data-act="hub-extend" data-id="' + esc(sel.user_id) + '">Extend access</button>' +
      (memberActive(sel) ? '<button class="btn btn-danger" data-act="hub-revoke" data-id="' + esc(sel.user_id) + '">End access now</button>' : "") + "</div></aside>";
    return kpis + '<div class="split">' + list + detail + "</div>";
  }

  /* -------------------------------------------------------------- settings */
  function hubOfferCard() {
    var o = hubOffer();
    return '<form class="card" data-form="hub" novalidate><h2>Builder Hub offer at checkout</h2><p>The “Add to your order” box on the checkout page. Buyers get a Builder Hub login by email right after paying.</p><div class="form-grid">' +
      '<label class="span2" style="display:flex;gap:10px;align-items:center;font-weight:600"><input type="checkbox" name="enabled"' + (o.enabled ? " checked" : "") + ' style="width:18px;height:18px;accent-color:var(--btn)"> Show the offer at checkout</label>' +
      field(lbl("ho-price", "Price (₱)"), '<input class="input" id="ho-price" name="price" type="number" min="1" step="1" value="' + esc(o.price) + '">') +
      field(lbl("ho-cmp", "Regular price, shown crossed out (₱)"), '<input class="input" id="ho-cmp" name="compare_at" type="number" min="0" step="1" value="' + esc(o.compare_at || "") + '">', "Leave empty to hide the discount.") +
      field(lbl("ho-months", "Access length (months)"), '<input class="input" id="ho-months" name="months" type="number" min="1" max="60" step="1" value="' + esc(o.months || 12) + '">') +
      '</div><div class="save-row"><button class="btn btn-p" type="submit">Save offer</button></div></form>';
  }
  function pmCard(demo) {
    var head = '<section class="card"><h2>Automatic payments (PayMongo)</h2><p>Each person gets their own PayMongo checkout. When they pay, their seat is marked <b>Paid</b> and the Zoom link is emailed, with no clicks from you. “Mark as paid” stays available for cash or bank transfers.</p>';
    if (demo) return head + '<div class="callout info">Demo mode uses the payment link above. Automatic payments work once the site is live.</div></section>';
    var st = S.pm;
    if (!st) { loadPm(); return head + '<p class="muted">Checking connection…</p></section>'; }
    if (st.error) return head + '<div class="callout warn">' + esc(st.error) + '</div><button class="btn btn-g btn-sm" data-act="pm-refresh">Check again</button></section>';
    var modeTxt = st.mode === "live" ? "Live mode (real payments)" : st.mode === "test" ? "Test mode (no real money)" : "";
    if (!st.key_set) return head + '<div class="callout warn"><b>Not connected.</b> Add your PayMongo secret key in Supabase → Edge Functions → Secrets as <span style="font-family:var(--mono)">PAYMONGO_SECRET_KEY</span> (README, step 7). Until then, people pay through the payment link above and you mark them as paid.</div><button class="btn btn-g btn-sm" data-act="pm-refresh">Check again</button></section>';
    if (!st.connected) return head + '<div class="callout warn"><b>Almost there.</b> Key found · ' + esc(modeTxt) + '. Click Connect so PayMongo can tell this site when someone pays.</div><button class="btn btn-p" data-act="pm-connect">Connect PayMongo</button></section>';
    return head + '<div class="callout info"><b>Connected</b> · ' + esc(modeTxt) + '. Payments are confirmed automatically.</div>' +
      (st.mode === "test" ? '<p class="muted" style="margin:10px 0 0">When you\'re ready for real payments, replace the key with your <b>sk_live_</b> key in Supabase, then click Connect again.</p><button class="btn btn-g btn-sm" style="margin-top:10px" data-act="pm-connect">Connect again</button>' : "") + "</section>";
  }
  var pmLoading = false;
  function loadPm() {
    if (pmLoading) return; pmLoading = true;
    PT.admin.paymongo("status").then(function (st) { S.pm = st; }, function (e) { S.pm = { error: e.message || "Couldn't check PayMongo." }; })
      .then(function () { pmLoading = false; if (S.route === "settings") render(); });
  }
  function viewSettings() {
    var l = setting("payment_links") || {}, demo = PT.mode === "demo";
    var cfg = window.PROVIDETECH_CONFIG || {};
    return '<header class="page-head"><div><h1>Settings</h1><p>Payment links, workshop rules and your data connection.</p></div></header><div class="settings-grid">' +
      '<form class="card" data-form="payments" novalidate><h2>Payment links</h2><p>Where the checkout page sends people to pay. Paste links from your payment provider (for example PayMongo or Xendit payment links). Leave a method empty to use the general link.</p><div class="form-grid">' +
      '<div class="span2">' + field(lbl("pl-all", "General payment link (all methods)"), '<input class="input" id="pl-all" name="all" type="url" placeholder="https://" value="' + esc(l.all || "") + '">') + "</div>" +
      field(lbl("pl-gcash", "GCash"), '<input class="input" id="pl-gcash" name="gcash" type="url" placeholder="https://" value="' + esc(l.gcash || "") + '">') +
      field(lbl("pl-qrph", "Bank with QR Ph"), '<input class="input" id="pl-qrph" name="qrph" type="url" placeholder="https://" value="' + esc(l.qrph || "") + '">') +
      '<div class="span2">' + field(lbl("pl-card", "Card"), '<input class="input" id="pl-card" name="card" type="url" placeholder="https://" value="' + esc(l.card || "") + '">') + "</div>" +
      '</div><div class="save-row"><button class="btn btn-p" type="submit">Save payment links</button></div></form>' +
      '<form class="card" data-form="rules" novalidate><h2>Workshop rules</h2><p>Shown to participants at checkout and used for reminders and refund deadlines.</p><div class="form-grid">' +
      field(lbl("hold", "Hold unpaid seats for (hours)"), '<input class="input" id="hold" name="hold_hours" type="number" min="1" max="336" value="' + esc(setting("hold_hours")) + '">') +
      field(lbl("refund", "Money-back guarantee (days)"), '<input class="input" id="refund" name="refund_days" type="number" min="0" max="60" value="' + esc(setting("refund_days")) + '">') +
      '<div class="span2">' + field(lbl("bonuses", "Bonuses included (one per line)"), '<textarea class="input" id="bonuses" name="bonuses" rows="4">' + esc((setting("bonuses") || []).join("\n")) + "</textarea>", "Listed in the checkout order summary.") + "</div>" +
      '</div><div class="save-row"><button class="btn btn-p" type="submit">Save rules</button></div></form>' +
      hubOfferCard() +
      pmCard(demo) +
      '<section class="card"><h2>Zoom link emails</h2><p>When you mark someone as paid (or add a paid walk-in), the Zoom link of their batch is emailed to them in the language they used at checkout. Add the link in <a href="#/workshops">Workshops → Edit</a>.</p>' +
      (demo ? '<div class="callout info">Demo mode: emails are only logged in the participant history, nothing is sent.</div>'
        : '<div class="callout info">Sending uses <b>Resend</b>. One-time setup in Supabase → Edge Functions → Secrets: <span style="font-family:var(--mono)">RESEND_API_KEY</span>, <span style="font-family:var(--mono)">EMAIL_FROM</span> and (optional) <span style="font-family:var(--mono)">EMAIL_REPLY_TO</span>. See README, step 6.</div>') + "</section>" +
      '<section class="card"><h2>Data connection</h2>' + (demo
        ? '<p>You are in <b>demo mode</b>. Everything is stored in this browser only, with sample data. To go live, connect a free Supabase database by following README.md (about 10 minutes).</p><div class="callout info" style="margin-bottom:14px">Demo data never leaves this computer. Real participant data should only be collected after you connect the database and publish a privacy policy.</div><button class="btn btn-danger" data-act="reset-demo">Reset demo data</button>'
        : '<p><b>Live</b> · connected to <span style="font-family:var(--mono)">' + esc((cfg.supabaseUrl || "").replace(/^https?:\/\//, "")) + "</span>. Admin access is controlled by the admins table in Supabase.</p>") + "</section></div>";
  }

  /* -------------------------------------------------------------- render */
  function render() {
    if (!S.user) return renderLogin();
    if (!S.data) { app.innerHTML = '<div class="loading">Loading…</div>'; return; }
    var a = document.activeElement, focusId = a && a.id, caret = null;
    try { caret = a && a.selectionStart; } catch (e) {}
    var views = { overview: viewOverview, workshops: viewWorkshops, participants: viewParticipants, payments: viewPayments, inquiries: viewInquiries, hub: viewHub, settings: viewSettings };
    app.innerHTML = shell((views[S.route] || viewOverview)());
    document.title = ({ overview: "Overview", workshops: "Workshops", participants: "Participants", payments: "Payments", inquiries: "Inquiries", hub: "Builder Hub", settings: "Settings" }[S.route] || "Admin") + " · PROVIDETECH Admin";
    if (focusId) { var el = document.getElementById(focusId); if (el) { el.focus(); try { if (caret != null) el.setSelectionRange(caret, caret); } catch (e) {} } }
  }
  function go(route) { if (location.hash !== "#/" + route) location.hash = "#/" + route; else render(); }
  function readRoute() { var r = (location.hash || "").replace(/^#\/?/, ""); S.route = ROUTES.indexOf(r) >= 0 ? r : "overview"; S.menu = false; }
  window.addEventListener("hashchange", function () { readRoute(); render(); window.scrollTo(0, 0); refresh(); });
  // keep data fresh: new reservations and inquiries show up without a manual reload
  function refresh() {
    if (!S.user || !S.data || S.busy) return;
    var dlg = document.getElementById("modal"); if (dlg && dlg.open) return;
    PT.admin.all().then(function (d) {
      if (JSON.stringify(d) === JSON.stringify(S.data)) return;
      var dlg2 = document.getElementById("modal"); if (dlg2 && dlg2.open) return;
      var typing = document.activeElement && /^(TEXTAREA)$/.test(document.activeElement.tagName);
      S.data = d; if (!typing) render();
    }).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
  window.addEventListener("focus", refresh);
  setInterval(function () { if (!document.hidden) refresh(); }, 60000);

  /* -------------------------------------------------------------- events */
  app.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t || !app.contains(t)) return;
    var a = t.getAttribute("data-act"), id = t.getAttribute("data-id"), r;
    switch (a) {
      case "menu": S.menu = !S.menu; render(); break;
      case "menu-close": S.menu = false; render(); break;
      case "signout": PT.auth.signOut().then(function () { S.user = null; S.data = null; location.hash = ""; renderLogin(); }); break;
      case "modal-close": e.preventDefault(); closeModal(); break;
      case "new-batch": batchForm(null); break;
      case "edit-batch": batchForm(sess(id)); break;
      case "copy-link": copyText(location.origin + "/checkout.html?batch=" + encodeURIComponent(id), "Reservation link copied"); break;
      case "go-batch": e.preventDefault(); S.p.batch = id; S.p.tab = "all"; S.p.sel = null; go("participants"); break;
      case "go-tab": e.preventDefault(); var nx = nextSession(); var rr = D().reservations.filter(function (x) { return x.status === id; })[0];
        S.p.batch = rr ? rr.session_id : nx ? nx.id : null; S.p.tab = id; S.p.q = ""; S.p.sel = null; go("participants"); break;
      case "go": e.preventDefault(); go(id); break;
      case "open-res": r = findRes(id); if (r) { S.p.batch = r.session_id; S.p.tab = "all"; S.p.q = ""; S.p.sel = r.id; go("participants"); } break;
      case "open-inq": var q = D().inquiries.filter(function (x) { return x.id === id; })[0]; if (q) { S.i.tab = q.status; S.i.sel = q.id; go("inquiries"); } break;
      case "ptab": S.p.tab = id; S.p.sel = null; render(); break;
      case "psel": S.p.sel = id; render(); break;
      case "itab": S.i.tab = id; S.i.sel = null; render(); break;
      case "isel": S.i.sel = id; render(); break;
      case "export": exportCsv(); break;
      case "copy": copyText(t.getAttribute("data-text")); break;
      case "save-notes": act(PT.admin.updateReservation(id, { notes: document.getElementById("rnotes").value.slice(0, 1000) }), "Notes saved"); break;
      case "save-inq": act(PT.admin.updateInquiry(id, { status: document.getElementById("istatus").value, notes: document.getElementById("inotes").value.slice(0, 2000) }), "Inquiry saved"); break;
      case "mark-paid": r = findRes(id);
        openModal("Mark " + firstName(r.name) + " as paid", '<div class="form-grid">' +
          field(lbl("mmethod", "Paid with"), '<select class="input" id="mmethod" name="method">' + ["gcash", "card", "qrph", "bank", "cash"].map(function (k) { return opt(k, METHOD[k], r.method); }).join("") + "</select>") +
          field(lbl("mref", "Reference number"), '<input class="input" id="mref" name="ref" placeholder="From the payment receipt">') + "</div>" +
          '<p class="muted" style="margin:0">PayMongo payments are marked as paid automatically. Use this for cash, bank transfers or anything paid outside the checkout. The Zoom link is then emailed to ' + esc(r.email) + ".</p>",
          { submit: "Confirm payment · " + peso(r.amount), onSubmit: function (f) {
            act(PT.admin.updateReservation(r.id, { status: "paid", method: f.method, ref: f.ref.trim(), paid_at: new Date().toISOString() }, "Payment confirmed · " + METHOD[f.method] + (f.ref.trim() ? " (ref " + f.ref.trim() + ")" : ""))
              .then(function () { return emailZoom(r.id); })
              .then(function (zr) { return r.addon_hub ? grantHub(r).then(function (hr) { zr.hub = hr; return zr; }) : zr; }),
              function (res) { var m = emailNote(res, "Marked as paid"); return res.hub ? hubNote(res.hub, m) : m; });
          } });
        break;
      case "send-zoom": r = findRes(id);
        if (r.zoom_email_sent_at) {
          openModal("Resend the Zoom link?", '<p style="margin:0">' + esc(firstName(r.name)) + " already got it on " + esc(fmtDT(r.zoom_email_sent_at)) + ". Send it again to <b>" + esc(r.email) + "</b>?</p>",
            { submit: "Resend email", onSubmit: function () { act(emailZoom(r.id), function (res) { return emailNote(res); }); } });
        } else { toast("Sending…"); act(emailZoom(r.id), function (res) { return emailNote(res); }); }
        break;
      case "msg-reminder": messageModal(findRes(id), "reminder"); break;
      case "msg-details": messageModal(findRes(id), "details"); break;
      case "cancel-res": r = findRes(id);
        openModal("Cancel " + r.name + "’s reservation?", '<p style="margin:0">Their seat goes back to the batch. They haven’t paid, so there’s nothing to refund.</p>' + field(lbl("creason", "Reason (optional)"), '<input class="input" id="creason" name="reason" placeholder="e.g. No payment after reminder">'),
          { submit: "Cancel reservation", danger: true, onSubmit: function (f) { act(PT.admin.updateReservation(r.id, { status: "cancelled" }, "Reservation cancelled" + (f.reason.trim() ? ": " + f.reason.trim() : "")), "Reservation cancelled"); } });
        break;
      case "move-res": r = findRes(id);
        var targets = upcoming().filter(function (s) { return s.id !== r.session_id && (s.status === "open" || s.status === "draft"); });
        if (!targets.length) { toast("Create another batch first"); break; }
        openModal("Move " + firstName(r.name) + " to another batch", field(lbl("mto", "New batch"), '<select class="input" id="mto" name="to">' + targets.map(function (s) { var st = stats(s); return opt(s.id, s.code + " · " + fmtDate(s.date) + " · " + st.left + " seats left", ""); }).join("") + "</select>") +
          (r.status === "refund_requested" ? '<p class="muted" style="margin:0">Their refund request will be closed and the payment kept for the new batch.</p>' : ""),
          { submit: "Move participant", onSubmit: function (f) {
            var to = sess(f.to), from = sess(r.session_id);
            if (stats(to).left < 1) throw new Error(to.code + " is full.");
            act(PT.admin.updateReservation(r.id, { session_id: to.id, status: r.status === "refund_requested" ? "paid" : r.status }, "Moved from " + (from ? from.code : "?") + " to " + to.code), "Moved to " + to.code).then(function () { S.p.batch = to.id; S.p.sel = r.id; render(); });
          } });
        break;
      case "req-refund": r = findRes(id);
        openModal("Record a refund request", field(lbl("rreason", "Reason they gave"), '<textarea class="input" id="rreason" name="reason" rows="3" placeholder="e.g. Schedule conflict"></textarea>'),
          { submit: "Record request", onSubmit: function (f) { act(PT.admin.updateReservation(r.id, { status: "refund_requested", refund_reason: f.reason.trim() }, "Refund requested" + (f.reason.trim() ? ": " + f.reason.trim() : "")), "Refund request recorded"); } });
        break;
      case "approve-refund": r = findRes(id);
        openModal("Approve refund of " + peso(r.amount) + "?", '<div class="callout info">First send the money back through ' + esc(METHOD[r.method] || "your payment provider") + ", then confirm here. This frees their seat.</div>" +
          field(lbl("rref", "Refund reference (optional)"), '<input class="input" id="rref" name="ref" placeholder="Refund transaction number">'),
          { submit: "Confirm refund", onSubmit: function (f) { act(PT.admin.updateReservation(r.id, { status: "refunded" }, "Refund approved · " + peso(r.amount) + " returned via " + (METHOD[r.method] || r.method) + (f.ref.trim() ? " (ref " + f.ref.trim() + ")" : "")), "Refund approved"); } });
        break;
      case "decline-refund": r = findRes(id);
        openModal("Decline refund request", '<p style="margin:0">' + esc(r.name) + " keeps their seat. Tell them why before you decline.</p>" + field(lbl("dreason", "Reason"), '<textarea class="input" id="dreason" name="reason" rows="3" placeholder="e.g. Requested after the 7-day window"></textarea>'),
          { submit: "Decline refund", danger: true, onSubmit: function (f) { if (!f.reason.trim()) throw new Error("Add a reason so your team knows why."); act(PT.admin.updateReservation(r.id, { status: "paid" }, "Refund declined: " + f.reason.trim()), "Refund declined"); } });
        break;
      case "restore-res": r = findRes(id);
        if (stats(sess(r.session_id)).left < 1) { toast("This batch is full"); break; }
        act(PT.admin.updateReservation(r.id, { status: "pending", paid_at: null }, "Restored as pending"), "Restored");
        break;
      case "add-res":
        var opts = D().sessions.filter(function (s) { return daysUntil(s.date) >= 0 && s.status !== "done"; });
        if (!opts.length) { toast("Create an upcoming batch first"); break; }
        openModal("Add participant", '<div class="form-grid">' +
          '<div class="span2">' + field(lbl("aname", "Full name"), '<input class="input" id="aname" name="name" autocomplete="off" required>') + "</div>" +
          field(lbl("aemail", "Email"), '<input class="input" id="aemail" name="email" type="email" required>') +
          field(lbl("aphone", "Mobile number"), '<input class="input" id="aphone" name="phone" inputmode="numeric" placeholder="917 123 4567" required>') +
          field(lbl("abatch", "Batch"), '<select class="input" id="abatch" name="session_id">' + opts.map(function (s) { return opt(s.id, s.code + " · " + fmtDay(parseYmd(s.date)) + " · " + stats(s).left + " left", S.p.batch); }).join("") + "</select>") +
          field(lbl("amethod", "Payment method"), '<select class="input" id="amethod" name="method">' + ["gcash", "card", "qrph", "bank", "cash"].map(function (k) { return opt(k, METHOD[k], "gcash"); }).join("") + "</select>") +
          field(lbl("astatus", "Payment status"), '<select class="input" id="astatus" name="status">' + opt("paid", "Already paid", "paid") + opt("pending", "Not paid yet", "") + "</select>") +
          field(lbl("aref", "Reference number"), '<input class="input" id="aref" name="ref">') +
          '<div class="span2">' + field(lbl("asource", "How they found us"), '<select class="input" id="asource" name="source">' + ["Walk-in", "Referral", "Facebook", "Instagram", "TikTok", "Website", "Other"].map(function (k) { return opt(k, k, "Referral"); }).join("") + "</select>") + "</div></div>",
          { submit: "Add participant", onSubmit: function (f) {
            if (stats(sess(f.session_id)).left < 1) throw new Error("That batch is full.");
            act(PT.admin.addReservation(f).then(function (row) {
              S.p.batch = row.session_id; S.p.sel = row.id; S.p.tab = "all";
              return row.status === "paid" ? emailZoom(row.id) : null;
            }), function (res) { return res ? emailNote(res, "Participant added") : "Participant added"; });
          } });
        break;
      case "htab": S.h.tab = id; S.h.sel = null; render(); break;
      case "hview": S.h.view = id; render(); break;
      case "course-new": courseForm(null); break;
      case "course-edit": courseForm(hubContent("courses").filter(function (x) { return x.id === id; })[0]); break;
      case "lesson-new":
        if (!hubContent("courses").length) { toast("Create a course first"); break; }
        lessonForm(null, id || hubContent("courses")[0].id); break;
      case "lesson-edit": lessonForm(hubContent("lessons").filter(function (x) { return x.id === id; })[0]); break;
      case "replay-new": replayForm(null); break;
      case "replay-edit": replayForm(hubContent("replays").filter(function (x) { return x.id === id; })[0]); break;
      case "prompt-new": promptForm(null); break;
      case "prompt-edit": promptForm(hubContent("prompts").filter(function (x) { return x.id === id; })[0]); break;
      case "content-del":
        var tbl = t.getAttribute("data-table"), item = hubContent(tbl).filter(function (x) { return x.id === id; })[0];
        if (!item) break;
        var what = { courses: "course", lessons: "lesson", replays: "replay", prompts: "prompt" }[tbl];
        var extra = tbl === "courses" ? hubContent("lessons").filter(function (l) { return l.course_id === id; }).length : 0;
        openModal("Delete this " + what + "?", '<p style="margin:0"><b>' + esc(item.title) + "</b> will be removed from the hub" + (extra ? ", together with its " + extra + (extra === 1 ? " lesson" : " lessons") : "") + ". This can't be undone. To hide it instead, edit it and untick Published.</p>",
          { submit: "Delete " + what, danger: true, onSubmit: function () { act(PT.admin.removeContent(tbl, id), what.charAt(0).toUpperCase() + what.slice(1) + " deleted"); } });
        break;
      case "hsel": S.h.sel = id; render(); break;
      case "hub-add":
        openModal("Add a Builder Hub member", '<div class="form-grid">' +
          '<div class="span2">' + field(lbl("hname", "Full name"), '<input class="input" id="hname" name="name" autocomplete="off" required>') + "</div>" +
          '<div class="span2">' + field(lbl("hemail", "Email"), '<input class="input" id="hemail" name="email" type="email" autocomplete="off" required>', "They'll get a “set your password” email right away.") + "</div>" +
          field(lbl("hmonths", "Access length (months)"), '<input class="input" id="hmonths" name="months" type="number" min="1" max="60" value="' + esc(hubOffer().months || 12) + '">') +
          field(lbl("hlang", "Email language"), '<select class="input" id="hlang" name="lang">' + opt("en", "English", "en") + opt("tl", "Tagalog", "") + opt("ceb", "Bisaya", "") + "</select>") + "</div>",
          { submit: "Add member", onSubmit: function (f) {
            if (!f.name.trim()) throw new Error("Enter their name.");
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) throw new Error("Enter a valid email.");
            act(PT.admin.hub("grant", { email: f.email.trim(), name: f.name.trim(), months: f.months, lang: f.lang }).then(function (x) { if (x && x.member) S.h.sel = x.member.user_id; S.h.tab = "active"; return x; }),
              function (x) { return x && x.emailed === false ? "Member added · email failed: " + (x.message || "check email settings") : "Member added · access email sent"; });
          } });
        break;
      case "hub-resend":
        act(PT.admin.hub("resend", { user_id: id }), "“Set password” email sent");
        break;
      case "hub-extend":
        openModal("Extend access", field(lbl("xmonths", "Add how many months?"), '<input class="input" id="xmonths" name="months" type="number" min="1" max="60" value="12">', "Added to their current end date, or from today if it already ended."),
          { submit: "Extend access", onSubmit: function (f) { act(PT.admin.hub("extend", { user_id: id, months: f.months }), "Access extended"); } });
        break;
      case "hub-revoke":
        openModal("End Builder Hub access now?", '<p style="margin:0">They will be signed out of the hub and see an “access ended” message. You can extend their access again later.</p>',
          { submit: "End access", danger: true, onSubmit: function () { act(PT.admin.hub("revoke", { user_id: id }), "Access ended"); } });
        break;
      case "hub-grant": r = findRes(id);
        toast("Creating Builder Hub access…");
        act(grantHub(r), function (x) { return hubNote(x); });
        break;
      case "pm-refresh": S.pm = null; render(); break;
      case "pm-connect":
        t.disabled = true; t.textContent = "Connecting…";
        PT.admin.paymongo("connect").then(function (st) { S.pm = st; render(); toast(st.connected ? "PayMongo connected" : "Not connected yet"); },
          function (e) { t.disabled = false; t.textContent = "Connect PayMongo"; toast(e.message || "Couldn't connect PayMongo"); });
        break;
      case "reset-demo":
        openModal("Reset demo data?", '<p style="margin:0">This replaces everything in demo mode with fresh sample data, including test reservations you made on the checkout page.</p>',
          { submit: "Reset demo data", danger: true, onSubmit: function () { act(PT.admin.resetDemo(), "Demo data reset"); } });
        break;
    }
  });
  // modal buttons live in the <dialog>, which is inside #app
  document.addEventListener("click", function (e) {
    var t = e.target.closest("#modal [data-act]"); if (!t) return;
    var a = t.getAttribute("data-act"), text = (document.getElementById("mtext") || {}).value || "";
    if (a === "msg-copy") { e.preventDefault(); copyText(text, "Message copied"); }
    if (a === "msg-email") { e.preventDefault(); location.href = "mailto:" + t.getAttribute("data-to") + "?subject=" + encodeURIComponent(t.getAttribute("data-subject")) + "&body=" + encodeURIComponent(text); }
    if (a === "msg-sms") { e.preventDefault(); location.href = "sms:" + t.getAttribute("data-to") + "?&body=" + encodeURIComponent(text); }
  }, true);
  app.addEventListener("input", function (e) {
    var m = e.target.getAttribute && e.target.getAttribute("data-model"); if (!m) return;
    var p = m.split("."); S[p[0]][p[1]] = e.target.value;
    if (m === "p.q") S.p.sel = null;
    render();
  });
  app.addEventListener("change", function (e) {
    var m = e.target.getAttribute && e.target.getAttribute("data-model"); if (!m || e.target.tagName !== "SELECT") return;
    var p = m.split("."); S[p[0]][p[1]] = e.target.value;
    if (m === "p.batch") { S.p.sel = null; S.p.tab = "all"; }
    render();
  });
  app.addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-form]"); if (!f) return;
    e.preventDefault();
    if (f.getAttribute("data-form") === "hub") {
      var price = parseInt(f.elements.price.value, 10), cmp = parseInt(f.elements.compare_at.value, 10) || 0, mo = parseInt(f.elements.months.value, 10);
      if (!(price >= 1)) { toast("Enter a price of at least ₱1"); return; }
      if (!(mo >= 1 && mo <= 60)) { toast("Access length must be 1 to 60 months"); return; }
      if (cmp && cmp <= price) { toast("The regular price should be higher than the offer price"); return; }
      act(PT.admin.saveSettings({ hub_offer: { enabled: f.elements.enabled.checked, price: price, compare_at: cmp, months: mo } }), "Builder Hub offer saved");
      return;
    }
    if (f.getAttribute("data-form") === "payments") {
      var links = {}, bad = null;
      ["all", "gcash", "card", "qrph"].forEach(function (k) { var v = f.elements[k].value.trim(); if (v && !/^https:\/\/\S+$/.test(v)) bad = k; links[k] = v; });
      if (bad) { toast("Payment links must start with https://"); f.elements[bad].focus(); return; }
      act(PT.admin.saveSettings({ payment_links: links }), "Payment links saved");
    } else {
      var hold = parseInt(f.elements.hold_hours.value, 10), days = parseInt(f.elements.refund_days.value, 10);
      if (!(hold >= 1) || !(days >= 0)) { toast("Enter whole numbers for hours and days"); return; }
      var bonuses = f.elements.bonuses.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 10);
      act(PT.admin.saveSettings({ hold_hours: hold, refund_days: days, bonuses: bonuses }), "Rules saved");
    }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.menu) { S.menu = false; render(); } });

  /* -------------------------------------------------------------- start */
  readRoute();
  PT.ready().then(function () { return PT.auth.user(); }).then(function (u) {
    S.user = u;
    if (!u) return renderLogin();
    return reload();
  }).catch(function (e) { app.innerHTML = '<div class="loading">' + esc(e.message || "Couldn't start the admin.") + "</div>"; });
})();
