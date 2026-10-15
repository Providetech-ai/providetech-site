const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function run(paid=true,blocked=false){
 const calls=[],store=new Map();
 const window={navigator:{doNotTrack:blocked?'1':'0'},location:{search:'',pathname:'/'},crypto:require('node:crypto').webcrypto,
 PROVIDETECH_CONFIG:{supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'public',metaPixelId:'1014444408413826'},
 localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},fbq:(...args)=>calls.push(args),
 fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({paid,value:999,order_id:'order-test'})})};
 const document={readyState:'loading',referrer:'',addEventListener(){},getElementById(){return null;}};
 vm.runInNewContext(fs.readFileSync('assets/analytics.js','utf8'),{window,document,URL,URLSearchParams,Date,Promise,Math});
 return {api:window.PTAnalytics,calls};
}
test('pixel maps funnel events and successful bookings',async()=>{const x=run();await x.api.track('packages_view');x.api.booking('order-test');assert.ok(x.calls.some(c=>c[0]==='track'&&c[1]==='ViewContent'));assert.ok(x.calls.some(c=>c[1]==='AddPaymentInfo'));});
test('purchase requires confirmed database status and deduplicates',async()=>{const no=run(false);await no.api.purchase('order-test');assert.equal(no.calls.filter(c=>c[1]==='Purchase').length,0);const yes=run();await yes.api.purchase('order-test');await yes.api.purchase('order-test');const p=yes.calls.filter(c=>c[1]==='Purchase');assert.equal(p.length,1);assert.equal(p[0][2].value,999);assert.equal(p[0][2].currency,'PHP');assert.equal(p[0][3].eventID,'order-test');});
test('privacy signal disables pixel and purchase',async()=>{const x=run(true,true);await x.api.track('page_view');await x.api.purchase('order-test');assert.equal(x.calls.length,0);});
