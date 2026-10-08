/* PROVIDETECH Builder Hub — members' area.
   Sign in, set/reset password, learning, replays, prompts, community and leaderboard.
   Live mode uses Supabase (assets/config.js); without it, a demo member is available. */
(function () {
  "use strict";
  var CFG = window.PROVIDETECH_CONFIG || {};
  var LIVE = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  var CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  var app = document.getElementById("app");
  var sb = null, S = { user: null, member: null, menu: false, c: null, pq: "", pcat: "", feed: {}, posts: {}, lb: {}, lbp: "month", draft: "", cdraft: {}, editing: null, confirm: null, channels: null };

  /* ---------- language (English / Tagalog / Bisaya), shared with the main website ---------- */
  var LANGS = [["en", "English"], ["tl", "Tagalog"], ["ceb", "Bisaya"]];
  var LANG = "en"; try { var sl = localStorage.getItem("pt-lang"); if (sl === "tl" || sl === "ceb") LANG = sl; } catch (e) {}
  document.documentElement.setAttribute("lang", LANG);
  function T(s, v) {
    var d = (window.PT_I18N || {})[LANG], r = (d && d[s]) || s;
    if (v) r = r.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; });
    return r;
  }
  function LOC() { return LANG === "tl" ? "fil-PH" : "en-PH"; }
  function setLang(l) { LANG = l; try { localStorage.setItem("pt-lang", l); } catch (e) {} document.documentElement.setAttribute("lang", l); S.keepScroll = true; render(); }
  function langPicker() { return '<label class="langsel"><span class="sr-only">Language</span><select id="hub-lang" class="input" aria-label="Language / Wika / Pinulongan">' + LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === LANG ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") + "</select></label>"; }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function initials(n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "")[0] || "?").toUpperCase() + ((p[1] || "")[0] || "").toUpperCase(); }
  function first(n) { return String(n || "").trim().split(/\s+/)[0] || T("there"); }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString(LOC(), { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } }
  var LEVELS = [[0, "Starter"], [50, "Builder"], [150, "Maker"], [300, "Pro"], [600, "Expert"], [1000, "Legend"]];
  function lvlIdx(p) { p = Number(p) || 0; var i = 0; LEVELS.forEach(function (l, k) { if (p >= l[0]) i = k; }); return i; }
  function level(p) { return lvlIdx(p) + 1; }
  function levelName(p) { return LEVELS[lvlIdx(p)][1]; }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return T("just now"); if (s < 3600) return T("{n}m ago", { n: Math.floor(s / 60) }); if (s < 86400) return T("{n}h ago", { n: Math.floor(s / 3600) }); if (s < 7 * 86400) return T("{n}d ago", { n: Math.floor(s / 86400) });
    try { return new Date(iso).toLocaleDateString(LOC(), { day: "numeric", month: "short" }); } catch (e) { return ""; }
  }
  function friendly(e) {
    var m = String(e && (e.message || e.code) || "");
    if (/SLOW_DOWN/.test(m)) return T("You've posted a lot today. Take a short break and try again later.");
    if (/row-level|permission|FORBIDDEN/i.test(m)) return T("You can't do that here.");
    return m && !/^DB$/.test(m) && m.length < 140 ? m : T("Something went wrong. Please try again.");
  }
  function fail(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function videoEmbed(url) {
    url = String(url || "").trim(); var m;
    if ((m = /^https:\/\/player\.vimeo\.com\/video\/(\d+)(?:\?h=([\w]+))?/.exec(url))) return "https://player.vimeo.com/video/" + m[1] + (m[2] ? "?h=" + m[2] : "");
    if ((m = /^https:\/\/(?:www\.)?vimeo\.com\/(?:.*\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/.exec(url))) return "https://player.vimeo.com/video/" + m[1] + (m[2] ? "?h=" + m[2] : "");
    if ((m = /^https:\/\/(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/.exec(url)) || (m = /^https:\/\/youtu\.be\/([\w-]{6,})/.exec(url)) || (m = /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/(?:embed|live|shorts)\/([\w-]{6,})/.exec(url))) return "https://www.youtube-nocookie.com/embed/" + m[1];
    return "";
  }
  function player(url, title) {
    var src = videoEmbed(url);
    if (!src) return '<div class="video empty-video">' + T("Video coming soon") + '</div>';
    return '<div class="video"><iframe src="' + esc(src + (src.indexOf("?") > 0 ? "&" : "?") + (src.indexOf("vimeo") > 0 ? "dnt=1&title=0&byline=0&portrait=0" : "rel=0")) + '" title="' + esc(title) + '" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>';
  }
  function mins(n) { n = Number(n) || 0; return n ? (n >= 60 ? Math.floor(n / 60) + "h" + (n % 60 ? " " + (n % 60) + "m" : "") : n + " min") : ""; }
  function text(t) { return '<div class="prose">' + esc(t).replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>') + "</div>"; }
  /* Lesson formatting: a small, safe subset of Markdown (everything is escaped first).
     ## Heading   ### Smaller heading   - bullet   1. numbered   > Try it box   **bold**   `code`
     [link text](https://…)   ``` … ``` = example box with a Copy button   --- = divider */
  function mdInline(t) {
    var links = [];
    t = esc(t).replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, function (_, label, url) { links.push('<a href="' + url + '" target="_blank" rel="noopener">' + label + "</a>"); return "\u0000" + (links.length - 1) + "\u0000"; });
    t = t.replace(/(https:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/(^|[^*\w])\*(\S(?:[^*]*?\S)?)\*(?![*\w])/g, "$1<em>$2</em>");
    return t.replace(/\u0000(\d+)\u0000/g, function (_, i) { return links[+i]; });
  }
  function md(src) {
    var lines = String(src || "").replace(/\r/g, "").split("\n"), out = [], i = 0;
    while (i < lines.length) {
      var ln = lines[i], m;
      if (/^```/.test(ln)) {
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push('<div class="pblock"><button class="btn btn-g btn-sm" data-act="copy-block">' + T("Copy") + '</button><pre>' + esc(buf.join("\n")) + "</pre></div>");
        continue;
      }
      if (!ln.trim()) { i++; continue; }
      if (/^-{3,}\s*$/.test(ln)) { out.push("<hr>"); i++; continue; }
      if ((m = /^(#{2,3})\s+(.*)$/.exec(ln))) { out.push("<h" + m[1].length + ">" + mdInline(m[2]) + "</h" + m[1].length + ">"); i++; continue; }
      if (/^>\s?/.test(ln)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
        out.push('<div class="callout">' + md(q.join("\n")) + "</div>");
        continue;
      }
      if (/^\s*([-•*])\s+/.test(ln)) {
        var ul = [];
        var isCk = /^\s*[-•*]\s+\[[ xX]\]\s+/.test(ln);
        while (i < lines.length && /^\s*([-•*])\s+/.test(lines[i])) {
          var item = lines[i++].replace(/^\s*([-•*])\s+/, ""), ck = /^\[([ xX])\]\s+(.*)$/.exec(item);
          // "- [ ] task" becomes a real tick box; members' ticks are remembered on their device
          ul.push(ck ? '<li><label class="ck"><input type="checkbox" data-ck="' + esc(ck[2]) + '"' + (ck[1] !== " " ? " checked" : "") + "><span>" + mdInline(ck[2]) + "</span></label></li>"
                     : "<li>" + mdInline(item) + "</li>");
        }
        out.push("<ul" + (isCk ? ' class="checklist"' : "") + ">" + ul.join("") + "</ul>");
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(ln)) {
        var ol = [], st = parseInt(ln, 10);
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) ol.push("<li>" + mdInline(lines[i++].replace(/^\s*\d+[.)]\s+/, "")) + "</li>");
        out.push("<ol" + (st > 1 ? ' start="' + st + '"' : "") + ">" + ol.join("") + "</ol>");
        continue;
      }
      var para = [];
      while (i < lines.length && lines[i].trim() && !/^(```|#{2,3}\s|>|\s*[-•*]\s+|\s*\d+[.)]\s+|-{3,}\s*$)/.test(lines[i])) para.push(mdInline(lines[i++]));
      if (!para.length) para.push(mdInline(lines[i++]));
      out.push("<p>" + para.join("<br>") + "</p>");
    }
    return out.join("");
  }
  function readTime(n) { n = Number(n) || 0; return n ? T("{n} min read", { n: n }) : ""; }
  function C() { return S.c || { courses: [], lessons: [], replays: [], prompts: [], done: {} }; }
  function lessonsOf(cid) { return C().lessons.filter(function (l) { return l.course_id === cid; }); }
  function progress(cid) { var ls = lessonsOf(cid), d = ls.filter(function (l) { return C().done[l.id]; }).length; return { done: d, total: ls.length, pct: ls.length ? Math.round(d / ls.length * 100) : 0 }; }
  function loadContent() {
    if (S.c || S.loadingC) return; S.loadingC = true;
    api.content().then(function (c) { S.c = c; }, function () { S.c = { courses: [], lessons: [], replays: [], prompts: [], done: {}, error: true }; })
      .then(function () { S.loadingC = false; render(); });
  }
  function route() { var h = location.hash.replace(/^#\/?/, ""); var q = h.indexOf("?"); return { path: (q >= 0 ? h.slice(0, q) : h) || "", params: new URLSearchParams(q >= 0 ? h.slice(q + 1) : "") }; }
  function go(p) { location.hash = "#/" + p; }

  var I = {
    home: '<path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>',
    play: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><path d="m8.5 7.8 4 2.2-4 2.2z"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5zM4 16.5A1.5 1.5 0 0 0 5.5 18H16"/>',
    pack: '<path d="m10 2.5 7 3.5v8l-7 3.5L3 14V6zM3 6l7 3.5L17 6M10 9.5v8"/>',
    prompt: '<path d="m4 6 4 4-4 4M10 15h6"/>',
    trophy: '<path d="M6 3h8v4a4 4 0 0 1-8 0zM6 5H3.5a2.5 2.5 0 0 0 3 3M14 5h2.5a2.5 2.5 0 0 1-3 3M10 11v3M7 17h6M8 14h4v3H8z"/>',
    tool: '<path d="M12.5 3.5a3.5 3.5 0 0 0-3.3 4.7L3.5 13.9a1.4 1.4 0 0 0 2 2l5.7-5.7a3.5 3.5 0 0 0 4.7-3.3l-2 2-2-.6-.6-2z"/>',
    shop: '<path d="M3 7h14l-1 10H4zM7 7V5.5a3 3 0 0 1 6 0V7"/>',
    brief: '<rect x="3" y="6" width="14" height="10" rx="1.5"/><path d="M7.5 6V4.5h5V6M3 10.5h14"/>',
    menu: '<path d="M3 5.5h14M3 10h14M3 14.5h14"/>',
    dots: '<circle cx="5" cy="10" r="1.2" fill="currentColor"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/><circle cx="15" cy="10" r="1.2" fill="currentColor"/>',
    lock: '<rect x="4" y="9" width="12" height="8" rx="1.6"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/>',
  };
  function ic(name, size) { size = size || 18; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + "</svg>"; }

  var NAV = [
    ["", "home", "Home"],
    ["community", "chat", "Community"],
    ["replays", "play", "Replays"],
    ["learning", "book", "Learning"],
    ["prompts", "prompt", "Prompt Library"],
    ["leaderboard", "trophy", "Leaderboard"],
  ];
  var PAGES = {
    community: ["chat", "Community", "Ask questions, share wins and show what you built. Five channels, one friendly crowd."],
    replays: ["play", "Replays", "Every past live build, recorded end to end. The first recordings are being added."],
    learning: ["book", "Learning", "Step-by-step courses and lessons, with new ones every month. The first course is on its way."],
    prompts: ["prompt", "Prompt Library", "Copy-ready prompts and templates for real business tasks. The library is being filled."],
    leaderboard: ["trophy", "Leaderboard", "Earn points for posting, helping others and finishing lessons. Climb the monthly ranking."],
  };

  /* ---------- data layer ---------- */
  function ready() {
    if (!LIVE) return Promise.resolve();
    if (sb) return Promise.resolve();
    return new Promise(function (res, rej) {
      function make() { try { sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { storageKey: "pt-hub-auth", persistSession: true, autoRefreshToken: true } }); res(); } catch (e) { rej(e); } }
      if (window.supabase && window.supabase.createClient) return make();
      var s = document.createElement("script"); s.src = CDN; s.onload = make; s.onerror = function () { rej(fail("NETWORK", T("Couldn't connect. Check your internet and refresh."))); };
      document.head.appendChild(s);
    });
  }
  function invoke(name, body) {
    return sb.functions.invoke(name, { body: body }).then(function (res) {
      if (!res.error) return res.data;
      var ctx = res.error.context;
      var p = ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return null; }) : Promise.resolve(null);
      return p.then(function (j) { throw fail((j && j.error) || "NETWORK", (j && j.message) || T("Something went wrong. Please try again.")); });
    });
  }
  var DEMO_CONTENT = {
    courses: [{ id: "c1", title: "AI Business Systems 101", description: "Turn one real business problem into a working system, step by step." },
      { id: "pl", slug: "prompt-library", title: "Prompt Library", description: "Copy-paste prompts and master SPEC.md starters for real builds. Part 1: ten prompts for a simple website. Part 2: complete SPEC.md blueprints you give to Claude and say: build this." }],
    lessons: [
      { id: "l1", course_id: "c1", title: "Pick the right problem to automate", description: "## Why this matters\nStart with the task that eats the most hours.\n\n- List your weekly tasks\n- Mark the repetitive ones\n\n```\nHere are my weekly tasks: [LIST]. Which 3 should I automate first?\n```\n\n> **Try it:** write down 10 tasks you did this week.", video_url: "", duration_min: 6 },
      { id: "l2", course_id: "c1", title: "Map the workflow before you build", description: "", video_url: "https://vimeo.com/76979871", duration_min: 18 },
      { id: "l3", course_id: "c1", title: "Build your first AI assistant", description: "", video_url: "https://vimeo.com/76979871", duration_min: 25 },
      { id: "pl1", course_id: "pl", section: "Starter Prompts", title: "10 copy-paste prompts for basic websites", description: "Use these in order.\n\n## 1) The first build\n\n```\nBuild a one-page website for [BUSINESS NAME]...\n```\n\n## 2) The look & feel pass\n\n```\nGive this site a look that earns trust from [TARGET CUSTOMERS]...\n```", video_url: "", duration_min: 8 },
      { id: "pl2", course_id: "pl", section: "Master Prompts — SPEC.md starters", title: "How to use a master prompt", description: "A master prompt is a complete blueprint.", video_url: "", duration_min: 5 },
      { id: "pl3", course_id: "pl", section: "Master Prompts — SPEC.md starters", title: "Master prompt — Inventory System", description: "```\n# SPEC.md: Inventory System\n## Overview\n...\n```", video_url: "", duration_min: 10 },
    ],
    replays: [{ id: "r1", title: "Live build: booking system for a clinic", description: "Full session, from blank page to working bookings.", video_url: "https://vimeo.com/76979871", recorded_on: "2026-09-20", duration_min: 118 }],
    prompts: [
      { id: "p1", category: "Sales & Orders", title: "Order tracker", body: "Build a simple order tracker app for my [TYPE OF BUSINESS, e.g. online food business].\nIt must let me:\n- Add an order: customer name, mobile, items (pick from my product list), quantity, delivery date, address, payment method (GCash, COD, Bank, Cash), notes\n- Compute the total automatically from my price list: [PASTE PRODUCTS AND PRICES]\n- Move each order through: New → Paid → Preparing → Out for delivery → Done (or Cancelled)\n- See today's orders and tomorrow's orders at the top\n- Search by customer name or mobile\n- See totals: orders and sales today, this week, this month\n\nMake it easy for a non-techy owner: big buttons, works on a phone, uses ₱, saves my data, and has Export/Import for backups.", sort: 1 },
      { id: "p2", category: "Inventory & Stock", title: "Simple inventory with low-stock alerts", body: "Build a simple inventory app for my [TYPE OF BUSINESS].\nIt must let me:\n- Add products: name, category, unit (pc, box, kg…), cost price, selling price, current stock, reorder level\n- Record Stock In (deliveries) and Stock Out (sold, used, damaged, expired) with a reason; stock updates automatically\n- Never let stock go below zero\n- Show a red \"Low stock\" list for items at or below their reorder level\n- Show total stock value (at cost and at selling price)\n- Show the history of every stock movement per product\n\nMake it easy for a non-techy owner: big buttons, works on a phone, uses ₱, saves my data, and has Export/Import for backups.", sort: 1 },
      { id: "p3", category: "Staff & HR", title: "Staff attendance log", body: "Build a staff attendance app for my [BUSINESS] with [NUMBER] staff.\nIt must let me:\n- Save staff: name, position, shift (e.g. 8:00 AM–5:00 PM), rest days\n- Record time in and time out per staff per day (a big Time In / Time Out button for each person)\n- Compute lates (after shift start + [10] minutes grace), undertime and total hours\n- Mark absent, leave or day off\n- Show a summary per cutoff ([1–15] and [16–end of month]): days worked, total lates, absences\n- Let me correct a record with a note of why\n\nMake it easy for a non-techy owner: big buttons, works on a phone, uses ₱, saves my data, and has Export/Import for backups.", sort: 1 },
      { id: "p4", category: "Money & Finance", title: "Expense tracker", body: "Build an expense tracker for my business.\nIt must let me:\n- Add an expense: date, amount, category (Rent, Salaries, Supplies, Utilities, Marketing, Transport, Other: [YOUR CATEGORIES]), paid from (Cash, GCash, Bank), note\n- See totals per category this month and compared to last month\n- Set a monthly budget per category and warn me when I'm close to it\n- Search and filter by date and category\n- Show a simple monthly summary I can send to my accountant\n\nMake it easy for a non-techy owner: big buttons, works on a phone, uses ₱, saves my data, and has Export/Import for backups.", sort: 1 },
    ],
  };
  var PAGE = 20;
  var EMOJIS = ["👍", "🔥", "🙌", "💡"];
  function one(p) { return p.then(function (r) { if (r.error) throw fail(/SLOW_DOWN/.test(r.error.message) ? "SLOW_DOWN" : "DB", r.error.message); return r.data; }); }
  function normPost(p) {
    var n = p.comments && p.comments[0] ? p.comments[0].count : 0;
    var out = {}; for (var k in p) if (k !== "comments") out[k] = p[k];
    out.ncomments = n; out.reactions = p.reactions || []; return out;
  }
  var DEMO_CHANNELS = [
    { slug: "general", name: "General", description: "Say hi, ask anything, share what you're working on." },
    { slug: "wins", name: "Wins", description: "Share your results: first client, first automation, hours saved." },
    { slug: "help", name: "Help", description: "Stuck? Ask here. Say what you tried and where it broke." },
    { slug: "builds", name: "Builds", description: "Show what you built: links, screenshots, lessons learned." },
    { slug: "off-topic", name: "Off-topic", description: "Everything else." },
  ];
  var DEMO_PEOPLE = [{ id: "u1", name: "Maria S.", all: 140, month: 40 }, { id: "u2", name: "Paolo R.", all: 60, month: 25 }, { id: "u3", name: "Jen T.", all: 95, month: 30 }];
  function dseed() {
    var t = Date.now(), h = 36e5;
    function at(x) { return new Date(t - x * h).toISOString(); }
    return {
      posts: [
        { id: "dp1", channel: "general", user_id: "team", author_name: "PROVIDETECH Team", author_team: true, pinned: true, hidden: false, created_at: at(50), edited_at: null, body: "Welcome to the Builder Hub community! 👋\n\nIntroduce yourself below: what's your business, and what's the one task you want AI to take off your plate?" },
        { id: "dp2", channel: "wins", user_id: "u1", author_name: "Maria S.", author_team: false, pinned: false, hidden: false, created_at: at(5), edited_at: null, body: "First paying client for a Messenger auto-reply bot! ₱8,000 setup + ₱1,500 a month. I used the workflow map from Lesson 2 to explain it to them." },
        { id: "dp3", channel: "help", user_id: "u2", author_name: "Paolo R.", author_team: false, pinned: false, hidden: false, created_at: at(9), edited_at: null, body: "My Google Sheets automation stops after about 50 rows. I'm using Apps Script with a time trigger. Anyone seen this?" },
        { id: "dp4", channel: "builds", user_id: "u3", author_name: "Jen T.", author_team: false, pinned: false, hidden: false, created_at: at(26), edited_at: null, body: "Built a simple booking page for my sister's salon this weekend. Took about 3 hours with Claude. Happy to share the prompt I used." },
      ],
      comments: [
        { id: "dc1", post_id: "dp3", user_id: "team", author_name: "PROVIDETECH Team", author_team: true, hidden: false, created_at: at(8), body: "Apps Script stops each run after 6 minutes. Process the rows in batches of 40 and save the last row number in Script Properties, so the next run continues where it stopped." },
        { id: "dc2", post_id: "dp1", user_id: "u1", author_name: "Maria S.", author_team: false, hidden: false, created_at: at(40), body: "Hi! I run a small online bakery. I want AI to answer the same 10 questions I get every day on Messenger." },
        { id: "dc3", post_id: "dp3", user_id: "u2", author_name: "Paolo R.", author_team: false, hidden: false, created_at: at(7), body: "That fixed it, salamat!" },
      ],
      reactions: [
        { post_id: "dp2", user_id: "u2", emoji: "🔥", created_at: at(4) }, { post_id: "dp2", user_id: "u3", emoji: "🙌", created_at: at(4) }, { post_id: "dp2", user_id: "team", emoji: "🔥", created_at: at(4) },
        { post_id: "dp4", user_id: "u1", emoji: "👍", created_at: at(20) }, { post_id: "dp1", user_id: "u3", emoji: "👍", created_at: at(30) },
      ],
    };
  }
  function dcm() { try { var j = JSON.parse(localStorage.getItem("pt-hub-demo-cm") || "null"); if (j && j.posts) return j; } catch (e) {} return dseed(); }
  function dsave(d) { try { localStorage.setItem("pt-hub-demo-cm", JSON.stringify(d)); } catch (e) {} }
  function demoPatch(table, id, patch) { var d = dcm(), row = d[table].filter(function (x) { return x.id === id; })[0]; if (!row) return Promise.reject(fail("DB", "Not found.")); for (var k in patch) row[k] = patch[k]; dsave(d); return Promise.resolve(row); }
  function demoPost(d, p) { var o = JSON.parse(JSON.stringify(p)); o.ncomments = d.comments.filter(function (c) { return c.post_id === p.id && !c.hidden; }).length; o.reactions = d.reactions.filter(function (r) { return r.post_id === p.id; }); return o; }
  function demoPoints(d, uid, since) {
    function day(iso) { return iso.slice(0, 10); }
    var pts = 0, perDay = {}, cDay = {}, seen = {};
    d.posts.forEach(function (p) { if (p.user_id === uid && !p.hidden && new Date(p.created_at) >= since) perDay[day(p.created_at)] = (perDay[day(p.created_at)] || 0) + 1; });
    Object.keys(perDay).forEach(function (k) { pts += Math.min(perDay[k], 5) * 5; });
    d.comments.forEach(function (c) {
      var p = d.posts.filter(function (x) { return x.id === c.post_id; })[0];
      if (c.user_id === uid && !c.hidden && p && !p.hidden && p.user_id !== uid && new Date(c.created_at) >= since) cDay[day(c.created_at)] = (cDay[day(c.created_at)] || 0) + 1;
    });
    Object.keys(cDay).forEach(function (k) { pts += Math.min(cDay[k], 10) * 3; });
    d.reactions.forEach(function (r) {
      var p = d.posts.filter(function (x) { return x.id === r.post_id; })[0];
      if (p && p.user_id === uid && !p.hidden && r.user_id !== uid && new Date(r.created_at) >= since && !seen[r.post_id + r.user_id]) { seen[r.post_id + r.user_id] = 1; pts += 1; }
    });
    if (uid === "me") { var done = {}; try { done = JSON.parse(localStorage.getItem("pt-hub-demo-done") || "{}"); } catch (e) {} Object.keys(done).forEach(function (k) { if (new Date(done[k]) >= since) pts += 10; }); }
    return pts;
  }
  var DEMO_MEMBER = { email: "member@providetech.demo", name: "Demo Member", points: 0, access_until: new Date(Date.now() + 330 * 864e5).toISOString() };
  var api = LIVE ? {
    session: function () {
      return sb.auth.getUser().then(function (r) {
        var u = r.data && r.data.user; if (!u) return null;
        return sb.from("members").select("*").eq("user_id", u.id).maybeSingle().then(function (m) {
          if (m.data) return sb.rpc("hub_my_points").then(function (p) { m.data.points = p.error ? 0 : (p.data || 0); return { user: u, member: m.data }; });
          return sb.rpc("is_admin").then(function (a) { return { user: u, member: a.data === true ? { name: "PROVIDETECH Team", email: u.email, team: true, points: 0, access_until: "2999-12-31T00:00:00Z" } : null }; });
        });
      });
    },
    signIn: function (email, pw) {
      return sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: pw }).then(function (r) {
        if (r.error) throw fail("AUTH", T("That email and password don't match. If you haven't set a password yet, use the link in your access email."));
        return api.session();
      });
    },
    signOut: function () { return sb.auth.signOut(); },
    content: function () {
      function rows(p) { return p.then(function (r) { if (r.error) throw fail("DB", r.error.message); return r.data || []; }); }
      return Promise.all([
        rows(sb.from("courses").select("*").order("sort").order("created_at")),
        rows(sb.from("lessons").select("*").order("sort").order("created_at")),
        rows(sb.from("replays").select("*").order("recorded_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })),
        rows(sb.from("prompts").select("*").order("sort").order("created_at")),
        rows(sb.from("lesson_progress").select("lesson_id,completed_at")),
      ]).then(function (r) { return { courses: r[0], lessons: r[1], replays: r[2], prompts: r[3], done: r[4].reduce(function (o, x) { o[x.lesson_id] = x.completed_at; return o; }, {}) }; });
    },
    setDone: function (lessonId, done) {
      var op = done ? sb.from("lesson_progress").insert({ lesson_id: lessonId }) : sb.from("lesson_progress").delete().eq("lesson_id", lessonId).eq("user_id", S.user.id);
      return op.then(function (r) { if (r.error && !/duplicate/i.test(r.error.message)) throw fail("DB", r.error.message); });
    },
    checkToken: function (t) { return invoke("hub-auth", { action: "check_token", token: t }); },
    setPassword: function (t, pw) { return invoke("hub-auth", { action: "set_password", token: t, password: pw }); },
    forgot: function (email) { return invoke("hub-auth", { action: "forgot", email: email, site_url: location.origin }); },
    myPoints: function () { return sb.rpc("hub_my_points").then(function (r) { if (r.error) throw fail("DB", r.error.message); return r.data || 0; }); },
    channels: function () { return sb.from("channels").select("*").order("sort").then(function (r) { if (r.error) throw fail("DB", r.error.message); return r.data || []; }); },
    feed: function (ch, offset) {
      var q = sb.from("posts").select("*, comments(count), reactions(emoji,user_id)");
      if (ch !== "all") q = q.eq("channel", ch);
      return q.order("pinned", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + PAGE).then(function (r) {
        if (r.error) throw fail("DB", r.error.message);
        var rows = (r.data || []).map(normPost);
        return { posts: rows.slice(0, PAGE), more: rows.length > PAGE };
      });
    },
    post: function (id) {
      return Promise.all([
        sb.from("posts").select("*, comments(count), reactions(emoji,user_id)").eq("id", id).maybeSingle(),
        sb.from("comments").select("*").eq("post_id", id).order("created_at"),
      ]).then(function (r) { if (r[0].error) throw fail("DB", r[0].error.message); return { post: r[0].data ? normPost(r[0].data) : null, comments: r[1].data || [] }; });
    },
    createPost: function (ch, body) { return one(sb.from("posts").insert({ channel: ch, body: body }).select("*, comments(count), reactions(emoji,user_id)").single()).then(normPost); },
    editPost: function (id, body) { return one(sb.from("posts").update({ body: body }).eq("id", id).select("*, comments(count), reactions(emoji,user_id)").single()).then(normPost); },
    flagPost: function (id, patch) { return one(sb.from("posts").update(patch).eq("id", id).select("*, comments(count), reactions(emoji,user_id)").single()).then(normPost); },
    removePost: function (id) { return one(sb.from("posts").delete().eq("id", id)); },
    react: function (pid, emoji, on) {
      var op = on ? sb.from("reactions").insert({ post_id: pid, emoji: emoji }) : sb.from("reactions").delete().eq("post_id", pid).eq("emoji", emoji).eq("user_id", S.user.id);
      return op.then(function (r) { if (r.error && !/duplicate/i.test(r.error.message)) throw fail("DB", r.error.message); });
    },
    comment: function (pid, body) { return one(sb.from("comments").insert({ post_id: pid, body: body }).select().single()); },
    flagComment: function (id, patch) { return one(sb.from("comments").update(patch).eq("id", id).select().single()); },
    removeComment: function (id) { return one(sb.from("comments").delete().eq("id", id)); },
    leaderboard: function (period) { return sb.rpc("hub_leaderboard", { p_period: period, p_limit: 50 }).then(function (r) { if (r.error) throw fail("DB", r.error.message); return r.data || []; }); },
  } : {
    session: function () {
      var on = ""; try { on = sessionStorage.getItem("pt-hub-demo") || ""; } catch (e) {}
      if (on === "team") return Promise.resolve({ user: { id: "team", email: "team@providetech.demo" }, member: { name: "PROVIDETECH Team", email: "team@providetech.demo", team: true, points: 0, access_until: "2999-12-31T00:00:00Z" } });
      if (on) DEMO_MEMBER.points = demoPoints(dcm(), "me", 0);
      return Promise.resolve(on ? { user: { id: "me", email: DEMO_MEMBER.email }, member: DEMO_MEMBER } : null);
    },
    signIn: function (email, pw) {
      var em = String(email).trim().toLowerCase();
      if ((em === DEMO_MEMBER.email || em === "team@providetech.demo") && pw === "demo1234") { try { sessionStorage.setItem("pt-hub-demo", em === DEMO_MEMBER.email ? "1" : "team"); } catch (e) {} return api.session(); }
      return Promise.reject(fail("AUTH", T("Demo mode: sign in with member@providetech.demo and demo1234.")));
    },
    signOut: function () { try { sessionStorage.removeItem("pt-hub-demo"); } catch (e) {} return Promise.resolve(); },
    content: function () { var done = {}; try { done = JSON.parse(localStorage.getItem("pt-hub-demo-done") || "{}"); } catch (e) {} var c = JSON.parse(JSON.stringify(DEMO_CONTENT)); c.done = done; return Promise.resolve(c); },
    setDone: function (id, on) { var d = {}; try { d = JSON.parse(localStorage.getItem("pt-hub-demo-done") || "{}"); } catch (e) {} if (on) d[id] = new Date().toISOString(); else delete d[id]; try { localStorage.setItem("pt-hub-demo-done", JSON.stringify(d)); } catch (e) {} return Promise.resolve(); },
    checkToken: function () { return Promise.resolve({ ok: true, email: DEMO_MEMBER.email, purpose: "welcome" }); },
    setPassword: function () { return Promise.resolve({ ok: true, email: DEMO_MEMBER.email }); },
    forgot: function () { return Promise.resolve({ ok: true }); },
    myPoints: function () { return Promise.resolve(demoPoints(dcm(), "me", 0)); },
    channels: function () { return Promise.resolve(DEMO_CHANNELS.slice()); },
    feed: function (ch, offset) {
      var d = dcm(), rows = d.posts.filter(function (p) { return (ch === "all" || p.channel === ch) && (!p.hidden || isTeam()); })
        .sort(function (a, b) { return (b.pinned - a.pinned) || (a.created_at < b.created_at ? 1 : -1); }).map(function (p) { return demoPost(d, p); });
      return Promise.resolve({ posts: rows.slice(offset, offset + PAGE), more: rows.length > offset + PAGE });
    },
    post: function (id) {
      var d = dcm(), p = d.posts.filter(function (x) { return x.id === id && (!x.hidden || isTeam()); })[0];
      return Promise.resolve({ post: p ? demoPost(d, p) : null, comments: d.comments.filter(function (c) { return c.post_id === id && (!c.hidden || isTeam()); }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }) });
    },
    createPost: function (ch, body) {
      var d = dcm(), today = d.posts.filter(function (p) { return p.user_id === me() && Date.now() - new Date(p.created_at) < 864e5; }).length;
      if (today >= 20 && !isTeam()) return Promise.reject(fail("SLOW_DOWN"));
      var p = { id: "p" + Date.now(), channel: ch, user_id: me(), author_name: isTeam() ? "PROVIDETECH Team" : "Demo M.", author_team: isTeam(), body: body, pinned: false, hidden: false, created_at: new Date().toISOString(), edited_at: null };
      d.posts.push(p); dsave(d); return Promise.resolve(demoPost(d, p));
    },
    editPost: function (id, body) { return demoPatch("posts", id, { body: body, edited_at: new Date().toISOString() }).then(function (p) { return demoPost(dcm(), p); }); },
    flagPost: function (id, patch) { return demoPatch("posts", id, patch).then(function (p) { return demoPost(dcm(), p); }); },
    removePost: function (id) { var d = dcm(); d.posts = d.posts.filter(function (p) { return p.id !== id; }); d.comments = d.comments.filter(function (c) { return c.post_id !== id; }); d.reactions = d.reactions.filter(function (r) { return r.post_id !== id; }); dsave(d); return Promise.resolve(); },
    react: function (pid, emoji, on) {
      var d = dcm(); d.reactions = d.reactions.filter(function (r) { return !(r.post_id === pid && r.user_id === me() && r.emoji === emoji); });
      if (on) d.reactions.push({ post_id: pid, user_id: me(), emoji: emoji, created_at: new Date().toISOString() });
      dsave(d); return Promise.resolve();
    },
    comment: function (pid, body) { var d = dcm(), c = { id: "c" + Date.now(), post_id: pid, user_id: me(), author_name: isTeam() ? "PROVIDETECH Team" : "Demo M.", author_team: isTeam(), body: body, hidden: false, created_at: new Date().toISOString() }; d.comments.push(c); dsave(d); return Promise.resolve(c); },
    flagComment: function (id, patch) { return demoPatch("comments", id, patch); },
    removeComment: function (id) { var d = dcm(); d.comments = d.comments.filter(function (c) { return c.id !== id; }); dsave(d); return Promise.resolve(); },
    leaderboard: function (period) {
      var d = dcm(), since = period === "all" ? 0 : new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      var rows = DEMO_PEOPLE.map(function (u) { return { name: u.name, points: demoPoints(d, u.id, since) + (period === "all" ? u.all : u.month), is_me: false }; });
      if (!isTeam()) rows.push({ name: "Demo M.", points: demoPoints(d, "me", since), is_me: true });
      rows.sort(function (a, b) { return b.points - a.points; });
      var pos = 0, prev = null; rows.forEach(function (r, i) { if (r.points !== prev) pos = i + 1; prev = r.points; r.pos = pos; });
      return Promise.resolve(rows.filter(function (r) { return r.points > 0 || r.is_me; }));
    },
  };

  /* ---------- auth screens ---------- */
  var brand = '<a class="brand" href="/" aria-label="PROVIDETECH home"><img src="/assets/logo-mark.png" alt=""><img class="word" src="/assets/logo-word.png" alt="PROVIDETECH AI Assistance"></a>';
  function pwField(id, label, auto, hint) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><div class="pw"><input class="input" id="' + id + '" name="' + id + '" type="password" autocomplete="' + auto + '" required><button type="button" data-show="' + id + '" aria-label="' + T("Show password") + '">' + T("Show") + '</button></div>' + (hint ? "<small>" + esc(hint) + "</small>" : "") + "</div>";
  }
  function bindShow(root) {
    [].forEach.call(root.querySelectorAll("[data-show]"), function (b) {
      b.addEventListener("click", function () { var i = document.getElementById(b.getAttribute("data-show")); var show = i.type === "password"; i.type = show ? "text" : "password"; b.textContent = show ? T("Hide") : T("Show"); b.setAttribute("aria-label", show ? T("Hide password") : T("Show password")); });
    });
  }
  function authPage(inner) { app.innerHTML = '<main class="auth"><div class="auth-lang">' + langPicker() + '</div><div class="auth-card">' + brand + inner + "</div></main>"; bindShow(app); var f = app.querySelector("input"); if (f) f.focus(); }
  function busy(form, on) { var b = form.querySelector("button[type=submit]"); if (b) { b.disabled = on; b.setAttribute("aria-busy", on ? "true" : "false"); } }
  function showErr(form, msg) { var e = form.querySelector(".form-error"); e.textContent = msg; e.hidden = !msg; }

  function renderLogin(msg) {
    authPage('<div><h1>' + T("Builder Hub sign in") + '</h1><p class="sub">' + T("Welcome back. Use the email you paid with.") + '</p></div>' +
      (LIVE ? "" : '<p class="form-ok">Demo mode: sign in with <b>member@providetech.demo</b> and <b>demo1234</b>. To try moderation, use <b>team@providetech.demo</b>.</p>') +
      (msg ? '<p class="form-ok">' + esc(msg) + "</p>" : "") +
      '<form id="f" class="field" style="gap:16px" novalidate><div class="field"><label for="em">' + T("Email") + '</label><input class="input" id="em" type="email" autocomplete="username" required' + (LIVE ? "" : ' value="member@providetech.demo"') + "></div>" +
      pwField("pw", T("Password"), "current-password") +
      '<p class="form-error" role="alert" hidden></p><button class="btn btn-p" type="submit">' + T("Sign in") + '</button></form>' +
      '<div class="auth-links"><a href="#/forgot">' + T("Forgot password?") + '</a><a href="/">' + T("← Back to website") + '</a></div>' +
      '<p class="spam-tip">' + T("Waiting for your access email? In Gmail, check <b>Spam</b> and the <b>Promotions</b> tab, or search for <b>PROVIDETECH</b>. If it's in Spam, open it and tap <b>Report not spam</b>.") + '</p>');
    var f = document.getElementById("f");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var em = document.getElementById("em").value, pw = document.getElementById("pw").value;
      if (!em || !pw) return showErr(f, T("Enter your email and password."));
      busy(f, true); showErr(f, "");
      api.signIn(em, pw).then(function (s) { busy(f, false); setSession(s); S.c = null; go(""); }, function (er) { busy(f, false); showErr(f, er.message); });
    });
  }
  function renderForgot() {
    authPage('<div><h1>' + T("Reset your password") + '</h1><p class="sub">' + T("Enter the email you paid with. If it has Builder Hub access, we'll email you a reset link that works for 1 hour.") + '</p></div>' +
      '<form id="f" class="field" style="gap:16px" novalidate><div class="field"><label for="em">' + T("Email") + '</label><input class="input" id="em" type="email" autocomplete="email" required></div>' +
      '<p class="form-error" role="alert" hidden></p><button class="btn btn-p" type="submit">' + T("Email me a reset link") + '</button></form>' +
      '<div class="auth-links"><a href="#/login">' + T("← Back to sign in") + '</a></div>');
    var f = document.getElementById("f");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var em = document.getElementById("em").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return showErr(f, T("Enter a valid email address."));
      busy(f, true); showErr(f, "");
      api.forgot(em).then(function () {
        f.outerHTML = '<p class="form-ok">' + T("Check your inbox. If <b>{email}</b> has Builder Hub access, a reset link is on its way. Look in Spam or Promotions too.", { email: esc(em) }) + "</p>";
      }, function (er) { busy(f, false); showErr(f, er.message); });
    });
  }
  function renderSetPassword(token) {
    authPage('<div><h1>' + T("Set your password") + '</h1><p class="sub">' + T("Checking your link…") + '</p></div>');
    if (!token) return authPage('<div><h1>' + T("Link missing") + '</h1><p class="sub">' + T("Open the button in your access email again, or ask for a new link.") + '</p></div><a class="btn btn-p" href="#/forgot">' + T("Send me a new link") + '</a>');
    api.checkToken(token).then(function (t) {
      authPage('<div><h1>' + (t.purpose === "reset" ? T("Choose a new password") : T("Set your password")) + '</h1><p class="sub">' + T("For <b>{email}</b>. You'll use this to sign in to the Builder Hub.", { email: esc(t.email) }) + "</p></div>" +
        '<form id="f" class="field" style="gap:16px" novalidate>' + pwField("pw", T("New password"), "new-password", T("At least 8 characters.")) + pwField("pw2", T("Type it again"), "new-password") +
        '<p class="form-error" role="alert" hidden></p><button class="btn btn-p" type="submit">' + T("Save password and enter") + '</button></form>');
      var f = document.getElementById("f");
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var a = document.getElementById("pw").value, b = document.getElementById("pw2").value;
        if (a.length < 8) return showErr(f, T("Use at least 8 characters."));
        if (a !== b) return showErr(f, T("The two passwords don't match."));
        busy(f, true); showErr(f, "");
        api.setPassword(token, a).then(function (r) {
          history.replaceState(null, "", location.pathname + "#/login");
          return api.signIn(r.email, a).then(function (s) { setSession(s); go(""); });
        }).catch(function (er) { busy(f, false); showErr(f, er.message); });
      });
    }, function (er) {
      authPage('<div><h1>' + T("This link has expired") + '</h1><p class="sub">' + esc(er.message) + '</p></div><a class="btn btn-p" href="#/forgot">' + T("Send me a new link") + '</a><div class="auth-links"><a href="#/login">' + T("← Back to sign in") + '</a></div>');
    });
  }

  /* ---------- member area ---------- */
  function setSession(s) {
    S.user = s && s.user || null; S.member = s && s.member || null;
    S.c = null; S.feed = {}; S.posts = {}; S.lb = {}; S.channels = null; S.draft = ""; S.cdraft = {}; S.editing = null; S.confirm = null;
  }
  function active() { return S.member && new Date(S.member.access_until) > new Date(); }

  function shell(path, content) {
    var m = S.member || {};
    var nav = NAV.map(function (n) {
      return '<a href="#/' + n[0] + '"' + (path === n[0] ? ' aria-current="page"' : "") + (n[3] ? ' class="is-soon"' : "") + ">" + ic(n[1]) + "<span>" + esc(T(n[2])) + "</span>" + (n[3] ? '<span class="pill soon">' + T("Soon") + "</span>" : "") + "</a>";
    }).join("");
    var title = T((NAV.filter(function (n) { return n[0] === path; })[0] || NAV[0])[2]);
    return '<div class="shell' + (S.menu ? " open" : "") + '"><aside class="side" aria-label="Hub menu">' + brand +
      '<div class="side-title"><b>Builder Hub</b><span>' + T("Member workspace") + '</span></div><nav class="nav">' + nav + "</nav>" +
      '<div class="me"><span class="av">' + esc(initials(m.name || m.email)) + '</span><span style="min-width:0"><b>' + esc(m.name || first(m.email)) + "</b><small>" + (m.team ? T("Team account") : "Lv " + level(m.points) + " · " + (m.points || 0) + " pts") + '</small></span><button class="out" data-act="signout">' + T("Sign out") + '</button></div></aside>' +
      '<div class="scrim" data-act="menu"></div><main class="main"><div class="top"><button class="menu-btn" data-act="menu" aria-label="Open menu">' + ic("menu") + '</button><span class="crumb">Builder Hub / <b>' + esc(title) + '</b></span><span class="stats">' + (m.team ? '<span class="chip">' + T("Team") + '</span>' : '<a class="chip" href="#/leaderboard"><b>' + (m.points || 0) + '</b> pts</a><span class="chip">Lv <b>' + level(m.points) + "</b>&nbsp;" + esc(levelName(m.points)) + "</span>") + '' + langPicker() + '<a class="chip" href="/">' + T("Main website ↗") + '</a></span></div>' + content + "</main></div>";
  }
  function viewHome() {
    var m = S.member;
    var counts = { replays: C().replays.length, learning: C().courses.filter(function (c) { return c.slug !== "prompt-library"; }).length, prompts: C().prompts.length };
    var unit = { replays: ["{n} replay", "{n} replays"], learning: ["{n} course", "{n} courses"], prompts: ["{n} prompt", "{n} prompts"] };
    var tiles = NAV.slice(1, 6).map(function (n) {
      var cnt = counts[n[0]];
      return '<a class="card tile" href="#/' + n[0] + '"><span class="ic">' + ic(n[1], 20) + "</span><h3>" + esc(T(n[2])) + "</h3><p>" + esc(T(PAGES[n[0]][2].split(". ")[0] + ".")) + "</p>" + (cnt ? '<span class="muted" style="font-size:13px">' + esc(T(unit[n[0]][cnt === 1 ? 0 : 1], { n: cnt })) + "</span>" : "") + "</a>";
    }).join("");
    var cont = null;
    C().courses.some(function (c) { var nx = lessonsOf(c.id).filter(function (l) { return !C().done[l.id]; })[0]; if (nx && progress(c.id).done) { cont = { c: c, l: nx }; return true; } return false; });
    if (!cont && C().courses.length) { var c0 = C().courses[0], l0 = lessonsOf(c0.id).filter(function (l) { return !C().done[l.id]; })[0]; if (l0) cont = { c: c0, l: l0 }; }
    var contCard = cont ? '<a class="card continue" href="' + (cont.c.slug === "prompt-library" ? "#/prompts/" : "#/learning/" + esc(cont.c.id) + "/") + esc(cont.l.id) + '"><span class="ic">' + ic("book", 20) + '</span><span style="min-width:0"><span class="mono-label">' + (progress(cont.c.id).done ? T("Continue learning") : T("Start here")) + "</span><b>" + esc(loc(cont.l, "title")) + '</b><small class="muted">' + esc(loc(cont.c, "title")) + " · " + T("{n}% done", { n: progress(cont.c.id).pct }) + '</small></span><span class="go">→</span></a>' : "";
    return '<section class="card hero"><span class="mono-label">' + T("Member workspace") + "</span><h1>" + T("Welcome, {name}.", { name: esc(first(m.name || m.email)) }) + "</h1><p>" + T("Your PROVIDETECH Builder Hub: recordings, step-by-step tutorials, prompts and a community of builders. New content is added every month.") + "</p>" +
      (m.team ? '<span class="until">' + T("Signed in as the PROVIDETECH Team") + "</span>" : '<span class="until">' + T("Access until {date}", { date: esc(fmtDate(m.access_until)) }) + "</span>") + "</section>" +
      contCard + '<div class="grid cols3">' + tiles + "</div>";
  }
  function bar(pct) { return '<div class="prog" aria-hidden="true"><span style="width:' + pct + '%"></span></div>'; }
  function emptyState(icon, title, msg) { return '<section class="card empty" style="margin-top:22px"><span class="ic">' + ic(icon, 26) + "</span><h2>" + esc(T(title)) + "</h2><p>" + esc(T(msg)) + "</p></section>"; }
  function viewReplays(id) {
    var rs = C().replays;
    if (id) {
      var r = rs.filter(function (x) { return x.id === id; })[0];
      if (!r) return emptyState("play", "Replay not found", "It may have been moved. Go back to Replays.");
      return '<a class="back" href="#/replays">' + T("← All replays") + '</a><header class="page-head"><h1>' + esc(r.title) + '</h1><p>' + esc([r.recorded_on ? fmtDate(r.recorded_on + "T12:00:00") : "", mins(r.duration_min)].filter(Boolean).join(" · ")) + "</p></header>" +
        '<div class="watch">' + player(r.video_url, r.title) + (r.description ? '<section class="card">' + text(r.description) + "</section>" : "") + "</div>";
    }
    var head = '<header class="page-head"><h1>' + T("Replays") + "</h1><p>" + T("Every past live build, recorded end to end. Watch at your own pace.") + "</p></header>";
    if (!rs.length) return head + emptyState("play", "First recordings coming soon", "Replays of past live builds will appear here. Your membership already includes them.");
    return head + '<div class="grid cols3">' + rs.map(function (r) {
      return '<a class="card tile media" href="#/replays/' + esc(r.id) + '"><span class="thumb">' + ic("play", 30) + (r.duration_min ? '<span class="dur">' + esc(mins(r.duration_min)) + "</span>" : "") + "</span><h3>" + esc(r.title) + "</h3><p>" + esc(r.recorded_on ? fmtDate(r.recorded_on + "T12:00:00") : (r.description || "").slice(0, 90)) + "</p></a>";
    }).join("") + "</div>";
  }
  /* ---------- courses: outline + lesson pages (shared by Learning and Prompt Library) ---------- */
  function libCourse() { return C().courses.filter(function (c) { return c.slug === "prompt-library"; })[0] || null; }
  /* Course text in the picked language (Tagalog / Bisaya), falling back to English. The Prompt Library stays in English. */
  function loc(o, f) {
    if (!o) return "";
    if (LANG === "en") return o[f];
    var lib = libCourse();
    if (lib && (o.id === lib.id || o.course_id === lib.id)) return o[f];
    return o[f + "_" + LANG] || o[f];
  }
  function sectionsOf(cid) {
    var out = [], idx = {};
    lessonsOf(cid).forEach(function (l) { var k = l.section || ""; if (!(k in idx)) { idx[k] = out.length; out.push({ name: k, lessons: [] }); } out[idx[k]].lessons.push(l); });
    return out;
  }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function courseOutline(c, base) {
    var pr = progress(c.id), secs = sectionsOf(c.id), named = secs.some(function (x) { return x.name; }), n = 0;
    var firstOpen = lessonsOf(c.id).filter(function (x) { return !C().done[x.id]; })[0] || lessonsOf(c.id)[0];
    return '<section class="card outline"><div class="prog-row"><span><b>' + pr.done + "/" + pr.total + "</b> " + T("lessons") + " · " + pr.pct + "%</span>" +
      (firstOpen ? '<a class="btn btn-p" href="' + base + esc(firstOpen.id) + '">' + (pr.done ? T("Continue") : T("Start")) + " →</a>" : "") + "</div>" + bar(pr.pct) +
      secs.map(function (sec, si) {
        return '<div class="osec">' + (named ? '<div class="osec-h"><span class="onum">' + two(si + 1) + "</span><h2>" + esc(sec.name || T("Lessons")) + "</h2></div>" : "") +
          '<ol class="lessons">' + sec.lessons.map(function (l2) {
            n++; var d = !!C().done[l2.id];
            return '<li><a href="' + base + esc(l2.id) + '"><span class="ln' + (d ? " ok" : "") + '">' + (d ? "✓" : n) + '</span><span class="lt">' + esc(loc(l2, "title")) + "</span>" + (l2.duration_min ? '<span class="muted">' + esc(l2.duration_min + "m") + "</span>" : "") + "</a></li>";
          }).join("") + "</ol></div>";
      }).join("") + "</section>";
  }
  function lessonPage(c, lid, base, backHref, backLabel) {
    var ls = lessonsOf(c.id), i = -1; ls.forEach(function (x, k) { if (x.id === lid) i = k; });
    var l = ls[i];
    if (!l) return emptyState("book", "Lesson not found", "It may have been moved. Go back and pick another lesson.");
    var done = !!C().done[l.id], prev = ls[i - 1], next = ls[i + 1];
    var side = '<nav class="lnav" aria-label="' + T("Lessons") + '"><a class="back" href="' + backHref + '">← ' + esc(T(backLabel)) + "</a>" + sectionsOf(c.id).map(function (sec) {
      return (sec.name ? '<div class="lnav-h">' + esc(sec.name) + "</div>" : "") + sec.lessons.map(function (x) {
        return '<a class="lnav-i' + (x.id === l.id ? " on" : "") + (C().done[x.id] ? " ok" : "") + '" href="' + base + esc(x.id) + '"' + (x.id === l.id ? ' aria-current="page"' : "") + "><span>" + esc(loc(x, "title")) + "</span></a>";
      }).join("");
    }).join("") + "</nav>";
    var lbar = '<div class="lesson-bar"><button class="btn ' + (done ? "btn-g" : "btn-p") + '" data-act="done" data-id="' + esc(l.id) + '" data-on="' + (done ? "0" : "1") + '">' + (done ? T("✓ Completed · undo") : T("Mark as done")) + "</button>" +
      '<span class="nav-pn">' + (prev ? '<a class="btn btn-g" href="' + base + esc(prev.id) + '">' + T("← Previous") + "</a>" : "") + (next ? '<a class="btn btn-g" href="' + base + esc(next.id) + '">' + T("Next →") + "</a>" : "") + "</span></div>";
    return '<div class="lwrap">' + side + '<div class="lmain"><header class="page-head"><span class="mono-label">' + (l.section ? esc(l.section) + " · " : "") + T("Lesson {n} of {t}", { n: i + 1, t: ls.length }) + (l.duration_min ? " · " + esc(readTime(l.duration_min)) : "") + "</span><h1>" + esc(loc(l, "title")) + "</h1></header>" +
      '<div class="read"><article class="card lesson-body md">' + (l.description ? md(loc(l, "description")) : '<p class="muted">' + T("This lesson is being written.") + '</p>') + "</article>" + lbar + "</div></div></div>";
  }
  function viewLearning(cid, lid) {
    var lib = libCourse(), cs = C().courses.filter(function (c) { return c !== lib; });
    if (lib && cid === lib.id) { location.hash = "#/prompts" + (lid ? "/" + lid : ""); return ""; }
    var c = cs.filter(function (x) { return x.id === cid; })[0];
    if (cid && !c) return emptyState("book", "Course not found", "It may have been moved. Go back to Learning.");
    if (cid && lid) return lessonPage(c, lid, "#/learning/" + esc(c.id) + "/", "#/learning/" + esc(c.id), loc(c, "title"));
    if (cid) return '<a class="back" href="#/learning">' + T("← All courses") + '</a><header class="page-head"><h1>' + esc(loc(c, "title")) + "</h1>" + (c.description ? "<p>" + esc(loc(c, "description")) + "</p>" : "") + "</header>" + courseOutline(c, "#/learning/" + esc(c.id) + "/");
    var head = '<header class="page-head"><h1>' + T("Learning") + "</h1><p>" + T("Short, practical written lessons you can read in a few minutes. Mark lessons as done to track your progress.") + (LANG !== "en" ? " " + T("The prompts you copy stay in English, because Claude builds best that way.") : "") + "</p></header>";
    if (!cs.length) return head + emptyState("book", "First course coming soon", "Courses and lessons will appear here. New ones are added every month.");
    return head + '<div class="grid cols3">' + cs.map(function (c3) {
      var p3 = progress(c3.id), ls3 = lessonsOf(c3.id), total = ls3.reduce(function (t, x) { return t + (Number(x.duration_min) || 0); }, 0);
      return '<a class="card tile" href="#/learning/' + esc(c3.id) + '"><span class="ic">' + ic("book", 20) + "</span><h3>" + esc(loc(c3, "title")) + "</h3><p>" + esc(loc(c3, "description") || "") + '</p><span class="muted" style="font-size:13px">' + esc(T(p3.total === 1 ? "{n} lesson" : "{n} lessons", { n: p3.total })) + (total ? " · " + esc(readTime(total)) : "") + (p3.done ? " · " + esc(T("{n}% done", { n: p3.pct })) : "") + "</span>" + bar(p3.pct) + "</a>";
    }).join("") + "</div>";
  }
  var CAT_ORDER = ["Sales & Orders", "Inventory & Stock", "Staff & HR", "Bookings & Schedules", "Money & Finance", "Customers"];
  function viewPrompts(lid) {
    var lib = libCourse();
    if (lib && lid) return lessonPage(lib, lid, "#/prompts/", "#/prompts", "Prompt Library");
    var ps = C().prompts;
    var head = '<header class="page-head"><h1>' + T("Prompt Library") + "</h1><p>" + esc(T(lib && lib.description ? lib.description : "Copy-ready prompts for real business tasks. Replace the parts in [BRACKETS] with your own details.")) + "</p></header>";
    var outline = lib ? courseOutline(lib, "#/prompts/") : "";
    var nsec = lib ? sectionsOf(lib.id).filter(function (x) { return x.name; }).length : 0;
    var quickHead = '<div class="osec-h" style="margin-top:28px"><span class="onum">' + two(nsec + 1) + '</span><h2>' + T("Quick System Builds") + "</h2></div>" +
      '<p class="muted" style="margin:4px 0 0">' + T("One prompt = one working management app for your business. Pick the system you need, and Claude builds it for you in one go.") + "</p>" +
      '<ol class="howto"><li>' + T("<b>Copy</b> a prompt below") + "</li><li>" + T("<b>Paste</b> it into Claude (claude.ai or the Claude app)") + "</li><li>" + T("<b>Replace</b> the [BRACKETS] with your own details, then send") + "</li><li>" + T("<b>Use</b> the app Claude builds. Ask Claude for changes anytime, and export a backup every week") + "</li></ol>" +
      (LANG !== "en" ? '<p class="muted" style="margin:0 0 4px">' + T("Tip: the prompts are in English because Claude builds best that way. Want the explanations in your language? Add this line at the end: “Explain everything to me in Tagalog.”") + "</p>" : "");
    if (!ps.length) return head + outline + (lib ? "" : emptyState("prompt", "The library is being filled", "Prompts will appear here soon. Your membership already includes them."));
    var cats = ps.map(function (p) { return p.category; }).filter(function (c, i, a) { return a.indexOf(c) === i; })
      .sort(function (a, b) { var ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (a < b ? -1 : 1); });
    var q = S.pq.trim().toLowerCase();
    var list = ps.filter(function (p) { return (!S.pcat || p.category === S.pcat) && (!q || (p.title + " " + p.body + " " + p.category).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return (cats.indexOf(a.category) - cats.indexOf(b.category)) || ((a.sort || 0) - (b.sort || 0)); });
    return head + outline + (lib ? quickHead : "") + '<div class="pfilter"><div class="chips" role="group" aria-label="Filter by category"><button class="chip-btn" data-act="pcat" data-id="" aria-pressed="' + !S.pcat + '">' + T("All") + "</button>" +
      cats.map(function (c) { return '<button class="chip-btn" data-act="pcat" data-id="' + esc(c) + '" aria-pressed="' + (S.pcat === c) + '">' + esc(T(c)) + "</button>"; }).join("") + "</div>" +
      '<label class="psearch"><span class="sr-only">' + T("Search prompts") + '</span><input class="input" id="pq" type="search" placeholder="' + esc(T("Search systems (e.g. inventory, payroll)")) + '" value="' + esc(S.pq) + '"></label></div>' +
      (list.length ? '<div class="prompts">' + list.map(function (p) {
        return '<article class="card prompt"><div class="ptop"><span class="pill cat">' + esc(T(p.category)) + '</span><button class="btn btn-g btn-sm" data-act="copy" data-id="' + esc(p.id) + '">' + T("Copy") + '</button></div><h3>' + esc(p.title) + '</h3><pre class="pbody">' + esc(p.body) + '</pre></article>';
      }).join("") + "</div>" : '<p class="muted" style="margin-top:20px">' + T("No prompts match. Try another word or category.") + "</p>");
  }

  /* ---------- community ---------- */
  function me() { return S.user && S.user.id; }
  function isTeam() { return !!(S.member && S.member.team); }
  function chName(slug) { var c = (S.channels || DEMO_CHANNELS).filter(function (x) { return x.slug === slug; })[0]; return c ? T(c.name) : slug; }
  function loadFeed(ch, more) {
    var f = S.feed[ch];
    if (f && (f.loading || (!more && f.posts))) return;
    f = S.feed[ch] = f || { posts: null, more: false };
    f.loading = true; f.error = null;
    var chans = S.channels ? Promise.resolve(S.channels) : api.channels().then(function (c) { S.channels = c; return c; });
    chans.then(function () { return api.feed(ch, more && f.posts ? f.posts.length : 0); }).then(function (r) {
      f.posts = more && f.posts ? f.posts.concat(r.posts) : r.posts; f.more = r.more;
      r.posts.forEach(function (p) { if (S.posts[p.id]) S.posts[p.id].post = p; });
    }, function (e) { f.error = friendly(e); if (!f.posts) f.posts = []; }).then(function () { f.loading = false; if (more) S.keepScroll = true; render(); });
  }
  function loadPost(id) {
    var x = S.posts[id];
    if (x && (x.loading || x.loaded)) return;
    x = S.posts[id] = { loading: true };
    var chans = S.channels ? Promise.resolve(S.channels) : api.channels().then(function (c) { S.channels = c; return c; });
    chans.then(function () { return api.post(id); }).then(function (r) { x.post = r.post; x.comments = r.comments; }, function (e) { x.error = friendly(e); })
      .then(function () { x.loading = false; x.loaded = true; render(); });
  }
  function eachPost(id, fn) {
    Object.keys(S.feed).forEach(function (k) { (S.feed[k].posts || []).forEach(function (p, i, arr) { if (p.id === id) fn(arr, i); }); });
    var x = S.posts[id]; if (x && x.post) fn(null, -1, x);
  }
  function replacePost(np) {
    eachPost(np.id, function (arr, i, x) { if (arr) arr[i] = np; else x.post = np; });
  }
  function dropPost(id) {
    Object.keys(S.feed).forEach(function (k) { var f = S.feed[k]; if (f.posts) f.posts = f.posts.filter(function (p) { return p.id !== id; }); });
    delete S.posts[id];
  }
  function refreshPoints() {
    if (isTeam()) return;
    api.myPoints().then(function (p) { if (S.member && S.member.points !== p) { S.member.points = p; S.lb = {}; S.keepScroll = true; render(); } }, function () {});
  }
  function avatar(name, team, small) { return '<span class="av' + (small ? " sm" : "") + (team ? " team" : "") + '" aria-hidden="true">' + (team ? "PT" : esc(initials(name))) + "</span>"; }
  function postCard(p, full) {
    var mine = p.user_id === me(), mod = isTeam();
    var counts = {}, minev = {};
    (p.reactions || []).forEach(function (r) { counts[r.emoji] = (counts[r.emoji] || 0) + 1; if (r.user_id === me()) minev[r.emoji] = true; });
    var body = String(p.body || ""), cut = !full && body.length > 600;
    var opts = [];
    if (mine) opts.push('<button data-act="p-edit" data-id="' + esc(p.id) + '">' + T("Edit") + "</button>");
    if (mod) opts.push('<button data-act="p-pin" data-id="' + esc(p.id) + '" data-on="' + (p.pinned ? "0" : "1") + '">' + (p.pinned ? T("Unpin") : T("Pin to top")) + "</button>",
      '<button data-act="p-hide" data-id="' + esc(p.id) + '" data-on="' + (p.hidden ? "0" : "1") + '">' + (p.hidden ? T("Show to members") : T("Hide from members")) + "</button>");
    if (mine || mod) opts.push('<button class="danger" data-act="p-del" data-id="' + esc(p.id) + '">' + T("Delete…") + "</button>");
    var editing = S.editing === "p:" + p.id;
    return '<article class="card post' + (p.hidden ? " is-hidden" : "") + '" id="post-' + esc(p.id) + '"><header class="ph">' + avatar(p.author_name, p.author_team) +
      '<div class="who"><b>' + esc(p.author_name || T("Member")) + "</b>" + (p.author_team ? '<span class="pill team">' + T("Team") + "</span>" : "") +
      '<small class="muted"><a href="#/community/' + esc(p.channel) + '">#' + esc(chName(p.channel)) + "</a> · " + '<a href="#/community/post/' + esc(p.id) + '" title="' + esc(new Date(p.created_at).toLocaleString(LOC())) + '">' + esc(ago(p.created_at)) + "</a>" + (p.edited_at ? " · " + T("edited") : "") + "</small></div>" +
      (p.pinned ? '<span class="pill pin">' + T("Pinned") + "</span>" : "") + (p.hidden ? '<span class="pill hid">' + T("Hidden") + "</span>" : "") +
      (opts.length ? '<details class="more"><summary aria-label="' + T("Post options") + '">' + ic("dots") + '</summary><div class="menu">' + opts.join("") + "</div></details>" : "") + "</header>" +
      (S.confirm === "p:" + p.id ? '<div class="confirm" role="alert"><span>' + T("Delete this post and its comments? This can't be undone.") + '</span><button class="btn btn-sm btn-danger" data-act="p-del-yes" data-id="' + esc(p.id) + '">' + T("Delete") + '</button><button class="btn btn-sm btn-g" data-act="cancel">' + T("Keep it") + '</button></div>' : "") +
      (editing ? '<form class="edit" data-form="p-edit" data-id="' + esc(p.id) + '"><label class="sr-only" for="pe-' + esc(p.id) + '">' + T("Edit post") + '</label><textarea class="input" id="pe-' + esc(p.id) + '" rows="5" maxlength="5000">' + esc(body) + '</textarea><div class="row-end"><button type="button" class="btn btn-sm btn-g" data-act="cancel">' + T("Cancel") + '</button><button class="btn btn-sm btn-p" type="submit">' + T("Save") + '</button></div></form>'
        : '<div class="pb">' + text(cut ? body.slice(0, 600).replace(/\s+\S*$/, "") + "…" : body) + (cut ? '<a class="more-link" href="#/community/post/' + esc(p.id) + '">' + T("Read more") + "</a>" : "") + "</div>") +
      '<footer class="pf"><div class="reacts" role="group" aria-label="Reactions">' + EMOJIS.map(function (e) {
        return '<button class="react" data-act="react" data-id="' + esc(p.id) + '" data-e="' + e + '" aria-pressed="' + !!minev[e] + '" aria-label="React ' + e + (counts[e] ? ", " + counts[e] : "") + '"' + (p.hidden ? " disabled" : "") + "><span>" + e + "</span>" + (counts[e] ? "<b>" + counts[e] + "</b>" : "") + "</button>";
      }).join("") + "</div>" +
      (full ? "" : '<a class="cm-link" href="#/community/post/' + esc(p.id) + '">' + ic("chat", 16) + (p.ncomments ? T(p.ncomments === 1 ? "{n} comment" : "{n} comments", { n: p.ncomments }) : T("Comment")) + "</a>") + "</footer></article>";
  }
  function composer(ch) {
    var chans = S.channels || DEMO_CHANNELS, sel = ch !== "all" ? ch : (S.composeCh || "general");
    return '<form class="card composer" data-form="post" novalidate><div class="crow">' + avatar(S.member && S.member.name, isTeam()) +
      '<label class="sr-only" for="cbody">' + T("Write a post") + '</label><textarea class="input" id="cbody" rows="3" maxlength="5000" placeholder="' + esc(T(ch === "help" ? "What are you stuck on? Say what you tried." : ch === "wins" ? "Share a win, big or small." : ch === "builds" ? "What did you build? Add a link if you can." : "Share something with the community…")) + '">' + esc(S.draft) + "</textarea></div>" +
      '<div class="cfoot"><label class="chsel">' + T("Post in") + ' <select id="cch" class="input">' + chans.map(function (c) { return '<option value="' + esc(c.slug) + '"' + (c.slug === sel ? " selected" : "") + ">#" + esc(T(c.name)) + "</option>"; }).join("") + "</select></label>" +
      '<span class="cfoot-r"><small class="muted" id="ccount">' + (S.draft.length > 4500 ? T("{n} characters left", { n: 5000 - S.draft.length }) : "") + '</small><button class="btn btn-p" type="submit">' + T("Post") + '</button></span></div><p class="form-error" role="alert" hidden></p></form>';
  }
  function viewCommunity(a, b) {
    if (a === "post") return viewPost(b);
    var ch = a || "all", f = S.feed[ch];
    if (!f || (!f.posts && !f.error)) loadFeed(ch);
    var chans = S.channels || [];
    if (ch !== "all" && S.channels && !chans.some(function (c) { return c.slug === ch; })) return emptyState("chat", "Channel not found", "Pick a channel from the list.");
    var cur = chans.filter(function (c) { return c.slug === ch; })[0];
    var tabs = '<nav class="chips ch-tabs" aria-label="Channels"><a class="chip-btn" href="#/community" aria-current="' + (ch === "all" ? "page" : "false") + '">' + T("All") + "</a>" +
      chans.map(function (c) { return '<a class="chip-btn" href="#/community/' + esc(c.slug) + '" aria-current="' + (ch === c.slug ? "page" : "false") + '">#' + esc(T(c.name)) + "</a>"; }).join("") + "</nav>";
    var head = '<header class="page-head"><h1>' + T("Community") + "</h1><p>" + esc(T(cur ? cur.description : "Ask questions, share wins and show what you built. Be kind, be specific, help each other.")) + "</p></header>";
    var list;
    if (!f || !f.posts) list = '<div class="loading" style="height:30vh">' + T("Loading posts…") + "</div>";
    else if (!f.posts.length) list = f.error ? '<p class="notice" style="margin-top:16px">' + esc(f.error) + "</p>" : emptyState("chat", ch === "all" ? "Be the first to post" : T("Nothing in #{ch} yet", { ch: chName(ch) }), "Start the conversation. Every post earns you points on the leaderboard.");
    else list = '<div class="feed">' + f.posts.map(function (p) { return postCard(p, false); }).join("") + "</div>" +
      (f.more ? '<div class="row-center"><button class="btn btn-g" data-act="more" data-id="' + esc(ch) + '"' + (f.loading ? " disabled" : "") + ">" + (f.loading ? T("Loading…") : T("Load older posts")) + "</button></div>" : "");
    return head + tabs + composer(ch) + list;
  }
  function viewPost(id) {
    var x = S.posts[id];
    if (!x) { loadPost(id); x = S.posts[id]; }
    if (!x || x.loading) return '<div class="loading" style="height:40vh">' + T("Loading…") + "</div>";
    if (!x.post) return emptyState("chat", "Post not found", x.error || "It may have been removed. Go back to the community.");
    var p = x.post, mod = isTeam();
    var cs = (x.comments || []).map(function (c) {
      var mine = c.user_id === me(), editing = S.editing === "c:" + c.id;
      var acts = [];
      if (mine && !editing) acts.push('<button data-act="c-edit" data-id="' + esc(c.id) + '">' + T("Edit") + "</button>");
      if (mod) acts.push('<button data-act="c-hide" data-id="' + esc(c.id) + '" data-on="' + (c.hidden ? "0" : "1") + '">' + (c.hidden ? T("Show") : T("Hide")) + "</button>");
      if (mine || mod) acts.push(S.confirm === "c:" + c.id ? '<button class="danger" data-act="c-del-yes" data-id="' + esc(c.id) + '">' + T("Confirm delete") + '</button><button data-act="cancel">' + T("Cancel") + "</button>" : '<button class="danger" data-act="c-del" data-id="' + esc(c.id) + '">' + T("Delete") + "</button>");
      return '<li class="cmt' + (c.hidden ? " is-hidden" : "") + '">' + avatar(c.author_name, c.author_team, true) + '<div class="cmt-b"><div class="cmt-h"><b>' + esc(c.author_name || T("Member")) + "</b>" + (c.author_team ? '<span class="pill team">' + T("Team") + "</span>" : "") + (c.hidden ? '<span class="pill hid">' + T("Hidden") + "</span>" : "") + '<small class="muted">' + esc(ago(c.created_at)) + (c.edited_at ? " · " + T("edited") : "") + "</small></div>" +
        (editing ? '<form class="edit" data-form="c-edit" data-id="' + esc(c.id) + '"><label class="sr-only" for="ce-' + esc(c.id) + '">' + T("Edit comment") + '</label><textarea class="input" id="ce-' + esc(c.id) + '" rows="3" maxlength="2000">' + esc(c.body) + '</textarea><div class="row-end"><button type="button" class="btn btn-sm btn-g" data-act="cancel">' + T("Cancel") + '</button><button class="btn btn-sm btn-p" type="submit">' + T("Save") + '</button></div></form>' : text(c.body)) +
        (acts.length ? '<div class="cmt-a">' + acts.join("") + "</div>" : "") + "</div></li>";
    }).join("");
    var n = (x.comments || []).length;
    return '<a class="back" href="#/community/' + esc(p.channel) + '">← #' + esc(chName(p.channel)) + "</a>" + '<div class="thread">' + postCard(p, true) +
      '<section class="card comments" aria-label="' + T("Comments") + '"><h2>' + (n ? T(n === 1 ? "{n} comment" : "{n} comments", { n: n }) : T("No comments yet")) + "</h2>" +
      (n ? '<ol class="cmts">' + cs + "</ol>" : "") +
      (p.hidden ? '<p class="muted">' + T("Comments are closed on hidden posts.") + "</p>" :
        '<form class="cform" data-form="comment" data-id="' + esc(p.id) + '" novalidate>' + avatar(S.member && S.member.name, isTeam(), true) + '<label class="sr-only" for="cmt">' + T("Write a comment") + '</label><textarea class="input" id="cmt" rows="2" maxlength="2000" placeholder="' + esc(T(p.channel === "help" ? "Know the answer? Help them out." : "Write a comment…")) + '">' + esc(S.cdraft[p.id] || "") + '</textarea><button class="btn btn-p" type="submit">' + T("Reply") + '</button><p class="form-error" role="alert" hidden></p></form>') +
      "</section></div>";
  }

  /* ---------- leaderboard ---------- */
  function loadBoard(period) {
    if (S.lb[period]) return;
    S.lb[period] = { loading: true };
    api.leaderboard(period).then(function (rows) { S.lb[period] = { rows: rows }; }, function (e) { S.lb[period] = { rows: [], error: friendly(e) }; }).then(render);
  }
  function viewLeaderboard() {
    var per = S.lbp, b = S.lb[per];
    if (!b) { loadBoard(per); b = S.lb[per]; }
    var pts = (S.member && S.member.points) || 0, li = lvlIdx(pts), nx = LEVELS[li + 1];
    var head = '<header class="page-head"><h1>' + T("Leaderboard") + "</h1><p>" + T("Earn points by posting, helping other members and finishing lessons. The monthly ranking resets on the 1st.") + "</p></header>";
    var tabs = '<div class="chips" role="group" aria-label="Period" style="margin-top:20px"><button class="chip-btn" data-act="lbp" data-id="month" aria-pressed="' + (per === "month") + '">' + T("This month") + '</button><button class="chip-btn" data-act="lbp" data-id="all" aria-pressed="' + (per === "all") + '">' + T("All time") + "</button></div>";
    var mine = b && b.rows ? b.rows.filter(function (r) { return r.is_me; })[0] : null;
    var meCard = isTeam() ? '<section class="card me-card"><p class="muted">' + T("You're signed in as the PROVIDETECH Team, so you don't appear on the leaderboard.") + '</p></section>' :
      '<section class="card me-card"><div class="me-top">' + avatar(S.member.name, false) + '<div><span class="mono-label">' + T("Your level") + '</span><b class="lv">Lv ' + (li + 1) + " · " + esc(LEVELS[li][1]) + '</b><small class="muted">' + T("{n} points all time", { n: pts }) + (mine && mine.points ? " · " + T(per === "month" ? "#{n} this month" : "#{n} overall", { n: mine.pos }) : "") + "</small></div></div>" +
      (nx ? '<div class="nx"><div class="prog-row" style="margin:14px 0 8px"><small class="muted">' + T("{n} points to Lv {l}", { n: nx[0] - pts, l: li + 2 }) + " · " + esc(nx[1]) + "</small></div>" + bar(Math.round((pts - LEVELS[li][0]) / (nx[0] - LEVELS[li][0]) * 100)) + "</div>" : '<p class="muted" style="margin-top:12px">' + T("Top level reached. Legend.") + '</p>') + "</section>";
    var list;
    if (!b || b.loading) list = '<div class="loading" style="height:24vh">' + T("Loading…") + "</div>";
    else if (b.error) list = '<p class="notice">' + esc(b.error) + "</p>";
    else {
      var rows = b.rows.filter(function (r) { return r.points > 0; });
      list = rows.length ? '<ol class="board">' + rows.map(function (r) {
        return '<li class="' + (r.is_me ? "me" : "") + (r.pos <= 3 ? " top" + r.pos : "") + '"><span class="rk">' + (r.pos <= 3 ? ["🥇", "🥈", "🥉"][r.pos - 1] : r.pos) + "</span>" + avatar(r.name, false, true) + '<span class="nm">' + esc(r.name) + (r.is_me ? ' <small class="muted">(' + T("you") + ")</small>" : "") + '</span><span class="pt"><b>' + r.points + "</b> pts</span></li>";
      }).join("") + "</ol>" : '<p class="muted" style="padding:8px 0">' + T(per === "month" ? "No points yet this month. Post in the community or finish a lesson to get on the board." : "No points yet. Post in the community or finish a lesson to get on the board.") + "</p>";
    }
    var rules = '<section class="card"><h2>' + T("How to earn points") + '</h2><ul class="rules">' +
      "<li><b>+5</b><span>" + T("Post in the community") + ' <small class="muted">(' + T("first 5 posts a day") + ")</small></span></li>" +
      "<li><b>+3</b><span>" + T("Comment on another member's post") + ' <small class="muted">(' + T("first 10 a day") + ")</small></span></li>" +
      "<li><b>+1</b><span>" + T("Each member who reacts to your post") + "</span></li>" +
      "<li><b>+10</b><span>" + T("Finish a lesson in Learning") + "</span></li></ul>" +
      '<p class="muted" style="font-size:13px">' + T("Posts hidden by the team stop counting.") + "</p></section>" +
      '<section class="card"><h2>' + T("Levels") + '</h2><ol class="levels">' + LEVELS.map(function (l, k) { return '<li' + (k === li && !isTeam() ? ' class="cur"' : "") + "><span>Lv " + (k + 1) + " · " + esc(l[1]) + "</span><small class=\"muted\">" + l[0] + "+ pts</small></li>"; }).join("") + "</ol></section>";
    return head + '<div class="lb-grid"><div>' + tabs + '<section class="card" style="margin-top:14px">' + list + "</section></div><aside class=\"lb-side\">" + meCard + rules + "</aside></div>";
  }
  function viewSection(key) {
    var p = PAGES[key]; if (!p) return viewHome();
    var soon = NAV.some(function (n) { return n[0] === key && n[3]; });
    return '<header class="page-head"><h1>' + esc(p[1]) + "</h1><p>" + esc(p[2]) + "</p></header>" +
      '<section class="card empty" style="margin-top:22px"><span class="ic">' + ic(p[0], 26) + "</span><h2>" + (soon ? "Coming soon" : "Opening shortly") + "</h2><p>" +
      (soon ? "This part of the hub is planned. We'll email you when it opens." : "We're setting this up right now. Your membership already includes it, so it will appear here automatically.") + "</p></section>";
  }
  function viewExpired() {
    var m = S.member;
    return authPage('<div><h1>' + (m ? T("Your access has ended") : T("No Builder Hub access")) + '</h1><p class="sub">' +
      (m ? T("Your Builder Hub membership ended on {date}. Message us from the website to renew.", { date: esc(fmtDate(m.access_until)) }) : T("This account ({email}) doesn't have Builder Hub access yet. You get it by adding the Builder Hub when you reserve a workshop seat.", { email: esc(S.user && S.user.email) })) +
      '</p></div><a class="btn btn-p" href="/">' + T("Go to the website") + '</a><div class="auth-links"><button class="btn btn-g" data-act="signout" style="width:100%">' + T("Sign out") + "</button></div>");
  }

  function render() {
    var r = route();
    if (r.path === "set-password") return renderSetPassword(r.params.get("t"));
    if (r.path === "forgot") return renderForgot();
    if (!S.user) return r.path === "login" ? renderLogin() : (location.hash = "#/login", renderLogin());
    if (r.path === "login") return go("");
    if (!active()) return viewExpired();
    var parts = r.path.split("/"), key = parts[0];
    if (!S.c) { loadContent(); app.innerHTML = shell(key, '<div class="loading" style="height:50vh">' + T("Loading…") + "</div>"); return; }
    var view = !key ? viewHome() : key === "replays" ? viewReplays(parts[1]) : key === "learning" ? viewLearning(parts[1], parts[2]) : key === "prompts" ? viewPrompts(parts[1]) : key === "community" ? viewCommunity(parts[1], parts[2]) : key === "leaderboard" ? viewLeaderboard() : viewSection(key);
    var sy = S.keepScroll ? window.scrollY : 0;
    app.innerHTML = shell(key, view);
    restoreTicks(r.path);
    if (S.keepScroll) { window.scrollTo(0, sy); S.keepScroll = false; }
    if (S.focus) { var fe = document.getElementById(S.focus); if (fe) { fe.focus(); try { fe.setSelectionRange(fe.value.length, fe.value.length); } catch (e) {} } S.focus = null; }
    document.title = T(key ? PAGES[key] ? PAGES[key][1] : "Hub" : "Home") + " · Builder Hub";
  }

  // Lesson checklists: ticks are saved in this browser per lesson (no account data needed)
  function tickKey(path, el) { return "pt-ck:" + (S.user && S.user.id || "") + ":" + path + ":" + el.getAttribute("data-ck"); }
  function restoreTicks(path) {
    [].forEach.call(app.querySelectorAll("input[data-ck]"), function (el) {
      try { var v = localStorage.getItem(tickKey(path, el)); if (v !== null) el.checked = v === "1"; } catch (e) {}
    });
  }
  app.addEventListener("change", function (e) {
    var el = e.target; if (!el || !el.matches || !el.matches("input[data-ck]")) return;
    try { localStorage.setItem(tickKey(route().path, el), el.checked ? "1" : "0"); } catch (err) {}
  });
  app.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var a = t.getAttribute("data-act");
    if (a === "menu") { S.menu = !S.menu; render(); }
    if (a === "signout") api.signOut().then(function () { setSession(null); S.c = null; go("login"); });
    if (a === "pcat") { S.pcat = t.getAttribute("data-id"); render(); }
    if (a === "lbp") { S.lbp = t.getAttribute("data-id"); render(); }
    if (a === "more") loadFeed(t.getAttribute("data-id"), true);
    if (a === "cancel") { S.editing = null; S.confirm = null; S.keepScroll = true; render(); }
    if (a === "p-edit" || a === "c-edit") { S.editing = (a === "p-edit" ? "p:" : "c:") + t.getAttribute("data-id"); S.confirm = null; S.keepScroll = true; render(); var ta = document.getElementById((a === "p-edit" ? "pe-" : "ce-") + t.getAttribute("data-id")); if (ta) ta.focus(); }
    if (a === "p-del" || a === "c-del") { S.confirm = (a === "p-del" ? "p:" : "c:") + t.getAttribute("data-id"); S.editing = null; S.keepScroll = true; render(); }
    if (a === "p-del-yes") {
      var pid = t.getAttribute("data-id"); t.disabled = true;
      var back = S.posts[pid] && S.posts[pid].post ? S.posts[pid].post.channel : null, onPost = route().path.indexOf("community/post/") === 0;
      api.removePost(pid).then(function () { dropPost(pid); S.confirm = null; alertMsg(T("Post deleted.")); if (onPost) go("community/" + (back || "")); else { S.keepScroll = true; render(); } refreshPoints(); },
        function (er) { t.disabled = false; alertMsg(friendly(er)); });
    }
    if (a === "p-pin" || a === "p-hide") {
      var patch = {}; patch[a === "p-pin" ? "pinned" : "hidden"] = t.getAttribute("data-on") === "1";
      api.flagPost(t.getAttribute("data-id"), patch).then(function (np) {
        replacePost(np);
        if (a === "p-pin") Object.keys(S.feed).forEach(function (k) { var f = S.feed[k]; if (f.posts) f.posts.sort(function (x, y) { return (y.pinned - x.pinned) || (x.created_at < y.created_at ? 1 : -1); }); });
        alertMsg(T(a === "p-pin" ? (np.pinned ? "Pinned to the top." : "Unpinned.") : (np.hidden ? "Hidden from members." : "Visible to members again.")));
        S.keepScroll = true; render();
      }, function (er) { alertMsg(friendly(er)); });
    }
    if (a === "c-hide" || a === "c-del-yes") {
      var cid = t.getAttribute("data-id"), hp = route().path.split("/")[2], xp = S.posts[hp];
      var op = a === "c-hide" ? api.flagComment(cid, { hidden: t.getAttribute("data-on") === "1" }) : api.removeComment(cid);
      t.disabled = true;
      op.then(function (nc) {
        if (!xp) return;
        if (a === "c-hide") xp.comments = xp.comments.map(function (c) { return c.id === cid ? nc : c; });
        else { xp.comments = xp.comments.filter(function (c) { return c.id !== cid; }); eachPost(hp, function (arr, i, x2) { var pp = arr ? arr[i] : x2.post; pp.ncomments = Math.max(0, (pp.ncomments || 0) - 1); }); }
        S.confirm = null; S.keepScroll = true; render(); refreshPoints();
      }, function (er) { t.disabled = false; alertMsg(friendly(er)); });
    }
    if (a === "react") {
      var rid = t.getAttribute("data-id"), em = t.getAttribute("data-e"), on2 = t.getAttribute("aria-pressed") !== "true";
      function toggle(add) { eachPost(rid, function (arr, i, x3) { var pp = arr ? arr[i] : x3.post; pp.reactions = (pp.reactions || []).filter(function (r) { return !(r.user_id === me() && r.emoji === em); }); if (add) pp.reactions.push({ emoji: em, user_id: me() }); }); S.keepScroll = true; render(); }
      toggle(on2);
      api.react(rid, em, on2).catch(function (er) { toggle(!on2); alertMsg(friendly(er)); });
    }

    if (a === "done") {
      var id = t.getAttribute("data-id"), on = t.getAttribute("data-on") === "1";
      t.disabled = true;
      api.setDone(id, on).then(function () { if (on) S.c.done[id] = new Date().toISOString(); else delete S.c.done[id]; S.keepScroll = true; render(); refreshPoints(); },
        function (er) { t.disabled = false; alertMsg(er.message || T("Couldn't save. Try again.")); });
    }
    if (a === "copy-block") {
      var pre = t.parentNode.querySelector("pre"), txt = pre ? pre.textContent : "";
      var okB = function () { t.textContent = T("Copied ✓"); setTimeout(function () { t.textContent = T("Copy"); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(okB, function () { fallbackCopy(txt); okB(); });
      else { fallbackCopy(txt); okB(); }
    }
    if (a === "copy") {
      var p = C().prompts.filter(function (x) { return x.id === t.getAttribute("data-id"); })[0]; if (!p) return;
      var okFn = function () { t.textContent = T("Copied ✓"); setTimeout(function () { t.textContent = T("Copy"); }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p.body).then(okFn, function () { fallbackCopy(p.body); okFn(); });
      else { fallbackCopy(p.body); okFn(); }
    }
  });
  app.addEventListener("input", function (e) {
    var id = e.target.id;
    if (id === "pq") { S.pq = e.target.value; S.focus = "pq"; render(); }
    if (id === "cbody") { S.draft = e.target.value; var cc = document.getElementById("ccount"); if (cc) cc.textContent = S.draft.length > 4500 ? T("{n} characters left", { n: 5000 - S.draft.length }) : ""; }
    if (id === "cmt") { var f0 = e.target.closest("form"); if (f0) S.cdraft[f0.getAttribute("data-id")] = e.target.value; }
  });
  app.addEventListener("change", function (e) { if (e.target.id === "cch") S.composeCh = e.target.value; if (e.target.id === "hub-lang") setLang(e.target.value); });
  app.addEventListener("submit", function (e) {
    var f = e.target, kind = f.getAttribute("data-form"); if (!kind) return;
    e.preventDefault();
    var ta = f.querySelector("textarea"), body = ta ? ta.value.trim() : "", id = f.getAttribute("data-id"), err = f.querySelector(".form-error");
    function bad(m) { if (err) { err.textContent = m; err.hidden = false; } else alertMsg(m); }
    if (!body) return bad(T(kind === "comment" ? "Write something first." : "Your post is empty."));
    busy(f, true);
    if (kind === "post") {
      var ch = document.getElementById("cch").value;
      api.createPost(ch, body).then(function (np) {
        S.draft = ""; S.composeCh = ch;
        ["all", ch].forEach(function (k) { var fd = S.feed[k]; if (fd && fd.posts) { var i = 0; while (i < fd.posts.length && fd.posts[i].pinned) i++; fd.posts.splice(i, 0, np); } });
        alertMsg(route().path === "community" || route().path === "community/" + ch ? T("Posted. +5 points") : T("Posted in #{ch}. +5 points", { ch: chName(ch) }));
        S.keepScroll = true; render(); refreshPoints();
      }, function (er) { busy(f, false); bad(friendly(er)); });
    }
    if (kind === "comment") {
      api.comment(id, body).then(function (c) {
        var x = S.posts[id]; if (x) x.comments = (x.comments || []).concat([c]);
        eachPost(id, function (arr, i, x2) { var pp = arr ? arr[i] : x2.post; pp.ncomments = (pp.ncomments || 0) + 1; });
        S.cdraft[id] = ""; S.keepScroll = true; render(); refreshPoints();
      }, function (er) { busy(f, false); bad(friendly(er)); });
    }
    if (kind === "p-edit") api.editPost(id, body).then(function (np) { replacePost(np); S.editing = null; S.keepScroll = true; render(); }, function (er) { busy(f, false); bad(friendly(er)); });
    if (kind === "c-edit") {
      api.flagComment(id, { body: body }).then(function (nc) {
        Object.keys(S.posts).forEach(function (k) { var x = S.posts[k]; if (x.comments) x.comments = x.comments.map(function (c) { return c.id === id ? nc : c; }); });
        S.editing = null; S.keepScroll = true; render();
      }, function (er) { busy(f, false); bad(friendly(er)); });
    }
  });
  function fallbackCopy(txt) { var ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} document.body.removeChild(ta); }
  function alertMsg(m) { var d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = m; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500); }
  window.addEventListener("hashchange", function () { S.menu = false; render(); });

  ready().then(api.session).then(function (s) { setSession(s); render(); }).catch(function (e) {
    app.innerHTML = '<main class="auth"><div class="auth-card">' + brand + '<p class="form-error">' + esc(e.message || T("Couldn't load the hub.")) + "</p></div></main>";
  });
})();
