(function (root) {
  'use strict';
  function day(value) { var n = Date.parse(value); return Number.isFinite(n) ? new Date(n + 8 * 3600000).toISOString().slice(0, 10) : ''; }
  function eventSource(e) {
    if(e.source) return e.source;
    try { var host=new URL(/^https?:\/\//i.test(e.referrer||'')?e.referrer:'https://'+e.referrer).hostname.toLowerCase().replace(/^www\./,'');
      if(/(^|\.)providetechai\.live$/.test(host) || host==='localhost') return '';
      if(/(^|\.)facebook\.com$/.test(host))return 'facebook';
      if(/(^|\.)instagram\.com$/.test(host))return 'instagram';
      if(/(^|\.)google\.[a-z.]+$/.test(host))return 'google'; return host;
    } catch(err) {return '';}
  }
  function build(data, period, now) {
    data = data || {};
    var today = day(now || new Date().toISOString()), end = new Date(today + 'T00:00:00Z');
    end.setUTCDate(end.getUTCDate() + 1);
    var start = period === 'all' ? '' : new Date(end.getTime() - Number(period) * 86400000).toISOString().slice(0, 10);
    function inside(date) { return !!date && (!start || date >= start) && date < end.toISOString().slice(0, 10); }
    var sets = {}, booked = new Set(), paid = new Set(), paidVisitors = new Set(), bookedVisitors = new Set(), adsVisitors=new Set(), pageViews=0, daily = {}, groups = {source:new Map(),campaign:new Map(),content:new Map(),package:new Map()}, revenue = 0;
    function bucket(date) { return daily[date] || (daily[date] = {date:date,visitors:new Set(),paid:new Set()}); }
    function group(type, name) { var map = groups[type], key = name || (type === 'source' ? 'Direct / unknown' : 'Unspecified'); if (!map.has(key)) map.set(key,{name:key,visitors:new Set(),checkout:new Set(),paidVisitors:new Set(),booked:new Set(),paid:new Set(),revenue:0,spend:0}); return map.get(key); }
    (data.events || []).forEach(function(e) {
      var date = day(e.created_at); if (!inside(date) || !e.visitor_id) return;
      if (!sets[e.event_name]) sets[e.event_name] = new Set(); sets[e.event_name].add(e.visitor_id);
      if (e.event_name === 'checkout_start') ['source','campaign','content'].forEach(function(type){group(type,type==='source'?eventSource(e):e[type]).checkout.add(e.visitor_id);});
      if (e.event_name !== 'page_view') return;
      pageViews++; if(/^(paid.*|cpc|ppc|display|social_paid)$/i.test(e.medium||''))adsVisitors.add(e.visitor_id);
      bucket(date).visitors.add(e.visitor_id);
      ['source','campaign','content'].forEach(function(type) { group(type,type==='source'?eventSource(e):e[type]).visitors.add(e.visitor_id); });
    });
    (data.reservations || []).forEach(function(r) {
      var id = r.order_id || r.id, booking = inside(day(r.created_at)), payment = (r.status === 'paid' || r.status==='refund_requested') && inside(day(r.paid_at)), amount = Math.max(0,Number(r.amount)||0), addon=r.addon_hub?Math.min(amount,Math.max(0,Number(r.addon_amount)||0)):0;
      if (booking) { booked.add(id); if(r.visitor_id) bookedVisitors.add(r.visitor_id); }
      if (payment) { paid.add(id); if(r.visitor_id) paidVisitors.add(r.visitor_id); revenue += amount; bucket(day(r.paid_at)).paid.add(id); }
      ['source','campaign','content','package'].forEach(function(type) {
        var g = group(type,type==='package'?r.session_id:r['utm_'+type]);
        if(booking) g.booked.add(id); if(payment) { g.paid.add(id); if(r.visitor_id)g.paidVisitors.add(r.visitor_id); g.revenue+=type==='package'?amount-addon:amount; }
      });
      if(addon) {var hub=group('package','Builder Hub add-on');if(booking)hub.booked.add(id);if(payment){hub.paid.add(id);hub.revenue+=addon;}}
    });
    var spend = (data.spend || []).filter(function(s){return inside(s.date);}), totalSpend = spend.reduce(function(n,s){return n+Math.max(0,Number(s.amount)||0);},0);
    spend.forEach(function(s){group('campaign',s.campaign).spend+=Math.max(0,Number(s.amount)||0);});
    var chartStart=start || Object.keys(daily).sort()[0];
    if(chartStart) for(var stamp=Date.parse(chartStart+'T00:00:00Z');stamp<end.getTime();stamp+=86400000) bucket(new Date(stamp).toISOString().slice(0,10));
    var result = {visitors:(sets.page_view||new Set()).size,checkout:(sets.checkout_start||new Set()).size,booked:booked.size,paid:paid.size,paidVisitors:paidVisitors.size,revenue:revenue,spend:totalSpend,roas:totalSpend?revenue/totalSpend:null,cpa:paid.size&&totalSpend?totalSpend/paid.size:null,spendRows:spend};
    function intersection(a,b) {var n=0;a.forEach(function(v){if(b.has(v))n++;});return n;}
    result.pageViews=pageViews;result.fromAds=adsVisitors.size;result.checkoutRate=result.visitors?intersection(sets.checkout_start||new Set(),sets.page_view||new Set())/result.visitors*100:null;
    result.funnel = [['Visitors',result.visitors],['Viewed packages',(sets.packages_view||new Set()).size],['Selected package',(sets.package_click||new Set()).size],['Started checkout',result.checkout],['Booked',bookedVisitors.size],['Paid',paidVisitors.size]];
    result.daily = Object.keys(daily).sort().map(function(date){var row=daily[date];return {date:date,visitors:row.visitors.size,paid:row.paid.size};});
    Object.keys(groups).forEach(function(type){result[type]=Array.from(groups[type].values()).map(function(g){return {name:g.name,visitors:g.visitors.size,checkout:g.checkout.size,bought:g.visitors.size?intersection(g.paidVisitors,g.visitors)/g.visitors.size*100:null,booked:g.booked.size,paid:g.paid.size,revenue:g.revenue,spend:g.spend,roas:g.spend?g.revenue/g.spend:null};}).sort(function(a,b){return b.revenue-a.revenue||b.visitors-a.visitors;});});
    return result;
  }
  var api = {build:build,day:day}; if(typeof module==='object' && module.exports) module.exports=api; else root.PTAnalytics=api;
})(typeof window==='object'?window:globalThis);
