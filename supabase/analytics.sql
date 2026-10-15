-- First-party analytics. Revenue is read from reservations, never client events.
create table public.site_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  event_name text not null check (event_name in ('page_view','packages_view','package_click','checkout_start','lead','contact')),
  path text not null,
  source text not null default '', medium text not null default '',
  campaign text not null default '', content text not null default '', term text not null default '',
  referrer text not null default '', attribution_at timestamptz,
  created_at timestamptz not null default now()
);
create index site_events_time on public.site_events(created_at);
create index site_events_visitor_time on public.site_events(visitor_id,created_at desc);
alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
grant select on public.site_events to authenticated;
create policy analytics_admin_read on public.site_events for select to authenticated using (public.is_admin());

create table public.ad_spend (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign text not null check (length(trim(campaign)) between 1 and 200),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
alter table public.ad_spend enable row level security;
revoke all on public.ad_spend from anon, authenticated;
grant select,insert,delete on public.ad_spend to authenticated;
create policy spend_admin_read on public.ad_spend for select to authenticated using (public.is_admin());
create policy spend_admin_add on public.ad_spend for insert to authenticated with check (public.is_admin());
create policy spend_admin_remove on public.ad_spend for delete to authenticated using (public.is_admin());
create index ad_spend_date on public.ad_spend(date);

alter table public.reservations add column visitor_id uuid;
alter table public.reservations add column utm_source text not null default '';
alter table public.reservations add column utm_medium text not null default '';
alter table public.reservations add column utm_campaign text not null default '';
alter table public.reservations add column utm_content text not null default '';
alter table public.reservations add column utm_term text not null default '';

create function public.track_site_event(
  p_visitor uuid, p_event text, p_path text,
  p_source text default '', p_medium text default '', p_campaign text default '',
  p_content text default '', p_term text default '', p_referrer text default '',
  p_attribution_at timestamptz default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_touch timestamptz;
begin
  if p_visitor is null or p_event not in ('page_view','packages_view','package_click','checkout_start','lead','contact') then return; end if;
  if p_path not in ('/','/index.html','/checkout','/checkout.html','/privacy','/privacy.html','/terms','/terms.html') then return; end if;
  -- Bound ordinary browser traffic and avoid accepting arbitrarily long records.
  if (select count(*) from public.site_events where visitor_id=p_visitor and created_at>now()-interval '1 hour') >= 120 then return; end if;
  v_touch := case when p_attribution_at between now()-interval '30 days' and now()+interval '1 minute' then least(p_attribution_at,now()) else null end;
  insert into public.site_events(visitor_id,event_name,path,source,medium,campaign,content,term,referrer,attribution_at)
  values (p_visitor,p_event,p_path,
    left(coalesce(p_source,''),100),left(coalesce(p_medium,''),100),
    case when v_touch is not null and coalesce(p_campaign,'') not like '%{{%' then left(coalesce(p_campaign,''),200) else '' end,
    case when v_touch is not null and coalesce(p_content,'') not like '%{{%' then left(coalesce(p_content,''),200) else '' end,
    case when v_touch is not null and coalesce(p_term,'') not like '%{{%' then left(coalesce(p_term,''),200) else '' end,
    left(regexp_replace(coalesce(p_referrer,''),'[^a-zA-Z0-9.:-]','','g'),200),v_touch);
end;
$$;
revoke all on function public.track_site_event(uuid,text,text,text,text,text,text,text,text,timestamptz) from public;
grant execute on function public.track_site_event(uuid,text,text,text,text,text,text,text,text,timestamptz) to anon,authenticated;

-- Preserve the existing seat-capacity, amount and checkout validations atomically.
create function public.reserve_order_with_attribution(
  p_items jsonb,p_name text,p_email text,p_phone text,p_method text,
  p_source text default 'Website',p_lang text default 'en',p_addon boolean default false,
  p_visitor uuid default null,p_source_tag text default '',p_medium_tag text default '',
  p_campaign_tag text default '',p_content_tag text default '',p_term_tag text default '',
  p_attribution_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb; v_tag public.site_events%rowtype; v_valid boolean;
begin
  v_result := public.reserve_order(p_items,p_name,p_email,p_phone,p_method,p_source,p_lang,p_addon);
  select * into v_tag from public.site_events where visitor_id=p_visitor and attribution_at between now()-interval '30 days' and now()
    and (campaign<>'' or medium<>'' or content<>'') order by attribution_at desc,created_at desc limit 1;
  v_valid := p_attribution_at between now()-interval '30 days' and now()+interval '1 minute';
  update public.reservations set visitor_id=p_visitor,
    utm_source=left(coalesce(v_tag.source,case when v_valid then p_source_tag else '' end,''),100),
    utm_medium=left(coalesce(v_tag.medium,case when v_valid then p_medium_tag else '' end,''),100),
    utm_campaign=left(coalesce(v_tag.campaign,case when v_valid then p_campaign_tag else '' end,''),200),
    utm_content=left(coalesce(v_tag.content,case when v_valid then p_content_tag else '' end,''),200),
    utm_term=left(coalesce(v_tag.term,case when v_valid then p_term_tag else '' end,''),200)
  where order_id=(v_result->>'order_id')::uuid;
  return v_result;
end;
$$;
revoke all on function public.reserve_order_with_attribution(jsonb,text,text,text,text,text,text,boolean,uuid,text,text,text,text,text,timestamptz) from public;
grant execute on function public.reserve_order_with_attribution(jsonb,text,text,text,text,text,text,boolean,uuid,text,text,text,text,text,timestamptz) to anon,authenticated;

create function public.admin_analytics_report(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_from timestamptz; v_to timestamptz; v_started timestamptz;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_days is not null and p_days not in (7,30,90) then raise exception 'Invalid period'; end if;
  v_to := ((now() at time zone 'Asia/Manila')::date+1)::timestamp at time zone 'Asia/Manila';
  v_from := case when p_days is null then '-infinity'::timestamptz else v_to-make_interval(days=>p_days) end;
  select min(created_at) into v_started from public.site_events;
  return jsonb_build_object('started_at',v_started,'from',case when p_days is null then null else v_from end,'to',v_to,
    'events',coalesce((select jsonb_agg(jsonb_build_object('visitor_id',visitor_id,'event_name',event_name,'created_at',created_at,
      'source',source,'medium',medium,'campaign',campaign,'content',content,'term',term,'path',path,'referrer',referrer))
      from public.site_events where created_at>=v_from and created_at<v_to),'[]'::jsonb),
    'reservations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'order_id',order_id,'session_id',session_id,'status',status,'amount',amount,
      'addon_amount',addon_amount,'addon_hub',addon_hub,'created_at',created_at,'paid_at',paid_at,'visitor_id',visitor_id,
      'utm_source',utm_source,'utm_medium',utm_medium,'utm_campaign',utm_campaign,'utm_content',utm_content,'utm_term',utm_term))
      from public.reservations where (created_at>=v_from and created_at<v_to) or (paid_at>=v_from and paid_at<v_to)),'[]'::jsonb),
    'spend',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',date,'campaign',campaign,'amount',amount)) from public.ad_spend
      where date>=(v_from at time zone 'Asia/Manila')::date and date<(v_to at time zone 'Asia/Manila')::date),'[]'::jsonb));
end;
$$;
revoke all on function public.admin_analytics_report(integer) from public;
grant execute on function public.admin_analytics_report(integer) to authenticated;
