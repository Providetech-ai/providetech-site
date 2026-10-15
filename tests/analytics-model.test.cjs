const assert = require('node:assert/strict');
const model = require('../admin/analytics-model.js');
const now = '2026-10-14T12:00:00Z';
const data = {events: [
 {visitor_id:'v1',event_name:'page_view',created_at:'2026-10-14T00:00:00Z',source:'facebook'},
 {visitor_id:'v1',event_name:'page_view',created_at:'2026-10-14T01:00:00Z'},
 {visitor_id:'v2',event_name:'checkout_start',created_at:'2026-10-14T01:00:00Z'}
],reservations:[
 {id:'a',order_id:'o',visitor_id:'v1',status:'paid',amount:100,created_at:'2026-09-01T00:00:00Z',paid_at:'2026-10-14T00:00:00Z'},
 {id:'b',order_id:'o',visitor_id:'v1',status:'paid',amount:200,created_at:'2026-09-01T00:00:00Z',paid_at:'2026-10-14T00:00:00Z'},
 {id:'c',visitor_id:'v1',status:'paid',amount:50,created_at:'2026-10-14T00:00:00Z',paid_at:'2026-10-14T00:00:00Z'},
 {id:'old',status:'paid',amount:900,created_at:'2026-10-07T15:59:00Z',paid_at:'2026-10-07T15:59:00Z'}
],spend:[{date:'2026-10-14',amount:100}]};
const result = model.build(data,'7',now);
assert.equal(result.visitors,1);
assert.equal(result.checkout,1);
assert.equal(result.booked,1);
assert.equal(result.paid,2);
assert.equal(result.paidVisitors,1);
assert.equal(result.revenue,350);
assert.equal(result.roas,3.5);
assert.equal(result.cpa,50);
assert.equal(result.daily.find(x=>x.date==='2026-10-14').paid,2);
assert.equal(model.day('2026-10-13T17:00:00Z'),'2026-10-14');
assert.equal(model.build({},'all',now).roas,null);
assert.equal(model.build({},'all',now).cpa,null);
assert.equal(result.funnel.find(x=>x[0]==='Paid')[1],1);
assert.equal(result.daily.length,7);
assert.equal(model.build(data,'all',now).paid,3);
const attributed = model.build({events:[{visitor_id:'v',event_name:'page_view',source:'<script>',campaign:'summer',content:'ad1',created_at:now}],reservations:[{id:'r',status:'refunded',amount:200,utm_source:'<script>',created_at:now,paid_at:now}],spend:[]},'30',now);
assert.equal(attributed.revenue,0);
assert.equal(attributed.source.find(x=>x.name==='<script>').visitors,1);
assert.equal(attributed.source.find(x=>x.name==='<script>').booked,1);
assert.equal(attributed.campaign.find(x=>x.name==='summer').visitors,1);
assert.equal(attributed.content.find(x=>x.name==='ad1').visitors,1);
const enhanced=model.build({events:[{visitor_id:'new',event_name:'page_view',referrer:'https://m.facebook.com/post',medium:'paid_social',campaign:'active',created_at:now},{visitor_id:'new',event_name:'checkout_start',campaign:'active',created_at:now}],reservations:[{id:'new-order',visitor_id:'new',status:'refund_requested',amount:300,addon_hub:true,addon_amount:50,session_id:'workshop',utm_campaign:'active',created_at:now,paid_at:now},{id:'old-order',visitor_id:'old',status:'paid',amount:100,utm_campaign:'active',created_at:now,paid_at:now}],spend:[{date:'2026-10-14',campaign:'no-sales',amount:100},{date:'2026-10-14',campaign:'active',amount:200}]},'7',now);
assert.equal(enhanced.revenue,400);
assert.equal(enhanced.source.find(r=>r.name==='facebook').visitors,1);
assert.equal(enhanced.campaign.find(r=>r.name==='active').checkout,1);
assert.equal(enhanced.campaign.find(r=>r.name==='active').bought,100);
assert.equal(enhanced.campaign.find(r=>r.name==='active').roas,2);
assert.equal(enhanced.campaign.find(r=>r.name==='no-sales').roas,0);
assert.equal(enhanced.campaign.find(r=>r.name==='no-sales').bought,null);
assert.equal(enhanced.package.find(r=>r.name==='workshop').revenue,250);
assert.equal(enhanced.package.find(r=>r.name==='Builder Hub add-on').revenue,50);
assert.equal(enhanced.pageViews,1);
assert.equal(enhanced.fromAds,1);
const internal=model.build({events:[{visitor_id:'local',event_name:'page_view',referrer:'https://www.providetechai.live/checkout.html',created_at:now},{visitor_id:'search',event_name:'page_view',referrer:'https://www.google.com/search',created_at:now}]},'7',now);
assert.equal(internal.source.find(r=>r.name==='Direct / unknown').visitors,1);
assert.equal(internal.source.find(r=>r.name==='google').visitors,1);
assert.equal(enhanced.checkoutRate,100);
const hostOnly=model.build({events:[{visitor_id:'social',event_name:'page_view',referrer:'l.facebook.com',created_at:now}]},'7',now);
assert.equal(hostOnly.source.find(r=>r.name==='facebook').visitors,1);
console.log('analytics-model tests passed');
