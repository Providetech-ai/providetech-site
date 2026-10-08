-- =====================================================================
-- PROVIDETECH database setup for Supabase
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a new project.
--
-- Security model (Row Level Security):
--   • Visitors (anon) can only: list open workshops with seats left,
--     read the public settings (payment links, bonuses), reserve a seat,
--     and send an inquiry. They can never read anyone's details.
--   • Signed-in users listed in public.admins can read and manage
--     everything. Signing up alone does NOT make someone an admin.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,                                   -- e.g. "Batch 07"
  title      text not null default 'AI Business Systems Workshop',
  date       date not null,
  time_label text not null default '',                        -- e.g. "9:00 AM – 5:00 PM"
  venue      text not null default '',
  zoom_link  text not null default '',                        -- private: only emailed to paid participants
  zoom_notes text not null default '',                        -- e.g. meeting ID and passcode
  capacity   int  not null default 30 check (capacity > 0),
  price      int  not null default 999 check (price >= 0),    -- pesos
  status     text not null default 'draft' check (status in ('draft','open','full','done')),
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete restrict,
  name          text not null check (char_length(name) between 2 and 120),
  email         text not null check (char_length(email) between 5 and 200),
  phone         text not null check (phone ~ '^9[0-9]{9}$'),
  method        text not null check (method in ('gcash','card','qrph','maya','cash','bank')),
  status        text not null default 'pending'
                check (status in ('pending','paid','refund_requested','refunded','cancelled')),
  source        text not null default 'Website',
  ref           text not null default '',
  amount        int  not null default 0,
  notes         text not null default '',
  refund_reason text not null default '',
  history       jsonb not null default '[]'::jsonb,
  lang          text not null default 'en' check (lang in ('en','tl','ceb')),  -- language of their emails
  zoom_email_sent_at timestamptz,
  created_at    timestamptz not null default now(),
  paid_at       timestamptz
);
-- (projects created before the Zoom email feature)
alter table public.sessions     add column if not exists zoom_link  text not null default '';
alter table public.sessions     add column if not exists zoom_notes text not null default '';
alter table public.reservations add column if not exists lang text not null default 'en';
alter table public.reservations add column if not exists zoom_email_sent_at timestamptz;
alter table public.reservations add column if not exists pm_checkout_id text not null default '';  -- PayMongo checkout session
alter table public.reservations add column if not exists pm_payment_id  text not null default '';  -- PayMongo payment (pay_...)
alter table public.reservations add column if not exists hold_until timestamptz;  -- unpaid seats are held until this time

-- Server-only values (PayMongo webhook signing secret). No policies: only Edge Functions can read it.
create table if not exists public.private_config (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.private_config enable row level security;
create index if not exists reservations_session_idx on public.reservations (session_id);
create index if not exists reservations_created_idx on public.reservations (created_at desc);
-- one active seat per email per batch (stops duplicate or spam bookings)
create unique index if not exists reservations_one_active_per_email
  on public.reservations (session_id, lower(email))
  where status in ('pending','paid','refund_requested');

create table if not exists public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  business   text not null default '',
  email      text not null default '',
  phone      text not null default '',
  need       text not null default '',
  message    text not null default '' check (char_length(message) <= 2000),
  source     text not null default 'Website',
  status     text not null default 'new' check (status in ('new','contacted','proposal','won','lost')),
  notes      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  public     boolean not null default false,   -- true = visitors may read it
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value, public) values
  ('org_name',      '"PROVIDETECH AI ASSISTANCE"', false),
  ('payment_links', '{"all":"https://pm.link/ProvideTech/k1aTE93","gcash":"","card":"","qrph":""}', true),
  ('hold_hours',    '1', true),
  ('refund_days',   '7', true),
  ('bonuses',       '["[Bonus 1 — e.g. session replay]","[Bonus 2 — e.g. templates or prompt pack]","[Bonus 3 — e.g. community access]"]', true)
on conflict (key) do nothing;

-- ---------- Who is an admin? ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- Row Level Security ----------
alter table public.admins       enable row level security;
alter table public.sessions     enable row level security;
alter table public.reservations enable row level security;
alter table public.inquiries    enable row level security;
alter table public.settings     enable row level security;

