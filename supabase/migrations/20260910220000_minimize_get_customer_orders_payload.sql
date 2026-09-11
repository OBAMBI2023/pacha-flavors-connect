-- Security hardening (audit finding M-01, options A + B -- see conversation
-- notes for the access-control question this deliberately does NOT try to
-- resolve): get_customer_orders(p_restaurant_slug, p_customer_phone) is
-- called by anon with only a phone number as proof of identity (guest
-- checkout has no auth session -- a pre-existing, deliberate architectural
-- choice this migration does not change) and returns every order ever
-- placed under that phone at that restaurant.
--
-- Option A -- data minimization: verified against the only frontend
-- consumer (fetchCustomerOrders in src/lib/orders.ts, used exclusively by
-- the "Mes commandes" list at src/routes/commandes.tsx) that the list page
-- renders only order.id, order_number, status, fulfillment_type,
-- total_amount, currency, created_at and restaurant.name. It never reads
-- customer_name, customer_phone, delivery_address, delivery_instructions,
-- estimated_preparation_minutes, subtotal_amount, delivery_fee_amount,
-- discount_amount or items -- those stay reachable only through the
-- separate, order_id+phone scoped get_customer_order(uuid, text) singular
-- RPC (order_id is an unguessable UUID, not just a phone number), which
-- this migration does not touch. So dropping those fields from THIS
-- function's payload removes the address/instructions/name/phone/
-- itemized-cart exposure from the phone-only vector with zero frontend
-- change and zero functional impact on the page that consumes it.
--
-- Option B -- throttle: caps repeated lookups of the SAME (restaurant,
-- phone) pair to slow down automated/real-time scraping of one known
-- number's order feed. Sized well above the page's own legitimate traffic
-- (src/routes/commandes.tsx polls every 15s -- a single open tab makes
-- ~60 calls/15min; the 120/15min ceiling below leaves headroom for a
-- couple of simultaneous tabs/devices on the same phone) so it never
-- affects a real customer.
--
-- Explicitly NOT solved by A+B (see M-01 report for the open options):
-- a caller who already knows one specific real phone number still gets,
-- on the first call, that customer's order existence/status/date/total
-- for this restaurant. Neither option requires a frontend change; the RPC
-- signature and return shape (still a jsonb array of objects) are
-- unchanged, only which fields are populated and an added failure mode
-- (exception once throttled) differ.
create table if not exists public.customer_order_lookup_throttle (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_phone text not null,
  window_start timestamptz not null default now(),
  call_count integer not null default 0,
  primary key (restaurant_id, customer_phone)
);

-- Internal bookkeeping only -- written exclusively from inside the
-- SECURITY DEFINER function below (owned by postgres). No role needs (or
-- gets) a direct grant, and RLS is enabled with no policies as
-- defense-in-depth so no future GRANT alone could open a parallel access
-- path to it.
alter table public.customer_order_lookup_throttle enable row level security;
revoke all on public.customer_order_lookup_throttle from public, anon, authenticated;

create or replace function public.get_customer_orders(p_restaurant_slug text, p_customer_phone text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_restaurant_id uuid;
  v_call_count integer;
  v_result jsonb;
  v_window_minutes constant integer := 15;
  v_max_calls constant integer := 120;
begin
  select r.id into v_restaurant_id from public.restaurants r where r.slug = p_restaurant_slug;
  if v_restaurant_id is null then
    return '[]'::jsonb;
  end if;

  -- Atomic upsert: resets the window when it has expired, otherwise
  -- increments -- single statement avoids a read-then-write race between
  -- concurrent calls for the same (restaurant, phone).
  insert into public.customer_order_lookup_throttle as t (restaurant_id, customer_phone, window_start, call_count)
  values (v_restaurant_id, p_customer_phone, now(), 1)
  on conflict (restaurant_id, customer_phone) do update
    set call_count = case
          when t.window_start < now() - (v_window_minutes || ' minutes')::interval then 1
          else t.call_count + 1
        end,
        window_start = case
          when t.window_start < now() - (v_window_minutes || ' minutes')::interval then now()
          else t.window_start
        end
  returning t.call_count into v_call_count;

  if v_call_count > v_max_calls then
    raise exception 'Trop de tentatives, réessayez plus tard.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ord.id,
      'order_number', ord.order_number,
      'status', ord.status,
      'fulfillment_type', ord.fulfillment_type,
      'currency', ord.currency,
      'total_amount', ord.total_amount,
      'created_at', ord.created_at,
      'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug)
    ) order by ord.created_at desc
  ), '[]'::jsonb)
  into v_result
  from public.orders ord
  join public.restaurants r on r.id = ord.restaurant_id
  where r.id = v_restaurant_id
    and ord.customer_phone = p_customer_phone;

  return v_result;
end;
$$;

grant execute on function public.get_customer_orders(text, text) to anon, authenticated;
