-- A visitor can verify only an order created with their own random browser ID.
-- Returns no customer, contact or individual reservation details.
create function public.analytics_payment_status(p_order uuid,p_visitor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_paid boolean; v_value numeric;
begin
  if p_visitor is null or p_order is null then return jsonb_build_object('paid',false); end if;
  select coalesce(order_id,id) into v_order from public.reservations where visitor_id=p_visitor and (order_id=p_order or id=p_order) limit 1;
  if v_order is null then return jsonb_build_object('paid',false); end if;
  select bool_and(status in ('paid','refund_requested') and paid_at is not null),sum(amount)
    into v_paid,v_value from public.reservations where coalesce(order_id,id)=v_order and visitor_id=p_visitor;
  return jsonb_build_object('paid',coalesce(v_paid,false),'value',case when v_paid then v_value else 0 end,'order_id',v_order);
end;
$$;
revoke all on function public.analytics_payment_status(uuid,uuid) from public;
grant execute on function public.analytics_payment_status(uuid,uuid) to anon,authenticated;
