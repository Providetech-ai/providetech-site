-- Automatic "Still interested?" follow-up emails for unpaid checkouts.
-- At most 2 per order: 1 hour after checkout started, then 24 hours later (Admin → Settings).
alter table public.reservations add column if not exists followup_count int not null default 0;
alter table public.reservations add column if not exists followup_last_at timestamptz;

insert into public.settings (key, value, public)
values ('followups', '{"enabled": false, "first_hours": 1, "second_hours": 24}'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.run_payment_followups()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://bfojtvszuvhajmwfkapk.supabase.co/functions/v1/payment-followup',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select value from public.private_config where key = 'cron_secret')),
    timeout_milliseconds := 60000);
end;
$$;
revoke execute on function public.run_payment_followups() from public, anon, authenticated;
select cron.schedule('providetech-payment-followups', '*/15 * * * *', 'select public.run_payment_followups();');