drop policy if exists "admins read own row"   on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "admins manage sessions" on public.sessions;
create policy "admins manage sessions" on public.sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage reservations" on public.reservations;
create policy "admins manage reservations" on public.reservations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage inquiries" on public.inquiries;
create policy "admins manage inquiries" on public.inquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage settings" on public.settings;
create policy "admins manage settings" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anyone reads public settings" on public.settings;
create policy "anyone reads public settings" on public.settings
  for select to anon, authenticated using (public = true);

-- ---------- Public functions (the only doors visitors can use) ----------

-- How long an unpaid reservation keeps its seat (Settings → Workshop rules)
create or replace function public.hold_hours() returns int language sql stable security definer set search_path = public as $$
  select greatest(1, least(336, coalesce((select (value)::text::int from public.settings where key = 'hold_hours'), 1)));
$$;

-- Seats in use: paid, refund requested, or unpaid but still inside its hold
create or replace function public.seats_taken(p_session uuid) returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.reservations r
   where r.session_id = p_session
     and (r.status in ('paid','refund_requested') or (r.status = 'pending' and coalesce(r.hold_until, r.created_at) > now()));
$$;

-- Open workshops with seats left (no personal data)
create or replace function public.public_sessions()
returns table (id uuid, code text, title text, date date, time_label text, venue text,
               capacity int, price int, seats_left int)
language sql stable security definer set search_path = public as $$
  select s.id, s.code, s.title, s.date, s.time_label, s.venue, s.capacity, s.price,
         greatest(0, s.capacity - public.seats_taken(s.id))::int as seats_left
  from public.sessions s
  where s.status = 'open' and s.date >= current_date
  order by s.date;
$$;

-- Reserve a seat (checks the session is open and not full, atomically)
create or replace function public.reserve_seat_v2(
  p_session uuid, p_name text, p_email text, p_phone text, p_method text, p_source text default 'Website', p_lang text default 'en')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.sessions%rowtype;
  new_id uuid;
  prev public.reservations%rowtype;
  hold timestamptz := now() + make_interval(hours => public.hold_hours());
begin
  if coalesce(trim(p_name), '') !~ '\S+\s+\S+' then raise exception 'NAME'; end if;
  if coalesce(p_email, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'EMAIL'; end if;
  if coalesce(p_phone, '') !~ '^9[0-9]{9}$' then raise exception 'PHONE'; end if;
  if p_method not in ('gcash','card','qrph') then raise exception 'METHOD'; end if;

  select * into s from public.sessions where id = p_session for update;
  if not found or s.status <> 'open' or s.date < current_date then raise exception 'CLOSED'; end if;

  select * into prev from public.reservations
   where session_id = s.id and lower(email) = lower(trim(p_email))
     and status in ('pending','paid','refund_requested')
   limit 1;
  if found then
    -- Same person coming back to finish paying: resume their unpaid seat
    if prev.status = 'pending' and prev.phone = p_phone then
      if coalesce(prev.hold_until, prev.created_at) <= now() and public.seats_taken(s.id) >= s.capacity then raise exception 'FULL'; end if;
      update public.reservations
         set method = p_method, hold_until = hold,
             lang = case when p_lang in ('en','tl','ceb') then p_lang else lang end,
             history = history || jsonb_build_array(jsonb_build_object('at', now(), 'text', 'Came back to finish payment'))
       where id = prev.id;
      return prev.id;
    end if;
    raise exception 'DUPLICATE';
  end if;

  if public.seats_taken(s.id) >= s.capacity then raise exception 'FULL'; end if;

  insert into public.reservations (session_id, name, email, phone, method, status, source, amount, lang, hold_until, history)
  values (s.id, left(trim(p_name), 120), lower(left(trim(p_email), 200)), p_phone, p_method, 'pending',
          left(coalesce(nullif(trim(p_source), ''), 'Website'), 60), s.price,
          case when p_lang in ('en','tl','ceb') then p_lang else 'en' end, hold,
          jsonb_build_array(jsonb_build_object('at', now(), 'text', 'Seat reserved on website')))
  returning id into new_id;
  return new_id;
end;
$$;

-- Send an inquiry from the homepage
create or replace function public.submit_inquiry(
  p_name text, p_business text, p_email text, p_phone text, p_need text, p_message text, p_source text default 'Website')
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if char_length(coalesce(trim(p_name), '')) < 2 then raise exception 'NAME'; end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_phone), '') = '' then raise exception 'CONTACT'; end if;
  insert into public.inquiries (name, business, email, phone, need, message, source)
  values (left(trim(p_name), 120), left(coalesce(trim(p_business), ''), 160), lower(left(coalesce(trim(p_email), ''), 200)),
          left(coalesce(trim(p_phone), ''), 40), left(coalesce(trim(p_need), ''), 160),
          left(coalesce(trim(p_message), ''), 2000), left(coalesce(nullif(trim(p_source), ''), 'Website'), 60))
  returning id into new_id;
  return new_id;
