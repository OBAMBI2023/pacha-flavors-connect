-- Phase 7c: curated read for the driver's current pending proposal, same
-- rationale as get_driver_active_delivery() from phase7b -- avoids relying
-- on a client-side join to `restaurants` (whose direct-select RLS story is
-- unclear/likely member-only, since the public storefront goes through
-- SECURITY DEFINER get_public_* RPCs rather than direct table reads) just
-- to show the restaurant name on the accept/refuse screen. No customer data
-- is included here at all -- that only ever becomes visible via
-- get_driver_active_delivery() after acceptance.
create or replace function public.get_driver_pending_proposal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposal record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.id, p.order_id, p.distance_km, p.expires_at, p.restaurant_id, o.order_number
    into v_proposal
    from public.delivery_proposals p
    join public.orders o on o.id = p.order_id
    where p.driver_id = auth.uid()
      and p.status = 'pending'
    order by p.sent_at desc
    limit 1;

  if v_proposal.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'proposal_id', v_proposal.id,
    'order_id', v_proposal.order_id,
    'order_number', v_proposal.order_number,
    'restaurant_name', (select name from public.restaurants where id = v_proposal.restaurant_id),
    'distance_km', v_proposal.distance_km,
    'expires_at', v_proposal.expires_at
  );
end;
$$;

revoke all on function public.get_driver_pending_proposal() from public, anon;
grant execute on function public.get_driver_pending_proposal() to authenticated;
