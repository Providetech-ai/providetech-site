/*
  PROVIDETECH data layer
  ----------------------
  One small API used by the homepage, the checkout page and /admin.

  - DEMO MODE (no Supabase keys in assets/config.js): data lives in this
    browser's localStorage, seeded with sample workshops, participants and
    inquiries so every screen has something to show.
  - LIVE MODE (keys filled in): data lives in your Supabase database and the
    rules in supabase/schema.sql protect it. Visitors can only list open
    workshops, reserve a seat and send an inquiry; only signed-in admins can
    read or change anything else.

  Every function returns a Promise, so pages work the same in both modes.
*/
(function () {
  "use strict";
  var CFG = window.PROVIDETECH_CONFIG || {};
  var LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  var SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";

  var DEFAULT_SETTINGS = {
    org_name: "PROVIDETECH AI ASSISTANCE",
    payment_links: { all: "https://pm.link/ProvideTech/k1aTE93", gcash: "", card: "", qrph: "" },   // PayMongo payment link (₱999)
    hold_hours: 1,
    hub_offer: { enabled: true, price: 1999, compare_at: 11997, months: 12 },
    refund_days: 7,
    bonuses: [
      "[Bonus 1 — e.g. session replay]",
      "[Bonus 2 — e.g. templates or prompt pack]",
      "[Bonus 3 — e.g. community access]"
    ]
  };
  var PUBLIC_SETTING_KEYS = ["payment_links", "bonuses", "hold_hours", "refund_days", "hub_offer"];
  var ACTIVE = { pending: 1, paid: 1, refund_requested: 1 };

  /* ---------- small helpers ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function nowIso() { return new Date().toISOString(); }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function todayYmd() { return ymd(new Date()); }
  function cleanText(v, max) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max || 500); }
  function cleanPhone(v) {
    v = String(v || "").replace(/\D/g, "");
    if (v.indexOf("63") === 0) v = v.slice(2);
    if (v.charAt(0) === "0") v = v.slice(1);
    return v;
  }
  function fail(code, message) { var e = new Error(message || code); e.code = code; return e; }
  function validReservation(r) {
    if (cleanText(r.name).split(" ").filter(Boolean).length < 2) throw fail("NAME", "Enter a full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanText(r.email))) throw fail("EMAIL", "Enter a valid email address.");
    if (!/^9\d{9}$/.test(cleanPhone(r.phone))) throw fail("PHONE", "Enter a 10-digit PH mobile number.");
  }

  /* =====================================================================
     DEMO DRIVER — localStorage
     ===================================================================== */
  var STORE_KEY = "pt-demo-v3";

  function seed() {
    var today = new Date(); today.setHours(9, 0, 0, 0);
    var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(20261006);
    var first = ["Maria", "Paolo", "Angela", "Kristine", "Jerome", "Bea", "Carlo", "Liza", "Ramon", "Joy", "Miguel", "Andrea", "Jasmine", "Rafael", "Camille", "Nico", "Patricia", "Gabriel", "Hannah", "Enzo", "Trisha", "Marco", "Danica", "Kevin", "Alyssa", "Joshua", "Ella", "Vincent", "Rica", "Adrian", "Isabel", "Francis", "Mae", "Leo"];
    var last = ["Santos", "Reyes", "Cruz", "Lim", "Dela Cruz", "Mendoza", "Tan", "Bautista", "Aquino", "Navarro", "Garcia", "Ramos", "Villanueva", "Castillo", "Flores", "Gonzales", "Torres", "Domingo", "Soriano", "Manalo", "Pascual", "Salazar", "Valdez", "Ocampo"];
    var sources = ["Facebook", "Website", "Website", "Facebook", "Referral", "Instagram", "TikTok"];
    function method() { var x = rnd(); return x < 0.58 ? "gcash" : x < 0.84 ? "card" : "qrph"; }
    function phone() { var p = ["917", "918", "905", "927", "916", "939", "908", "945", "926", "995"][Math.floor(rnd() * 10)]; return p + String(1000000 + Math.floor(rnd() * 8999999)); }
    function ref(m) { return ({ gcash: "GC", card: "CARD", qrph: "QR" })[m] + "-" + String(100000 + Math.floor(rnd() * 899999)); }
    function at(daysAgo, hour, min) { var d = addDays(today, -daysAgo); d.setHours(hour, min, 0, 0); return d.toISOString(); }

    var s06 = { id: "batch-06", code: "Batch 06", title: "AI Business Systems Workshop", date: ymd(addDays(today, -17)), time_label: "9:00 AM – 5:00 PM", venue: "Online via Zoom", capacity: 30, price: 999, status: "done", created_at: at(60, 10, 0) };
    var s07 = { id: "batch-07", code: "Batch 07", title: "AI Business Systems Workshop", date: ymd(addDays(today, 11)), time_label: "9:00 AM – 5:00 PM", venue: "Online via Zoom", zoom_link: "https://zoom.us/j/0000000000?pwd=demo", zoom_notes: "Meeting ID: 000 000 0000 · Passcode: demo", capacity: 30, price: 999, status: "open", created_at: at(30, 10, 0) };
    var s09 = { id: "f2f-01", code: "F2F 01", title: "Face-to-Face AI Workshop", format: "f2f", date: ymd(addDays(today, 18)), time_label: "9:00 AM – 5:00 PM", venue: "Cebu City (exact venue TBA)", capacity: 15, price: 5999, status: "open", created_at: at(5, 10, 0) };
    var s10 = { id: "one-on-one", code: "1-on-1", title: "1-on-1 Coaching (Door-to-Door)", format: "home", date: "2099-12-31", time_label: "", venue: "Your home or office", capacity: 30, price: 9999, status: "open", created_at: at(5, 10, 0) };
    var s11 = { id: "builder-hub", code: "Builder Hub", title: "PROVIDETECH Builder Hub (1 year)", format: "hub", date: "2099-12-31", time_label: "", venue: "", capacity: 100000, price: 0, status: "open", created_at: at(5, 10, 0) };
    var s08 = { id: "batch-08", code: "Batch 08", title: "AI Business Systems Workshop", date: ymd(addDays(today, 39)), time_label: "9:00 AM – 5:00 PM", venue: "", capacity: 30, price: 999, status: "draft", created_at: at(2, 10, 0) };

    var reservations = [], n = 0;
    function person(i) { return { name: first[i % first.length] + " " + last[(i * 7 + 3) % last.length] }; }
    function emailOf(name) { return name.toLowerCase().replace(/[^a-z ]/g, "").replace(/ /g, ".") + "@example.com"; }
    function add(session, name, status, daysAgo, hour, min, extra) {
      var m = (extra && extra.method) || method();
      var created = at(daysAgo, hour, min);
      var r = {
        id: "r-" + (++n), session_id: session.id, name: name, email: emailOf(name), phone: phone(), method: m,
        status: status, source: (extra && extra.source) || sources[Math.floor(rnd() * sources.length)],
        ref: status === "pending" ? "" : ref(m), amount: session.price, notes: "", refund_reason: (extra && extra.reason) || "",
        created_at: created, paid_at: status === "pending" ? null : created, lang: "en", zoom_email_sent_at: status === "pending" ? null : created,
        history: [{ at: created, text: "Seat reserved on website" }]
      };
      if (status !== "pending") r.history.push({ at: created, text: "Payment confirmed · " + ({ gcash: "GCash", card: "Credit Card", qrph: "QR Ph (bank)" })[m] }, { at: created, text: "Zoom link emailed to " + r.email });
      if (status === "refund_requested") r.history.push({ at: at(Math.max(daysAgo - 2, 0), 18, 5), text: "Refund requested: " + r.refund_reason });
      reservations.push(r);
    }
    // Batch 06 — finished workshop, 30 paid seats spread over 5–6 weeks ago
    for (var i = 0; i < 30; i++) add(s06, person(i + 10).name, "paid", 18 + Math.floor(i * 0.9), 8 + (i % 12), (i * 17) % 60);
    // Batch 07 — upcoming, 23 reservations: 18 paid, 3 pending, 2 refund requested
    var b7 = [
      ["Maria Santos", "paid", 0, 10, 42, { method: "gcash", source: "Facebook" }],
      ["Paolo Reyes", "paid", 0, 9, 15, { method: "card", source: "Website" }],
      ["Angela Cruz", "pending", 1, 16, 8, { method: "qrph", source: "Referral" }],
      ["Kristine Lim", "refund_requested", 2, 20, 30, { method: "gcash", source: "Facebook", reason: "Schedule conflict on the workshop date" }],
      ["Jerome Dela Cruz", "paid", 3, 13, 12, { method: "gcash" }],
      ["Bea Mendoza", "paid", 4, 19, 45, { method: "card" }],
      ["Carlo Tan", "pending", 4, 11, 20, { method: "gcash" }],
      ["Liza Bautista", "paid", 6, 18, 2, { method: "qrph" }],
      ["Ramon Aquino", "refund_requested", 6, 9, 40, { method: "gcash", reason: "Company training budget was moved" }],
      ["Joy Navarro", "paid", 8, 15, 27, { method: "card" }],
      ["Miguel Garcia", "pending", 0, 8, 5, { method: "gcash" }]
    ];
    b7.forEach(function (x) { add(s07, x[0], x[1], x[2], x[3], x[4], x[5]); });
    for (var j = 0; j < 12; j++) add(s07, person(j + 44).name, "paid", 1 + Math.floor(j * 1.2), 8 + (j % 11), (j * 23) % 60);

    var inquiries = [
      { id: "q-1", name: "Rodel Reyes", business: "Reyes Mart", email: "rodel@reyesmart.example.com", phone: "9171230011", need: "Inventory & sales system", message: "We have 3 branches and track stock in Excel. Need one system for inventory and daily sales.", source: "Discuss Your Business Idea", status: "new", notes: "", created_at: at(1, 7, 10) },
      { id: "q-2", name: "Aileen Mendoza", business: "Mendoza Hardware", email: "aileen@mendozahw.example.com", phone: "9285550142", need: "Custom operations dashboard", message: "Looking for a dashboard for sales, suppliers and receivables.", source: "Talk to Our Team", status: "new", notes: "", created_at: at(0, 8, 40) },
      { id: "q-3", name: "Lourdes Pascual", business: "Casa Lourdes Bakery", email: "orders@casalourdes.example.com", phone: "9054447781", need: "Orders & inventory", message: "Pre-orders come through Messenger and we lose track. Can you help?", source: "Talk to Our Team", status: "new", notes: "", created_at: at(0, 11, 5) },
      { id: "q-4", name: "Dr. Carla Lumen", business: "Lumen Clinic", email: "admin@lumenclinic.example.com", phone: "9178882231", need: "Appointment & patient workflow", message: "Booking is done by phone and paper. Want online booking and reminders.", source: "Talk to Our Team", status: "contacted", notes: "Call scheduled Thursday 2 PM.", created_at: at(2, 14, 20) },
      { id: "q-5", name: "Ana Bayan", business: "Bayan Tutorials", email: "ana@bayantutorials.example.com", phone: "9391112045", need: "Student, schedule & payment management", message: "Two branches, 180 students. Need schedules and payment tracking.", source: "Discuss Your Business Idea", status: "proposal", notes: "Proposal sent. Follow up next week.", created_at: at(6, 10, 0) },
      { id: "q-6", name: "Jun Ocampo", business: "Northpoint Realty", email: "jun@northpoint.example.com", phone: "9269990321", need: "Property & lead management", message: "Agents track leads in personal notebooks.", source: "Discuss Your Business Idea", status: "won", notes: "Project started.", created_at: at(21, 9, 30) }
    ];
    return { v: 1, sessions: [s06, s07, s08, s09, s10, s11], reservations: reservations, inquiries: inquiries, settings: clone(DEFAULT_SETTINGS) };
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (raw) {
      try {
        var d = JSON.parse(raw);
        if (d && d.v === 1) {
          var pl = d.settings && d.settings.payment_links;
          if (!pl || !(pl.all || pl.card || pl.gcash || pl.qrph)) { d.settings.payment_links = clone(DEFAULT_SETTINGS.payment_links); save(d); }
          Object.keys(DEFAULT_SETTINGS).forEach(function (k) { if (d.settings[k] === undefined) d.settings[k] = clone(DEFAULT_SETTINGS[k]); });
          return d;
        }
      } catch (e) {}
    }
    var s = seed(); save(s); return s;
  }
  function save(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {} }
  function later(v) { return new Promise(function (res) { setTimeout(function () { res(clone(v)); }, 60); }); }
  function rejectLater(e) { return new Promise(function (_, rej) { setTimeout(function () { rej(e); }, 60); }); }
  function hubAddonPrice(d, want) {
    var o = d.settings && d.settings.hub_offer;
    return want && o && o.enabled ? Math.max(0, Number(o.price) || 0) : 0;
  }
  // Seats in use: paid, refund requested, or unpaid but still inside the seat hold
  function activeCount(d, sessionId) {
    var holdMs = (Number(d.settings && d.settings.hold_hours) || 1) * 3600000, now = Date.now();
    return d.reservations.filter(function (r) {
      if (r.session_id !== sessionId) return false;
      if (r.status === "paid" || r.status === "refund_requested") return true;
      return r.status === "pending" && (r.hold_until ? new Date(r.hold_until).getTime() : new Date(r.created_at).getTime() + holdMs) > now;
    }).length;
  }

  function cleanLang(l) {
    l = String(l || "").toLowerCase();
    if (!l) { try { l = localStorage.getItem("pt-lang") || document.documentElement.lang || "en"; } catch (e) { l = "en"; } }
    if (l === "fil" || l === "tl") return "tl";
    if (l === "ceb") return "ceb";
    return "en";
  }
  function cleanFormat(f) { return ["online", "f2f", "home", "hub"].indexOf(f) >= 0 ? f : "online"; }
  function cleanZoom(u) { u = String(u || "").trim(); return /^https:\/\/\S+$/.test(u) ? u.slice(0, 500) : ""; }

  var demo = {
    mode: "demo",
    ready: function () { return Promise.resolve(); },
    publicSessions: function () {
      var d = load(), t = todayYmd();
      return later(d.sessions.filter(function (s) { return s.status === "open" && s.date >= t; })
        .sort(function (a, b) { return a.date < b.date ? -1 : 1; })
        .map(function (s) { var x = clone(s); x.seats_left = Math.max(0, s.capacity - activeCount(d, s.id)); return x; }));
    },
    publicSettings: function () {
      var d = load(), out = {};
      PUBLIC_SETTING_KEYS.forEach(function (k) { out[k] = d.settings[k]; });
      return later(out);
    },
    reserveSeat: function (r) {
      try { validReservation(r); } catch (e) { return rejectLater(e); }
      var d = load();
      var s = d.sessions.filter(function (x) { return x.id === r.session_id; })[0];
      if (!s || s.status !== "open") return rejectLater(fail("CLOSED", "This session is no longer open for reservations."));
      var prev = d.reservations.filter(function (x) { return x.session_id === s.id && ACTIVE[x.status] && String(x.email).toLowerCase() === cleanText(r.email, 200).toLowerCase(); })[0];
      if (prev && prev.status === "pending" && prev.phone === cleanPhone(r.phone)) {
        var ap = hubAddonPrice(d, r.addon);
        prev.method = r.method; prev.lang = cleanLang(r.lang); if (s.format === "home") { prev.address = cleanText(r.address, 300); prev.schedule_pref = cleanText(r.schedule_pref, 300); } prev.addon_hub = ap > 0; prev.addon_amount = ap; prev.amount = s.price + ap;
        prev.history.push({ at: nowIso(), text: "Came back to finish payment" + (ap ? " · with Builder Hub" : "") }); save(d);
        return later({ id: prev.id });
      }
      if (prev) return rejectLater(fail("DUPLICATE", "This email already has a seat in this session."));
      if (activeCount(d, s.id) >= s.capacity) return rejectLater(fail("FULL", "This session is full."));
      if (["gcash", "card", "qrph"].indexOf(r.method) < 0) return rejectLater(fail("METHOD", "Choose a payment method."));
      var home = s.format === "home", addr = home ? cleanText(r.address, 300) : "", pref = home ? cleanText(r.schedule_pref, 300) : "";
      if (home && addr.length < 8) return rejectLater(fail("ADDRESS", "Please enter the full address where we'll visit you."));
      var created = nowIso();
      var row = {
        id: uid(), session_id: s.id, name: cleanText(r.name, 120), email: cleanText(r.email, 200).toLowerCase(), phone: cleanPhone(r.phone),
        method: r.method, status: "pending", source: cleanText(r.source || "Website", 60), ref: "", amount: s.price + hubAddonPrice(d, r.addon), notes: "",
        addon_hub: hubAddonPrice(d, r.addon) > 0, addon_amount: hubAddonPrice(d, r.addon), hold_until: new Date(Date.now() + (Number(d.settings.hold_hours) || 1) * 3600000).toISOString(),
        refund_reason: "", lang: cleanLang(r.lang), address: addr, schedule_pref: pref, zoom_email_sent_at: null, created_at: created, paid_at: null, history: [{ at: created, text: home ? "1-on-1 coaching booked on website" : "Seat reserved on website" }]
      };
      d.reservations.push(row); save(d);
      return later({ id: row.id });
    },
    // Mix and match: several bookings (or just the Builder Hub) paid in one checkout → { order_id, ids }
    reserveOrder: function (o) {
      var self = this, items = (o.items || []).slice(0, 3), order = uid(), ids = [];
      if (!items.length) {
        if (!o.addon) return rejectLater(fail("EMPTY", "Choose at least one item."));
        var hub = load().sessions.filter(function (x) { return x.format === "hub" && x.status === "open"; })[0];
        if (!hub) return rejectLater(fail("CLOSED", "The Builder Hub isn't available right now."));
        items = [{ session_id: hub.id }];
      }
      var chain = Promise.resolve();
      items.forEach(function (it, k) {
        chain = chain.then(function () {
          return self.reserveSeat({ session_id: it.session_id, name: o.name, email: o.email, phone: o.phone, method: o.method, source: o.source, lang: o.lang,
            addon: !!o.addon && k === 0, address: it.address, schedule_pref: it.schedule_pref }).then(function (r) { ids.push(r.id); });
        });
      });
      return chain.then(function () {
        var d = load(); d.reservations.forEach(function (r) { if (ids.indexOf(r.id) >= 0) r.order_id = order; }); save(d);
        return { order_id: order, ids: ids };
      });
    },
    startPayment: function () { return rejectLater(fail("PAYMENTS_NOT_CONFIGURED", "Demo mode uses the payment link.")); },
    submitInquiry: function (q) {
      var name = cleanText(q.name, 120), contact = cleanText(q.email, 200) || cleanText(q.phone, 40);
      if (name.length < 2) return rejectLater(fail("NAME", "Enter your name."));
      if (!contact) return rejectLater(fail("CONTACT", "Enter an email or mobile number."));
      var d = load();
      var row = { id: uid(), name: name, business: cleanText(q.business, 160), email: cleanText(q.email, 200).toLowerCase(), phone: cleanPhone(q.phone),
        need: cleanText(q.need, 160), message: String(q.message || "").trim().slice(0, 2000), source: cleanText(q.source || "Website", 60), status: "new", notes: "", created_at: nowIso() };
      d.inquiries.push(row); save(d);
      return later({ id: row.id });
    },
    auth: {
      demoEmail: "admin@providetech.demo",
      demoPassword: "demo1234",
      user: function () { var u = null; try { u = JSON.parse(sessionStorage.getItem("pt-demo-user") || "null"); } catch (e) {} return Promise.resolve(u); },
      signIn: function (email, password) {
        if (String(email).trim().toLowerCase() === "admin@providetech.demo" && password === "demo1234") {
          var u = { email: "admin@providetech.demo", name: "Demo Admin" };
          try { sessionStorage.setItem("pt-demo-user", JSON.stringify(u)); } catch (e) {}
          return later(u);
        }
        return rejectLater(fail("AUTH", "That email and password don't match."));
      },
      signOut: function () { try { sessionStorage.removeItem("pt-demo-user"); } catch (e) {} return Promise.resolve(); }
    },
    admin: {
      all: function () { return later(load()); },
      saveSession: function (s) {
        var d = load(), i = -1;
        d.sessions.forEach(function (x, k) { if (x.id === s.id) i = k; });
        var row = { id: s.id || uid(), code: cleanText(s.code, 60), title: cleanText(s.title, 160), format: cleanFormat(s.format), date: s.date, time_label: cleanText(s.time_label, 80),
          venue: cleanText(s.venue, 200), zoom_link: cleanZoom(s.zoom_link), zoom_notes: String(s.zoom_notes || "").trim().slice(0, 1000),
          capacity: Math.max(1, parseInt(s.capacity, 10) || 1), price: Math.max(0, parseInt(s.price, 10) || 0), status: s.status,
          created_at: i >= 0 ? d.sessions[i].created_at : nowIso() };
        if (i >= 0) d.sessions[i] = row; else d.sessions.push(row);
        save(d); return later(row);
      },
      updateReservation: function (id, patch, note) {
        var d = load(), r = d.reservations.filter(function (x) { return x.id === id; })[0];
        if (!r) return rejectLater(fail("NOT_FOUND", "Reservation not found."));
        Object.keys(patch).forEach(function (k) { r[k] = patch[k]; });
        if (note) r.history.push({ at: nowIso(), text: note });
        save(d); return later(r);
      },
      addReservation: function (r) {
        var d = load(), s = d.sessions.filter(function (x) { return x.id === r.session_id; })[0];
        if (!s) return rejectLater(fail("SESSION", "Choose a batch."));
        try { validReservation(r); } catch (e) { return rejectLater(e); }
        var created = nowIso(), paid = r.status === "paid";
        var row = { id: uid(), session_id: s.id, name: cleanText(r.name, 120), email: cleanText(r.email, 200).toLowerCase(), phone: cleanPhone(r.phone), method: r.method,
          status: r.status, source: cleanText(r.source || "Added by admin", 60), ref: cleanText(r.ref, 80), amount: s.price, notes: cleanText(r.notes, 1000), refund_reason: "", lang: cleanLang(r.lang || "en"), zoom_email_sent_at: null,
          created_at: created, paid_at: paid ? created : null, history: [{ at: created, text: "Added by admin" + (paid ? " · marked as paid" : "") }] };
        d.reservations.push(row); save(d); return later(row);
      },
      updateInquiry: function (id, patch) {
        var d = load(), q = d.inquiries.filter(function (x) { return x.id === id; })[0];
        if (!q) return rejectLater(fail("NOT_FOUND", "Inquiry not found."));
        Object.keys(patch).forEach(function (k) { q[k] = patch[k]; });
        save(d); return later(q);
      },
      saveSettings: function (patch) {
        var d = load();
        Object.keys(patch).forEach(function (k) { d.settings[k] = patch[k]; });
        save(d); return later(d.settings);
      },
      sendZoomEmail: function (id) {
        var d = load(), r = d.reservations.filter(function (x) { return x.id === id; })[0];
        if (!r) return rejectLater(fail("NOT_FOUND", "Reservation not found."));
        var s = d.sessions.filter(function (x) { return x.id === r.session_id; })[0] || {};
        if (r.status !== "paid") return rejectLater(fail("NOT_PAID", "The Zoom link is only sent to paid participants."));
        if (cleanFormat(s.format) === "online" && !cleanZoom(s.zoom_link)) return rejectLater(fail("NO_ZOOM_LINK", "Add the Zoom link to " + (s.code || "this batch") + " in Workshops first."));
        var at = nowIso(); r.zoom_email_sent_at = at;
        r.history.push({ at: at, text: "Zoom link emailed to " + r.email + " (demo: no real email sent)" });
        save(d); return later({ ok: true, sent_at: at, demo: true });
      },
      paymongo: function () { return later({ ok: true, demo: true, key_set: false, connected: false, mode: "" }); },
      saveContent: function (table, row) {
        var d = load(); d[table] = d[table] || [];
        var x = clone(row), i = -1;
        d[table].forEach(function (y, k) { if (x.id && y.id === x.id) i = k; });
        if (i >= 0) { x.created_at = d[table][i].created_at; d[table][i] = x; } else { x.id = uid(); x.created_at = nowIso(); d[table].push(x); }
        save(d); return later(x);
      },
      // Delete a batch: refused when anyone paid (or was refunded); unpaid/cancelled reservations go with it.
      deleteSession: function (id) {
        var d = load(), s = d.sessions.filter(function (x) { return x.id === id; })[0];
        if (!s) return rejectLater(fail("NOT_FOUND", "Batch not found."));
        if (s.format === "hub") return rejectLater(fail("HUB", "The Builder Hub can't be deleted. Set it to Draft to stop selling it on its own."));
        var money = d.reservations.filter(function (r) { return r.session_id === id && ["paid", "refund_requested", "refunded"].indexOf(r.status) >= 0; }).length;
        if (money) return rejectLater(fail("HAS_PAID", money + " paid or refunded participant" + (money === 1 ? " is" : "s are") + " in this batch."));
        var before = d.reservations.length;
        d.reservations = d.reservations.filter(function (r) { return r.session_id !== id; });
        d.sessions = d.sessions.filter(function (x) { return x.id !== id; });
        save(d); return later({ ok: true, code: s.code, removed_reservations: before - d.reservations.length });
      },
      removeContent: function (table, id) {
        var d = load(); d[table] = (d[table] || []).filter(function (y) { return y.id !== id; });
        if (table === "courses") d.lessons = (d.lessons || []).filter(function (l) { return l.course_id !== id; });
        save(d); return later(true);
      },
      hub: function (action, b) {
        var d = load(); d.members = d.members || []; b = b || {};
        var months = Math.max(1, parseInt(b.months, 10) || (d.settings.hub_offer && d.settings.hub_offer.months) || 12);
        function addM(from, n) { var x = new Date(from); x.setMonth(x.getMonth() + n); return x.toISOString(); }
        function give(email, name, lang, note, resId) {
          email = cleanText(email, 200).toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw fail("EMAIL", "Enter a valid email.");
          var m = d.members.filter(function (x) { return x.email === email; })[0];
          if (m) { m.access_until = addM(Math.max(Date.now(), new Date(m.access_until).getTime()), months); m.history.push({ at: nowIso(), text: note + " (demo)" }); return m; }
          m = { user_id: uid(), email: email, name: cleanText(name, 120), lang: cleanLang(lang || "en"), access_until: addM(Date.now(), months), points: 0, source: resId ? "checkout" : "admin", reservation_id: resId || null, history: [{ at: nowIso(), text: note + " (demo: no email sent)" }], created_at: nowIso() };
          d.members.unshift(m); return m;
        }
        try {
          if (action === "grant") { var g = give(b.email, b.name, b.lang, "Added by admin"); save(d); return later({ ok: true, member: g, emailed: true }); }
          if (action === "provision") {
            var r = d.reservations.filter(function (x) { return x.id === b.reservation_id; })[0];
            if (!r || !r.addon_hub || r.status !== "paid") return rejectLater(fail("NO_ADDON", "This reservation has no paid Builder Hub add-on."));
            give(r.email, r.name, r.lang, "Builder Hub from checkout", r.id); r.hub_email_sent_at = nowIso(); r.history.push({ at: nowIso(), text: "Builder Hub access emailed to " + r.email + " (demo)" }); save(d); return later({ ok: true });
          }
          var m = d.members.filter(function (x) { return x.user_id === b.user_id; })[0];
          if (!m) return rejectLater(fail("NOT_FOUND", "Member not found."));
          if (action === "extend") { m.access_until = addM(Math.max(Date.now(), new Date(m.access_until).getTime()), months); m.history.push({ at: nowIso(), text: "Extended " + months + " months by admin" }); }
          else if (action === "revoke") { m.access_until = nowIso(); m.history.push({ at: nowIso(), text: "Access ended by admin" }); }
          else if (action === "resend") { m.history.push({ at: nowIso(), text: "Access email re-sent by admin (demo)" }); }
          save(d); return later({ ok: true, member: m });
        } catch (e) { return rejectLater(e); }
      },
      resetDemo: function () { var s = seed(); save(s); return later(true); }
    }
  };

  /* =====================================================================
     LIVE DRIVER — Supabase
     ===================================================================== */
  var sb = null, readyPromise = null;
  function loadSupabase() {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise(function (resolve, reject) {
      function make() {
        try { sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey); resolve(); }
        catch (e) { reject(e); }
      }
      if (window.supabase && window.supabase.createClient) return make();
      var s = document.createElement("script");
      s.src = SUPABASE_CDN; s.async = true; s.onload = make;
      s.onerror = function () { reject(fail("NETWORK", "Couldn't load the database library. Check your connection.")); };
      document.head.appendChild(s);
    });
    return readyPromise;
  }
  function q(p) {
    return p.then(function (res) {
      if (res.error) {
        var m = res.error.message || "Something went wrong.";
        if (/FULL/.test(m)) throw fail("FULL", "This session is full.");
        if (/CLOSED/.test(m)) throw fail("CLOSED", "This session is no longer open for reservations.");
        if (/ADDRESS/.test(m)) throw fail("ADDRESS", "Please enter the full address where we'll visit you.");
        if (/EMPTY/.test(m)) throw fail("EMPTY", "Choose at least one item.");
        if (/DUPLICATE|reservations_one_active_per_email/.test(m)) throw fail("DUPLICATE", "This email already has a seat in this session.");
        throw fail("DB", m);
      }
      return res.data;
    });
  }
  function withSb(fn) { return loadSupabase().then(function () { return fn(sb); }); }
  // Calls an Edge Function and turns its {error, message} reply into a normal error
  function invoke(c, name, body) {
    return c.functions.invoke(name, { body: body }).then(function (res) {
      if (!res.error) return res.data;
      var ctx = res.error.context;
      var parse = ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return null; }) : Promise.resolve(null);
      return parse.then(function (j) { throw fail((j && j.error) || "NETWORK", (j && j.message) || "Couldn't reach the server. Try again."); });
    });
  }

  var live = {
    mode: "live",
    ready: loadSupabase,
    publicSessions: function () { return withSb(function (c) { return q(c.rpc("public_sessions_v2")); }); },
    publicSettings: function () {
      return withSb(function (c) {
        return q(c.from("settings").select("key,value").in("key", PUBLIC_SETTING_KEYS)).then(function (rows) {
          var out = {}; PUBLIC_SETTING_KEYS.forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
          (rows || []).forEach(function (r) { out[r.key] = r.value; });
          return out;
        });
      });
    },
    reserveSeat: function (r) {
      try { validReservation(r); } catch (e) { return Promise.reject(e); }
      return withSb(function (c) {
        return q(c.rpc("reserve_seat_v4", { p_session: r.session_id, p_name: cleanText(r.name, 120), p_email: cleanText(r.email, 200).toLowerCase(),
          p_phone: cleanPhone(r.phone), p_method: r.method, p_source: cleanText(r.source || "Website", 60), p_lang: cleanLang(r.lang), p_addon: !!r.addon,
          p_address: cleanText(r.address, 300), p_pref: cleanText(r.schedule_pref, 300) })).then(function (id) { return { id: id }; });
      });
    },
    reserveOrder: function (o) {
      try { validReservation({ name: o.name, email: o.email, phone: o.phone, method: o.method }); } catch (e) { return Promise.reject(e); }
      var items = (o.items || []).slice(0, 3).map(function (it) { return { session: it.session_id, address: cleanText(it.address, 300), pref: cleanText(it.schedule_pref, 300) }; });
      return withSb(function (c) {
        return q(c.rpc("reserve_order", { p_items: items, p_name: cleanText(o.name, 120), p_email: cleanText(o.email, 200).toLowerCase(),
          p_phone: cleanPhone(o.phone), p_method: o.method, p_source: cleanText(o.source || "Website", 60), p_lang: cleanLang(o.lang), p_addon: !!o.addon }));
      });
    },
    // Personal PayMongo checkout for a reservation → { checkout_url } (or { already_paid })
    startPayment: function (reservationId) {
      return withSb(function (c) { return invoke(c, "paymongo-checkout", { reservation_id: reservationId, site_url: location.origin }); });
    },
    submitInquiry: function (x) {
      return withSb(function (c) {
        return q(c.rpc("submit_inquiry", { p_name: cleanText(x.name, 120), p_business: cleanText(x.business, 160), p_email: cleanText(x.email, 200).toLowerCase(),
          p_phone: cleanPhone(x.phone), p_need: cleanText(x.need, 160), p_message: String(x.message || "").trim().slice(0, 2000), p_source: cleanText(x.source || "Website", 60) }))
          .then(function (id) { return { id: id }; });
      });
    },
    auth: {
      user: function () {
        return withSb(function (c) {
          return c.auth.getUser().then(function (res) {
            var u = res.data && res.data.user; if (!u) return null;
            return q(c.from("admins").select("name").eq("user_id", u.id)).then(function (rows) {
              if (!rows || !rows.length) return null;
              return { email: u.email, name: rows[0].name || u.email };
            });
          });
        });
      },
      signIn: function (email, password) {
        return withSb(function (c) {
          return c.auth.signInWithPassword({ email: String(email).trim(), password: password }).then(function (res) {
            if (res.error) throw fail("AUTH", "That email and password don't match.");
            return live.auth.user().then(function (u) {
              if (!u) { return c.auth.signOut().then(function () { throw fail("NOT_ADMIN", "This account isn't an admin yet. Add it to the admins table (README, step 3)."); }); }
              return u;
            });
          });
        });
      },
      signOut: function () { return withSb(function (c) { return c.auth.signOut(); }); }
    },
    admin: {
      all: function () {
        return withSb(function (c) {
          return Promise.all([
            q(c.from("sessions").select("*").order("date", { ascending: true })),
            q(c.from("reservations").select("*").order("created_at", { ascending: false }).limit(5000)),
            q(c.from("inquiries").select("*").order("created_at", { ascending: false }).limit(2000)),
            q(c.from("settings").select("key,value")),
            q(c.from("members").select("*").order("created_at", { ascending: false }).limit(5000)).catch(function () { return []; }),
            q(c.from("courses").select("*").order("sort").order("created_at")).catch(function () { return []; }),
            q(c.from("lessons").select("*").order("sort").order("created_at")).catch(function () { return []; }),
            q(c.from("replays").select("*").order("recorded_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })).catch(function () { return []; }),
            q(c.from("prompts").select("*").order("category").order("sort").order("created_at")).catch(function () { return []; }),
            q(c.rpc("hub_points_all")).catch(function () { return []; })
          ]).then(function (r) {
            var pts = {}; (r[9] || []).forEach(function (x) { pts[x.user_id] = x.points; });
            (r[4] || []).forEach(function (m) { m.points = pts[m.user_id] || 0; });
            var settings = clone(DEFAULT_SETTINGS);
            (r[3] || []).forEach(function (x) { settings[x.key] = x.value; });
            return { sessions: r[0] || [], reservations: r[1] || [], inquiries: r[2] || [], settings: settings, members: r[4] || [], courses: r[5] || [], lessons: r[6] || [], replays: r[7] || [], prompts: r[8] || [] };
          });
        });
      },
      saveSession: function (s) {
        var row = { code: cleanText(s.code, 60), title: cleanText(s.title, 160), format: cleanFormat(s.format), date: s.date, time_label: cleanText(s.time_label, 80), venue: cleanText(s.venue, 200),
          zoom_link: cleanZoom(s.zoom_link), zoom_notes: String(s.zoom_notes || "").trim().slice(0, 1000),
          capacity: Math.max(1, parseInt(s.capacity, 10) || 1), price: Math.max(0, parseInt(s.price, 10) || 0), status: s.status };
        return withSb(function (c) {
          var op = s.id ? c.from("sessions").update(row).eq("id", s.id) : c.from("sessions").insert(row);
          return q(op.select().single());
        });
      },
      updateReservation: function (id, patch, note) {
        return withSb(function (c) {
          return q(c.from("reservations").select("history").eq("id", id).single()).then(function (cur) {
            var p = clone(patch);
            if (note) p.history = (cur.history || []).concat([{ at: nowIso(), text: note }]);
            return q(c.from("reservations").update(p).eq("id", id).select().single());
          });
        });
      },
      addReservation: function (r) {
        try { validReservation(r); } catch (e) { return Promise.reject(e); }
        return withSb(function (c) {
          return q(c.from("sessions").select("price").eq("id", r.session_id).single()).then(function (s) {
            var created = nowIso(), paid = r.status === "paid";
            return q(c.from("reservations").insert({ session_id: r.session_id, name: cleanText(r.name, 120), email: cleanText(r.email, 200).toLowerCase(), phone: cleanPhone(r.phone),
              method: r.method, status: r.status, source: cleanText(r.source || "Added by admin", 60), ref: cleanText(r.ref, 80), amount: s.price, notes: cleanText(r.notes, 1000),
              lang: cleanLang(r.lang || "en"), paid_at: paid ? created : null, history: [{ at: created, text: "Added by admin" + (paid ? " · marked as paid" : "") }] }).select().single());
          });
        });
      },
      updateInquiry: function (id, patch) { return withSb(function (c) { return q(c.from("inquiries").update(patch).eq("id", id).select().single()); }); },
      saveSettings: function (patch) {
        return withSb(function (c) {
          var rows = Object.keys(patch).map(function (k) { return { key: k, value: patch[k], public: PUBLIC_SETTING_KEYS.indexOf(k) >= 0, updated_at: nowIso() }; });
          return q(c.from("settings").upsert(rows));
        });
      },
      sendZoomEmail: function (id, opts) {
        return withSb(function (c) {
          var body = { reservation_id: id }; if (opts && opts.preview) body.preview = true;
          return invoke(c, "send-workshop-email", body);
        });
      },
      paymongo: function (action) { return withSb(function (c) { return invoke(c, "paymongo-setup", { action: action || "status" }); }); },
      // Builder Hub content: table is courses | lessons | replays | prompts
      saveContent: function (table, row) {
        if (["courses", "lessons", "replays", "prompts"].indexOf(table) < 0) return Promise.reject(fail("TABLE", "Unknown content type."));
        var data = clone(row), id = data.id; delete data.id; delete data.created_at;
        return withSb(function (c) { return q((id ? c.from(table).update(data).eq("id", id) : c.from(table).insert(data)).select().single()); });
      },
      removeContent: function (table, id) {
        if (["courses", "lessons", "replays", "prompts"].indexOf(table) < 0) return Promise.reject(fail("TABLE", "Unknown content type."));
        return withSb(function (c) { return q(c.from(table).delete().eq("id", id)); });
      },
      deleteSession: function (id) {
        return withSb(function (c) {
          return c.rpc("admin_delete_session", { p_id: id }).then(function (res) {
            if (!res.error) return res.data;
            var m = res.error.message || "";
            if (/HAS_PAID/.test(m)) throw fail("HAS_PAID", "Someone already paid in this batch.");
            if (/HUB/.test(m)) throw fail("HUB", "The Builder Hub can't be deleted. Set it to Draft to stop selling it on its own.");
            if (/admin_delete_session|schema cache|does not exist/i.test(m)) throw fail("SETUP", "Deleting batches isn't switched on yet. Run the one-time SQL from the setup notes in Supabase → SQL Editor.");
            throw fail("DB", m || "Couldn't delete the batch.");
          });
        });
      },
      // Builder Hub members: provision | resend | grant | extend | revoke
      hub: function (action, payload) {
        var body = { action: action, site_url: location.origin }; Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
        return withSb(function (c) { return invoke(c, "hub-admin", body); });
      },
      resetDemo: function () { return Promise.reject(fail("LIVE", "Demo reset is only available in demo mode.")); }
    }
  };

  window.PT = LIVE ? live : demo;
  window.PT.helpers = { cleanPhone: cleanPhone, todayYmd: todayYmd, ACTIVE: ACTIVE, DEFAULT_SETTINGS: DEFAULT_SETTINGS };
})();