end;
$$;

-- ---------- Permissions (RLS above decides which rows) ----------
revoke all on public.admins, public.sessions, public.reservations, public.inquiries, public.settings from anon;
revoke all on public.private_config from anon, authenticated;
grant select on public.settings to anon;
grant select, insert, update, delete on public.sessions, public.reservations, public.inquiries, public.settings to authenticated;
grant select on public.admins to authenticated;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.hold_hours() from public, anon, authenticated;
revoke all on function public.seats_taken(uuid) from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.public_sessions() from public;
revoke all on function public.reserve_seat_v2(uuid, text, text, text, text, text, text) from public;
revoke all on function public.submit_inquiry(text, text, text, text, text, text, text) from public;
grant execute on function public.public_sessions() to anon, authenticated;
-- retired: the website uses reserve_seat_v3 now
revoke execute on function public.reserve_seat_v2(uuid, text, text, text, text, text, text) from anon, authenticated;
-- the older reserve_seat (without language) is retired
do $$ begin
  if to_regprocedure('public.reserve_seat(uuid,text,text,text,text,text)') is not null then
    execute 'revoke all on function public.reserve_seat(uuid, text, text, text, text, text) from public, anon, authenticated';
  end if;
end $$;
grant execute on function public.submit_inquiry(text, text, text, text, text, text, text) to anon, authenticated;

-- Lock down a Supabase helper that new projects may include
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- Owner becomes admin automatically once their confirmed account exists
create or replace function public.grant_owner_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) = 'providetechaiassistance@gmail.com' and new.email_confirmed_at is not null then
    insert into public.admins (user_id, name) values (new.id, 'Joshua Rivera')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_owner_admin() from public, anon, authenticated;
drop trigger if exists on_owner_user_ready on auth.users;
create trigger on_owner_user_ready
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_owner_admin();

-- ---------- Make yourself an admin (README, step 3) ----------
-- 1. Supabase → Authentication → Users → Add user (your email + a strong password).
-- 2. Run this, with your email:
--
--    insert into public.admins (user_id, name)
--    select id, 'Joshua Rivera' from auth.users where email = 'you@yourdomain.com';

