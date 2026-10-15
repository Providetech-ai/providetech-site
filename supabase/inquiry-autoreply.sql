-- Automatic reply to website inquiries.
-- The inquiry remembers the visitor's language, and right after it's saved the database
-- calls the inquiry-autoreply function (pg_net), which emails the visitor once.

alter table public.inquiries add column if not exists lang text not null default 'en';
alter table public.inquiries add column if not exists autoreply_sent_at timestamptz;
alter table public.inquiries add column if not exists autoreply_status text not null default '';

-- Same as submit_inquiry, plus the visitor's language (en / tl / ceb)
create or replace function public.submit_inquiry_v2(p_name text, p_business text, p_email text, p_phone text,
  p_need text, p_message text, p_source text default 'Website', p_lang text default 'en')
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare new_id uuid;
begin
  if char_length(coalesce(trim(p_name), '')) < 2 then raise exception 'NAME'; end if;
  if coalesce(trim(p_email), '') = '' and coalesce(trim(p_phone), '') = '' then raise exception 'CONTACT'; end if;
  insert into public.inquiries (name, business, email, phone, need, message, source, lang)
  values (left(trim(p_name), 120), left(coalesce(trim(p_business), ''), 160), lower(left(coalesce(trim(p_email), ''), 200)),
          left(coalesce(trim(p_phone), ''), 40), left(coalesce(trim(p_need), ''), 160),
          left(coalesce(trim(p_message), ''), 2000), left(coalesce(nullif(trim(p_source), ''), 'Website'), 60),
          case when p_lang in ('en','tl','ceb') then p_lang else 'en' end)
  returning id into new_id;
  return new_id;
end;
$function$;
grant execute on function public.submit_inquiry_v2(text,text,text,text,text,text,text,text) to anon, authenticated;

-- After an inquiry with an email is saved, ask the edge function to send the auto-reply.
-- Never blocks or fails the inquiry itself.
create or replace function public.inquiry_autoreply_fire()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
begin
  begin
    perform net.http_post(
      url := 'https://bfojtvszuvhajmwfkapk.supabase.co/functions/v1/inquiry-autoreply',
      body := jsonb_build_object('id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select value from public.private_config where key = 'cron_secret')),
      timeout_milliseconds := 30000);
  exception when others then
    raise warning 'inquiry auto-reply not queued: %', sqlerrm;  -- the inquiry is still saved
  end;
  return new;
end;
$function$;
revoke all on function public.inquiry_autoreply_fire() from public, anon, authenticated;

create or replace trigger inquiries_autoreply
after insert on public.inquiries
for each row when (coalesce(new.email, '') <> '')
execute function public.inquiry_autoreply_fire();

insert into public.settings (key, value, public)
values ('inquiry_reply', '{"enabled": true}'::jsonb, false)
on conflict (key) do nothing;
