begin;
do $$
declare v_session uuid; v_result jsonb; v_id uuid; v_status jsonb;
begin
  select id into v_session from public.sessions where format='online' and status='open'
    and date >= (now() at time zone 'Asia/Manila')::date order by date limit 1;
  if v_session is null then raise exception 'No open test session'; end if;
  perform public.track_site_event('00000000-0000-4000-8000-000000000073','page_view','/','facebook','paid','rollback-test','test-creative','','facebook.com',now());
  v_result:=public.reserve_order_with_attribution(jsonb_build_array(jsonb_build_object('session',v_session)),
    'Analytics Test','analytics-test@example.com','9170000000','gcash',p_visitor=>'00000000-0000-4000-8000-000000000073');
  v_id:=(v_result->'ids'->>0)::uuid;
  if not exists(select 1 from public.reservations where id=v_id and utm_campaign='rollback-test') then raise exception 'Missing booking attribution'; end if;
  v_status:=public.analytics_payment_status(v_id,'00000000-0000-4000-8000-000000000073');
  if (v_status->>'paid')::boolean then raise exception 'Pending booking reported paid'; end if;
  update public.reservations set status='paid',paid_at=now() where id=v_id;
  v_status:=public.analytics_payment_status(v_id,'00000000-0000-4000-8000-000000000073');
  if not (v_status->>'paid')::boolean or (v_status->>'value')::numeric<=0 then raise exception 'Paid status not verified'; end if;
  if v_status ? 'email' or v_status ? 'name' then raise exception 'Private data in payment response'; end if;
  v_status:=public.analytics_payment_status(v_id,'00000000-0000-4000-8000-000000000074');
  if (v_status->>'paid')::boolean or v_status ? 'value' then raise exception 'Another visitor can inspect payment'; end if;
end $$;
rollback;
