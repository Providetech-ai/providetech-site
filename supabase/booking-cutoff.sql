-- Online (Zoom) sessions stop taking bookings 1 hour before they start.
-- Start time = the session date + the first time in its time label (e.g. "7:00 PM – 9:00 PM"), Philippine time.

create or replace function public.session_starts_at(p_date date, p_label text)
returns timestamptz
language sql stable
set search_path = ''
as $$
  select case when x.m is null then null
    else ((p_date + make_time((x.m[1]::int % 12) + case when upper(x.m[3]) = 'P' then 12 else 0 end,
                              coalesce(nullif(x.m[2], '')::int, 0), 0)) at time zone 'Asia/Manila')
  end
  from (select regexp_match(coalesce(p_label, ''), '(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?\s*[Mm]') as m) x;
$$;

create or replace function public.booking_closed(p_format text, p_date date, p_label text)
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(p_format, 'online') = 'online'
     and coalesce(now() >= public.session_starts_at(p_date, p_label) - interval '60 minutes', false);
$$;

-- Same as public_sessions_v2, plus booking_closed (the checkout shows "Registration closed").
create or replace function public.public_sessions_v3()
returns table(id uuid, code text, title text, date date, time_label text, venue text, capacity integer,
              price integer, seats_left integer, format text, booking_closed boolean)
language sql stable security definer
set search_path to 'public'
as $$
  select s.id, s.code, s.title, s.date, s.time_label, s.venue, s.capacity, s.price,
         greatest(0, s.capacity - public.seats_taken(s.id))::int as seats_left, s.format,
         public.booking_closed(s.format, s.date, s.time_label) as booking_closed
  from public.sessions s
  where s.status = 'open' and s.date >= (now() at time zone 'Asia/Manila')::date
  order by s.date;
$$;
grant execute on function public.public_sessions_v3() to anon, authenticated;

create or replace function public.reserve_seat_v4(p_session uuid, p_name text, p_email text, p_phone text, p_method text,
  p_source text default 'Website'::text, p_lang text default 'en'::text, p_addon boolean default false,
  p_address text default ''::text, p_pref text default ''::text)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  s public.sessions%rowtype;
  new_id uuid;
  prev public.reservations%rowtype;
  v_hold timestamptz := now() + make_interval(hours => public.hold_hours());
  v_addon_price int := case when coalesce(p_addon, false) then public.hub_offer_price() else null end;
  v_want boolean := v_addon_price is not null;
  v_lang text := case when p_lang in ('en','tl','ceb') then p_lang else 'en' end;
  v_addr text := left(regexp_replace(trim(coalesce(p_address, '')), '\s+', ' ', 'g'), 300);
  v_pref text := left(trim(coalesce(p_pref, '')), 300);
  v_what text;
begin
  if not public.checkout_is_open() then raise exception 'CHECKOUT_CLOSED'; end if;
  if coalesce(trim(p_name), '') !~ '\S+\s+\S+' then raise exception 'NAME'; end if;
  if coalesce(p_email, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'EMAIL'; end if;
  if coalesce(p_phone, '') !~ '^9[0-9]{9}$' then raise exception 'PHONE'; end if;
  if p_method not in ('gcash','card','qrph') then raise exception 'METHOD'; end if;

  select * into s from public.sessions where id = p_session for update;
  if not found or s.status <> 'open' or s.date < current_date then raise exception 'CLOSED'; end if;
  if public.booking_closed(s.format, s.date, s.time_label) then raise exception 'BOOKING_CLOSED'; end if;
  if s.format = 'home' and char_length(v_addr) < 8 then raise exception 'ADDRESS'; end if;
  if s.format <> 'home' then v_addr := ''; v_pref := ''; end if;
  v_what := case s.format when 'home' then '1-on-1 coaching booked on website (not paid yet)' when 'f2f' then 'Face-to-face booking on website (not paid yet)' else 'Booked on website (not paid yet)' end;

  select * into prev from public.reservations r
   where r.session_id = s.id and lower(r.email) = lower(trim(p_email))
     and r.status in ('pending','paid','refund_requested')
   limit 1;
  if found then
    if prev.status = 'pending' and prev.phone = p_phone then
      if public.seats_taken(s.id) >= s.capacity then raise exception 'FULL'; end if;
      update public.reservations r
         set method = p_method, hold_until = v_hold, lang = v_lang, address = v_addr, schedule_pref = v_pref,
             addon_hub = v_want, addon_amount = coalesce(v_addon_price, 0), amount = s.price + coalesce(v_addon_price, 0),
             pm_checkout_id = case when r.addon_hub is distinct from v_want then '' else r.pm_checkout_id end,
             history = r.history || jsonb_build_array(jsonb_build_object('at', now(), 'text',
               'Came back to finish payment' || case when v_want then ' · with Builder Hub' else '' end))
       where r.id = prev.id;
      return prev.id;
    end if;
    raise exception 'DUPLICATE';
  end if;

  if public.seats_taken(s.id) >= s.capacity then raise exception 'FULL'; end if;

  insert into public.reservations (session_id, name, email, phone, method, status, source, amount, addon_hub, addon_amount, lang, hold_until, address, schedule_pref, history)
  values (s.id, left(trim(p_name), 120), lower(left(trim(p_email), 200)), p_phone, p_method, 'pending',
          left(coalesce(nullif(trim(p_source), ''), 'Website'), 60), s.price + coalesce(v_addon_price, 0),
          v_want, coalesce(v_addon_price, 0), v_lang, v_hold, v_addr, v_pref,
          jsonb_build_array(jsonb_build_object('at', now(), 'text',
            v_what || case when v_want then ' · with Builder Hub (₱' || v_addon_price || ')' else '' end)))
  returning id into new_id;
  return new_id;
end;
$function$;
