-- Admin → Expenses: recurring costs (subscriptions & salary) and one-time expenses (incl. Facebook ad spend).
-- Applied 2026-10-15. Admin-only (RLS uses is_admin()); no public access.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'software' check (category in ('software','salary','other')),
  billing text not null default 'monthly' check (billing in ('monthly','yearly')),
  amount integer not null default 0 check (amount >= 0 and amount <= 100000000),
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default ((now() at time zone 'Asia/Manila')::date),
  category text not null default 'other' check (category in ('ads','venue','materials','equipment','transport','food','other')),
  description text not null default '' check (char_length(description) <= 200),
  amount integer not null check (amount > 0 and amount <= 100000000),
  created_at timestamptz not null default now()
);
create index if not exists expenses_spent_on_idx on public.expenses (spent_on);
alter table public.subscriptions enable row level security;
alter table public.expenses enable row level security;
create policy "admins manage subscriptions" on public.subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage expenses" on public.expenses for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.subscriptions from anon;
revoke all on table public.expenses from anon;
insert into public.subscriptions (name, category, billing, amount, sort)
select v.name, v.category, 'monthly', 0, v.sort
from (values ('Zoom','software',1), ('Vimeo','software',2), ('Supabase','software',3), ('Vercel','software',4), ('Salary','salary',5)) as v(name, category, sort)
where not exists (select 1 from public.subscriptions);
