-- PROVIDETECH: turn on "Delete" for workshop batches in /admin (run once in Supabase → SQL Editor).
-- A batch with anyone who paid, asked for a refund or was refunded can never be deleted.
-- Unpaid or cancelled reservations in the batch are removed with it. The Builder Hub can't be deleted.
create or replace function public.admin_delete_session(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.sessions%rowtype;
  v_money int;
  v_removed int;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into s from public.sessions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.format = 'hub' then raise exception 'HUB'; end if;
  select count(*) into v_money from public.reservations
   where session_id = p_id and status in ('paid','refund_requested','refunded');
  if v_money > 0 then raise exception 'HAS_PAID:%', v_money; end if;
  delete from public.reservations where session_id = p_id;
  get diagnostics v_removed = row_count;
  delete from public.sessions where id = p_id;
  return jsonb_build_object('ok', true, 'code', s.code, 'removed_reservations', v_removed);
end;
$$;
revoke all on function public.admin_delete_session(uuid) from public;
grant execute on function public.admin_delete_session(uuid) to authenticated;
