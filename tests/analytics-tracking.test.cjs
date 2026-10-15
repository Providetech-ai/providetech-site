const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function visit(search = '', storage = new Map(), opts = {}) {
  const requests = [];
  const handlers = {};
  const document = { readyState: 'loading', referrer: opts.referrer || '', getElementById() { return null; }, addEventListener(name, fn) { handlers[name] = fn; } };
  const window = { navigator: opts.navigator || {}, location: { search, pathname: opts.path || '/checkout.html' }, crypto: require('node:crypto').webcrypto,
    PROVIDETECH_CONFIG: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public' },
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    fetch: (url, options) => { if(opts.failFetch)throw new Error('offline'); requests.push(JSON.parse(options.body)); return Promise.resolve({ok:true}); } };
  vm.runInNewContext(fs.existsSync('assets/analytics.js') ? fs.readFileSync('assets/analytics.js','utf8') : '', { window, document, URL, URLSearchParams, Date, Promise, Math });
  return { api: window.PTAnalytics, requests, storage, handlers };
}
test('last tagged visit persists through direct navigation and replaces earlier attribution', () => {
  const a = visit('?utm_source=fb&utm_medium=paid_social&utm_campaign=Launch');
  assert.ok(a.api, 'public tracker exists');
  assert.equal(a.api.context().utm_source, 'facebook');
  const b = visit('', a.storage);
  assert.equal(b.api.context().visitor_id, a.api.context().visitor_id);
  assert.equal(b.api.context().utm_campaign, 'Launch');
  const c = visit('?utm_source=instagram&utm_campaign=New', a.storage);
  assert.equal(c.api.context().utm_campaign, 'New');
  assert.equal(c.api.context().utm_medium, null);
});
test('checkout load records its funnel entry without a purchase event', () => {
  const a = visit();
  a.handlers.DOMContentLoaded();
  assert.deepEqual(a.requests.map(x=>x.p_event),['page_view','checkout_start']);
});
test('payment return does not count as a new checkout start', () => {
  const a = visit('?paid=1');
  a.handlers.DOMContentLoaded();
  assert.deepEqual(a.requests.map(x=>x.p_event),['page_view']);
});
test('offline tracking resolves without disrupting booking', async () => {
  const a = visit('',new Map(),{failFetch:true});
  await assert.doesNotReject(a.api.track('lead'));
});
test('expired attribution clears but retains browser identity', () => {
  const a = visit('?utm_source=facebook');
  assert.ok(a.api);
  for (const [key,value] of a.storage) { try { const v=JSON.parse(value); if(v.expires_at) {v.expires_at=1;a.storage.set(key,JSON.stringify(v));} } catch {} }
  const b=visit('',a.storage);
  assert.equal(b.api.context().visitor_id,a.api.context().visitor_id);
  assert.equal(b.api.context().utm_source,null);
});
test('privacy signals disable tracking and attribution entirely', async () => {
  for(const navigator of [{doNotTrack:'1'},{globalPrivacyControl:true}]) {
    const a=visit('?utm_source=fb',new Map(),{navigator});
    assert.ok(a.api);assert.equal(a.api.context(),null);await a.api.track('lead');assert.equal(a.requests.length,0);assert.equal(a.storage.size,0);
  }
});
test('placeholder tags and personal URLs never enter event payload', async () => {
  const a=visit('?utm_source={{site_source_name}}&utm_campaign=person%40example.com',new Map(),{});
  assert.ok(a.api);assert.equal(a.api.context().utm_source,null);
  await a.api.track('lead');assert.equal(a.requests[0].p_path,'/checkout.html');assert.equal(a.requests[0].p_campaign,null);
  const b=visit('?utm_source=l.facebook.com',new Map(),{referrer:'https://l.facebook.com/secret?email=person@example.com',path:'/checkout.html'});
  await b.api.track('page_view');assert.equal(b.requests[0].p_source,'facebook');assert.equal(b.requests[0].p_referrer,'l.facebook.com');
  await b.api.track('purchase');assert.equal(b.requests.length,1);
});
