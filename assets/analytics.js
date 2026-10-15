/* Anonymous first-party funnel events. No payment events or personal form fields. */
(function () {
  'use strict';
  var w = window, nav = w.navigator || {}, cfg = w.PROVIDETECH_CONFIG || {};
  var blocked = nav.globalPrivacyControl === true || nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || w.doNotTrack === '1';
  var state = null, visitor = null, fields = ['source', 'medium', 'campaign', 'content', 'term'];
  var pixelId = /^\d{5,20}$/.test(cfg.metaPixelId || '') ? cfg.metaPixelId : null;
  function pixel(name, data, id) {
    try { if (!blocked && pixelId && w.fbq) w.fbq('track', name, data || {}, id ? { eventID: id } : {}); } catch (e) {}
  }
  if (!blocked && pixelId) {
    try {
      if (!w.fbq) {
        var fb = function () { if (fb.callMethod) fb.callMethod.apply(fb, arguments); else fb.queue.push(arguments); };
        fb.queue = []; fb.loaded = true; fb.version = '2.0'; fb.push = fb; w.fbq = fb; w._fbq = fb;
        var script = document.createElement('script'); script.async = true; script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(script);
      }
      w.fbq('init', pixelId);
    } catch (e) {}
  }
  function read(key) { try { return w.localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) { try { w.localStorage.setItem(key, value); } catch (e) {} }
  function tag(v) {
    v = String(v || '').trim();
    if (!v || /[{}@]|https?:|www\.|[\r\n]/i.test(v)) return null;
    return v.replace(/[^a-zA-Z0-9 _.:\-]/g, '').slice(0, 100) || null;
  }
  function source(v) {
    v = tag(v); if (!v) return null;
    v = v.toLowerCase();
    if (/^(fb|facebook|(?:[lmw]+\.)?facebook\.com|fb\.com|messenger)$/.test(v)) return 'facebook';
    if (/^(ig|instagram|(?:www\.)?instagram\.com)$/.test(v)) return 'instagram';
    return v;
  }
  function uuid() {
    if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  }
  if (!blocked) {
    visitor = read('pt-visitor-id');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitor || '')) { visitor = uuid(); write('pt-visitor-id', visitor); }
    try { state = JSON.parse(read('pt-attribution-v1')); } catch (e) {}
    if (!state || !state.expires_at || state.expires_at <= Date.now()) state = null;
    var params = new URLSearchParams(w.location.search), fresh = {}, tagged = false;
    fields.forEach(function (f) { fresh['utm_' + f] = f === 'source' ? source(params.get('utm_' + f)) : tag(params.get('utm_' + f)); if (fresh['utm_' + f]) tagged = true; });
    if (tagged) { fresh.attribution_at = new Date().toISOString(); fresh.expires_at = Date.now() + 30 * 86400000; state = fresh; write('pt-attribution-v1', JSON.stringify(state)); }
  }
  function context() {
    if (blocked) return null;
    var out = { visitor_id: visitor, attribution_at: state ? state.attribution_at : null };
    fields.forEach(function (f) { out['utm_' + f] = state ? (f === 'source' ? source(state['utm_' + f]) : tag(state['utm_' + f])) : null; });
    return out;
  }
  function track(event) {
    try {
      var names = { page_view: 'PageView', packages_view: 'ViewContent', package_click: 'AddToCart', checkout_start: 'InitiateCheckout', lead: 'Lead', contact: 'Contact' };
      if (names[event]) pixel(names[event]);
      if (blocked || ['page_view', 'packages_view', 'package_click', 'checkout_start', 'lead', 'contact'].indexOf(event) < 0 || !cfg.supabaseUrl || !cfg.supabaseAnonKey || !w.fetch) return Promise.resolve();
      var c = context(), ref = null;
      try { ref = document.referrer ? new URL(document.referrer).hostname : null; } catch (e) {}
      var path = w.location.pathname;
      // Public page allowlist keeps arbitrary URL path segments out of analytics.
      if (!/^\/(?:index\.html|checkout(?:\.html)?|privacy(?:\.html)?|terms(?:\.html)?)?$/.test(path)) path = '/';
      var body = { p_visitor: c.visitor_id, p_event: event, p_path: path, p_referrer: ref, p_attribution_at: c.attribution_at };
      fields.forEach(function (f) { body['p_' + f] = c['utm_' + f]; });
      return Promise.resolve(w.fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/track_site_event', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey }, body: JSON.stringify(body), keepalive: true })).catch(function () {});
    } catch (e) { return Promise.resolve(); }
  }
  function booking(id) { pixel('AddPaymentInfo', {}, id); }
  function purchase(id) {
    if (blocked || !pixelId || !id || !visitor || read('pt-purchase-' + id) || !cfg.supabaseUrl || !w.fetch) return Promise.resolve(false);
    try {
      return w.fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/analytics_payment_status', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + cfg.supabaseAnonKey },
        body: JSON.stringify({ p_order: id, p_visitor: visitor })
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (r) {
        if (!r || !r.paid || !(Number(r.value) > 0) || read('pt-purchase-' + r.order_id)) return false;
        pixel('Purchase', { value: Number(r.value), currency: 'PHP' }, r.order_id);
        write('pt-purchase-' + r.order_id, '1'); write('pt-purchase-' + id, '1'); return true;
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  w.PTAnalytics = { context: context, track: track, booking: booking, purchase: purchase };
  function start() {
    if (blocked) return;
    track('page_view');
    if (/^\/checkout(?:\.html)?$/.test(w.location.pathname) && new URLSearchParams(w.location.search).get('paid') !== '1') track('checkout_start');
    var section = document.getElementById('workshops');
    if (section && w.IntersectionObserver) {
      var observer = new w.IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) { track('packages_view'); observer.disconnect(); } }, { threshold: 0.15 }); observer.observe(section);
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
      try { var url = new URL(a.href, w.location.href); if (url.origin === w.location.origin && /^\/checkout(?:\.html)?$/.test(url.pathname)) track('package_click'); else if (/^(mailto:|tel:)/.test(a.href)) track('contact'); } catch (err) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