-- =====================================================================
-- PROVIDETECH Builder Hub (checkout add-on + members' area)
-- =====================================================================
alter table public.reservations add column if not exists addon_hub boolean not null default false;
alter table public.reservations add column if not exists addon_amount int not null default 0;
alter table public.reservations add column if not exists site_url text not null default '';
alter table public.reservations add column if not exists hub_email_sent_at timestamptz;

insert into public.settings (key, value, public) values
  ('hub_offer', '{"enabled":true,"price":1999,"compare_at":11997,"months":12}', true)
on conflict (key) do nothing;

create table if not exists public.members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  name         text not null default '',
  lang         text not null default 'en' check (lang in ('en','tl','ceb')),
  access_until timestamptz not null,
  points       int not null default 0,
  source       text not null default 'checkout',
  reservation_id uuid references public.reservations (id) on delete set null,
  history      jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create unique index if not exists members_email_idx on public.members (lower(email));
alter table public.members enable row level security;
drop policy if exists "members read own row" on public.members;
create policy "members read own row" on public.members for select to authenticated using (user_id = auth.uid());
drop policy if exists "admins manage members" on public.members;
create policy "admins manage members" on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.members from anon;
grant select, insert, update, delete on public.members to authenticated;

-- One-time "set password" / "reset password" links (only hashes are stored; server only)
create table if not exists public.member_tokens (
  token_hash text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  purpose    text not null check (purpose in ('welcome','reset')),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
alter table public.member_tokens enable row level security;
revoke all on public.member_tokens from anon, authenticated;

create or replace function public.is_member() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and access_until > now());
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

create or replace function public.auth_user_id_by_email(p_email text) returns uuid language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

create or replace function public.hub_offer_price() returns int language sql stable security definer set search_path = public as $$
  select case when coalesce((value->>'enabled')::boolean, false) then greatest(0, coalesce((value->>'price')::int, 0)) else null end
  from public.settings where key = 'hub_offer';
$$;
revoke all on function public.hub_offer_price() from public, anon, authenticated;

-- Reserve a seat, optionally with the Builder Hub add-on (price always comes from settings, never the browser)
create or replace function public.reserve_seat_v3(
  p_session uuid, p_name text, p_email text, p_phone text, p_method text, p_source text default 'Website', p_lang text default 'en', p_addon boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.sessions%rowtype;
  new_id uuid;
  prev public.reservations%rowtype;
  v_hold timestamptz := now() + make_interval(hours => public.hold_hours());
  v_addon_price int := case when coalesce(p_addon, false) then public.hub_offer_price() else null end;
  v_want boolean := v_addon_price is not null;
  v_lang text := case when p_lang in ('en','tl','ceb') then p_lang else 'en' end;
begin
  if coalesce(trim(p_name), '') !~ '\S+\s+\S+' then raise exception 'NAME'; end if;
  if coalesce(p_email, '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'EMAIL'; end if;
  if coalesce(p_phone, '') !~ '^9[0-9]{9}$' then raise exception 'PHONE'; end if;
  if p_method not in ('gcash','card','qrph') then raise exception 'METHOD'; end if;

  select * into s from public.sessions where id = p_session for update;
  if not found or s.status <> 'open' or s.date < current_date then raise exception 'CLOSED'; end if;

  select * into prev from public.reservations r
   where r.session_id = s.id and lower(r.email) = lower(trim(p_email))
     and r.status in ('pending','paid','refund_requested')
   limit 1;
  if found then
    if prev.status = 'pending' and prev.phone = p_phone then
      if coalesce(prev.hold_until, prev.created_at) <= now() and public.seats_taken(s.id) >= s.capacity then raise exception 'FULL'; end if;
      update public.reservations r
         set method = p_method, hold_until = v_hold, lang = v_lang,
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

  insert into public.reservations (session_id, name, email, phone, method, status, source, amount, addon_hub, addon_amount, lang, hold_until, history)
  values (s.id, left(trim(p_name), 120), lower(left(trim(p_email), 200)), p_phone, p_method, 'pending',
          left(coalesce(nullif(trim(p_source), ''), 'Website'), 60), s.price + coalesce(v_addon_price, 0),
          v_want, coalesce(v_addon_price, 0), v_lang, v_hold,
          jsonb_build_array(jsonb_build_object('at', now(), 'text',
            'Seat reserved on website' || case when v_want then ' · with Builder Hub (₱' || v_addon_price || ')' else '' end)))
  returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.reserve_seat_v3(uuid, text, text, text, text, text, text, boolean) from public;
grant execute on function public.reserve_seat_v3(uuid, text, text, text, text, text, text, boolean) to anon, authenticated;

-- ---------- Builder Hub content: courses → lessons, replays, prompts, lesson progress ----------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  sort int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 40000),
  video_url text not null default '' check (video_url = '' or video_url ~ '^https://'),
  duration_min int not null default 0 check (duration_min between 0 and 1440),
  sort int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists lessons_course_idx on public.lessons (course_id, sort);
create table if not exists public.replays (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 8000),
  video_url text not null check (video_url ~ '^https://'),
  recorded_on date,
  duration_min int not null default 0 check (duration_min between 0 and 1440),
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'General' check (char_length(category) between 1 and 60),
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 1 and 20000),
  sort int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.replays enable row level security;
alter table public.prompts enable row level security;
alter table public.lesson_progress enable row level security;
drop policy if exists "members read published courses" on public.courses;
create policy "members read published courses" on public.courses for select to authenticated using (published and public.is_member());
drop policy if exists "admins manage courses" on public.courses;
create policy "admins manage courses" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "members read published lessons" on public.lessons;
create policy "members read published lessons" on public.lessons for select to authenticated using (published and public.is_member() and exists (select 1 from public.courses c where c.id = course_id and c.published));
drop policy if exists "admins manage lessons" on public.lessons;
create policy "admins manage lessons" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "members read published replays" on public.replays;
create policy "members read published replays" on public.replays for select to authenticated using (published and public.is_member());
drop policy if exists "admins manage replays" on public.replays;
create policy "admins manage replays" on public.replays for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "members read published prompts" on public.prompts;
create policy "members read published prompts" on public.prompts for select to authenticated using (published and public.is_member());
drop policy if exists "admins manage prompts" on public.prompts;
create policy "admins manage prompts" on public.prompts for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "members read own progress" on public.lesson_progress;
create policy "members read own progress" on public.lesson_progress for select to authenticated using (user_id = auth.uid());
drop policy if exists "members add own progress" on public.lesson_progress;
create policy "members add own progress" on public.lesson_progress for insert to authenticated with check (user_id = auth.uid() and public.is_member());
drop policy if exists "members remove own progress" on public.lesson_progress;
create policy "members remove own progress" on public.lesson_progress for delete to authenticated using (user_id = auth.uid());
drop policy if exists "admins read progress" on public.lesson_progress;
create policy "admins read progress" on public.lesson_progress for select to authenticated using (public.is_admin());
revoke all on public.courses, public.lessons, public.replays, public.prompts, public.lesson_progress from anon;
grant select, insert, update, delete on public.courses, public.lessons, public.replays, public.prompts to authenticated;
grant select, insert, delete on public.lesson_progress to authenticated;

-- ---------- Builder Hub community: channels, posts, comments, reactions, points ----------
-- Members (and admins, shown as "PROVIDETECH Team") can read and post. Admins can pin, hide or delete anything.
create or replace function public.can_hub() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member() or public.is_admin();
$$;
revoke all on function public.can_hub() from public, anon;
grant execute on function public.can_hub() to authenticated;

create or replace function public.hub_short_name(p_name text) returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(btrim(p_name), '') = '' then 'Member'
    when position(' ' in btrim(p_name)) = 0 then left(btrim(p_name), 40)
    else left(split_part(btrim(p_name), ' ', 1), 40) || ' ' || upper(left(regexp_replace(btrim(p_name), '^.*\s', ''), 1)) || '.'
  end;
$$;

create table if not exists public.channels (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,30}$'),
  name text not null,
  description text not null default '',
  sort int not null default 0
);
insert into public.channels (slug, name, description, sort) values
  ('general',   'General',   'Say hi, ask anything, share what you''re working on.', 1),
  ('wins',      'Wins',      'Share your results: first client, first automation, hours saved.', 2),
  ('help',      'Help',      'Stuck? Ask here. Say what you tried and where it broke.', 3),
  ('builds',    'Builds',    'Show what you built: links, screenshots, lessons learned.', 4),
  ('off-topic', 'Off-topic', 'Everything else.', 5)
