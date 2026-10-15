begin;
select public.track_site_event('00000000-0000-4000-8000-000000000071','page_view','/',
  'facebook','paid','analytics-test','creative-test','','facebook.com',now());
select public.track_site_event('00000000-0000-4000-8000-000000000071','page_view','/admin',
  '','','','','','',null);
do $$
begin
  if (select count(*) from public.site_events where visitor_id='00000000-0000-4000-8000-000000000071')<>1 then
    raise exception 'Expected exactly one valid public event';
  end if;
end $$;
set local role anon;
do $$
begin
  begin
    perform count(*) from public.site_events;
    raise exception 'Anonymous analytics read unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_analytics_report(30);
    raise exception 'Anonymous report unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ad_spend(date,campaign,amount) values(current_date,'test',1);
    raise exception 'Anonymous spend insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  if (select count(*) from public.site_events)<>0 then raise exception 'Non-admin can read analytics'; end if;
  begin
    perform public.admin_analytics_report(30);
    raise exception 'Non-admin report unexpectedly allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ad_spend(date,campaign,amount) values(current_date,'test',1);
    raise exception 'Non-admin spend insert unexpectedly allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
declare v_admin uuid; v_report jsonb;
begin
  select user_id into v_admin from public.admins limit 1;
  if v_admin is null then raise exception 'No admin fixture'; end if;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  v_report:=public.admin_analytics_report(30);
  if not (v_report ? 'events' and v_report ? 'reservations' and v_report ? 'spend') then raise exception 'Report missing data'; end if;
  v_report:=public.admin_analytics_report(null);
  if jsonb_array_length(v_report->'events')<1 then raise exception 'All-time report omitted event'; end if;
end $$;
rollback;