on conflict (slug) do nothing;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  channel text not null references public.channels (slug) on update cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '',
  author_team boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  pinned boolean not null default false,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists posts_feed_idx on public.posts (channel, pinned desc, created_at desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default '',
  author_team boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_user_idx on public.comments (user_id, created_at);
create table if not exists public.reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('👍','🔥','🙌','💡')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists reactions_user_idx on public.reactions (user_id);

-- Stamp the author's display name on new posts/comments, stop flooding, keep moderation fields admin-only
create or replace function public.hub_stamp() returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_admin boolean; v_recent int;
begin
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  v_admin := public.is_admin();
  if v_admin then
    new.author_team := true; new.author_name := 'PROVIDETECH Team';
  else
    select m.name into v_name from public.members m where m.user_id = new.user_id;
    new.author_team := false; new.author_name := public.hub_short_name(v_name);
    new.hidden := false;
    if tg_table_name = 'posts' then
      new.pinned := false;
      select count(*) into v_recent from public.posts where user_id = new.user_id and created_at > now() - interval '1 day';
      if v_recent >= 20 then raise exception 'SLOW_DOWN'; end if;
    else
      select count(*) into v_recent from public.comments where user_id = new.user_id and created_at > now() - interval '1 day';
      if v_recent >= 100 then raise exception 'SLOW_DOWN'; end if;
    end if;
  end if;
  new.created_at := now(); new.edited_at := null;
  return new;
end;
$$;
create or replace function public.hub_guard_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := old.user_id; new.author_name := old.author_name; new.author_team := old.author_team; new.created_at := old.created_at;
  if tg_table_name = 'posts' then
    new.channel := old.channel;
    if auth.uid() is not null and not public.is_admin() then new.pinned := old.pinned; new.hidden := old.hidden; end if;
  else
    new.post_id := old.post_id;
    if auth.uid() is not null and not public.is_admin() then new.hidden := old.hidden; end if;
  end if;
  if new.body is distinct from old.body then new.edited_at := now(); else new.edited_at := old.edited_at; end if;
  return new;
end;
$$;
drop trigger if exists posts_stamp on public.posts;
create trigger posts_stamp before insert on public.posts for each row execute function public.hub_stamp();
drop trigger if exists comments_stamp on public.comments;
create trigger comments_stamp before insert on public.comments for each row execute function public.hub_stamp();
drop trigger if exists posts_guard on public.posts;
create trigger posts_guard before update on public.posts for each row execute function public.hub_guard_update();
drop trigger if exists comments_guard on public.comments;
create trigger comments_guard before update on public.comments for each row execute function public.hub_guard_update();
revoke all on function public.hub_stamp() from public, anon, authenticated;
revoke all on function public.hub_guard_update() from public, anon, authenticated;

alter table public.channels enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
drop policy if exists "hub reads channels" on public.channels;
create policy "hub reads channels" on public.channels for select to authenticated using (public.can_hub());
drop policy if exists "hub reads posts" on public.posts;
create policy "hub reads posts" on public.posts for select to authenticated using (public.can_hub() and (not hidden or public.is_admin()));
drop policy if exists "hub adds posts" on public.posts;
create policy "hub adds posts" on public.posts for insert to authenticated with check (user_id = auth.uid() and public.can_hub());
drop policy if exists "hub edits posts" on public.posts;
create policy "hub edits posts" on public.posts for update to authenticated using ((user_id = auth.uid() and public.can_hub()) or public.is_admin()) with check ((user_id = auth.uid() and public.can_hub()) or public.is_admin());
drop policy if exists "hub removes posts" on public.posts;
create policy "hub removes posts" on public.posts for delete to authenticated using ((user_id = auth.uid() and public.can_hub()) or public.is_admin());
drop policy if exists "hub reads comments" on public.comments;
create policy "hub reads comments" on public.comments for select to authenticated using (public.can_hub() and ((not hidden and exists (select 1 from public.posts p where p.id = post_id and not p.hidden)) or public.is_admin()));
drop policy if exists "hub adds comments" on public.comments;
create policy "hub adds comments" on public.comments for insert to authenticated with check (user_id = auth.uid() and public.can_hub() and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
drop policy if exists "hub edits comments" on public.comments;
create policy "hub edits comments" on public.comments for update to authenticated using ((user_id = auth.uid() and public.can_hub()) or public.is_admin()) with check ((user_id = auth.uid() and public.can_hub()) or public.is_admin());
drop policy if exists "hub removes comments" on public.comments;
create policy "hub removes comments" on public.comments for delete to authenticated using ((user_id = auth.uid() and public.can_hub()) or public.is_admin());
drop policy if exists "hub reads reactions" on public.reactions;
create policy "hub reads reactions" on public.reactions for select to authenticated using (public.can_hub());
drop policy if exists "hub adds reactions" on public.reactions;
create policy "hub adds reactions" on public.reactions for insert to authenticated with check (user_id = auth.uid() and public.can_hub() and exists (select 1 from public.posts p where p.id = post_id and not p.hidden));
drop policy if exists "hub removes reactions" on public.reactions;
create policy "hub removes reactions" on public.reactions for delete to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.channels, public.posts, public.comments, public.reactions from anon;
grant select on public.channels to authenticated;
grant select, insert, update, delete on public.posts, public.comments to authenticated;
grant select, insert, delete on public.reactions to authenticated;

-- Points (worked out from activity, so hidden or deleted posts stop counting):
--   post +5 (first 5 a day), comment on someone else's post +3 (first 10 a day),
--   each member who reacts to your post +1, each lesson finished +10.
create or replace function public.hub_points_since(p_since timestamptz)
returns table (user_id uuid, points int) language sql stable security definer set search_path = public as $$
  with
  p as (select x.user_id, sum(least(x.n, 5)) * 5 as pts from (
          select po.user_id, (po.created_at at time zone 'Asia/Manila')::date, count(*) as n
            from public.posts po where not po.hidden and po.created_at >= p_since group by 1, 2) x group by 1),
  c as (select x.user_id, sum(least(x.n, 10)) * 3 as pts from (
          select cm.user_id, (cm.created_at at time zone 'Asia/Manila')::date, count(*) as n
            from public.comments cm join public.posts po on po.id = cm.post_id
           where not cm.hidden and not po.hidden and po.user_id <> cm.user_id and cm.created_at >= p_since group by 1, 2) x group by 1),
  r as (select po.user_id, count(distinct (r.post_id, r.user_id)) as pts
          from public.reactions r join public.posts po on po.id = r.post_id
         where not po.hidden and r.user_id <> po.user_id and r.created_at >= p_since group by 1),
  l as (select lp.user_id, count(*) * 10 as pts from public.lesson_progress lp where lp.completed_at >= p_since group by 1)
  select u.user_id, sum(u.pts)::int from (
    select * from p union all select * from c union all select * from r union all select * from l) u
  group by 1;
$$;
revoke all on function public.hub_points_since(timestamptz) from public, anon, authenticated;

create or replace function public.hub_leaderboard(p_period text default 'month', p_limit int default 50)
returns table (pos int, name text, points int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_since timestamptz;
begin
  if not public.can_hub() then raise exception 'FORBIDDEN'; end if;
  v_since := case when p_period = 'all' then '-infinity'::timestamptz
                  else date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila' end;
  return query
  with t as (select * from public.hub_points_since(v_since)),
  m as (select mb.user_id, public.hub_short_name(mb.name) as nm, coalesce(t.points, 0) as pts
          from public.members mb left join t on t.user_id = mb.user_id where mb.access_until > now()),
  k as (select rank() over (order by m.pts desc)::int as rk, m.nm, m.pts, (m.user_id = auth.uid()) as me from m)
  select k.rk, k.nm, k.pts, k.me from k
   where (k.pts > 0 and k.rk <= greatest(1, least(coalesce(p_limit, 50), 200))) or k.me
   order by k.rk, k.nm;
end;
$$;
revoke all on function public.hub_leaderboard(text, int) from public, anon;
grant execute on function public.hub_leaderboard(text, int) to authenticated;

create or replace function public.hub_my_points() returns int language sql stable security definer set search_path = public as $$
  select coalesce((select t.points from public.hub_points_since('-infinity'::timestamptz) t where t.user_id = auth.uid()), 0);
$$;
revoke all on function public.hub_my_points() from public, anon;
grant execute on function public.hub_my_points() to authenticated;

-- Admins see everyone's points in Admin → Builder Hub → Members
create or replace function public.hub_points_all() returns table (user_id uuid, points int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return query select * from public.hub_points_since('-infinity'::timestamptz);
end;
$$;
revoke all on function public.hub_points_all() from public, anon;
grant execute on function public.hub_points_all() to authenticated;

-- Written lessons can be long (full SPEC.md starters)
alter table public.lessons drop constraint if exists lessons_description_check;
alter table public.lessons add constraint lessons_description_check check (char_length(description) <= 40000);
