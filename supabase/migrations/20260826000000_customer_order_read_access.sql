-- Customers are anonymous at checkout (create_order runs SECURITY DEFINER
-- precisely because there is no auth session to attach an RLS-friendly
-- identity to). RLS on `orders` only grants SELECT to restaurant members
-- (orders_select_members), so today there is no way for a customer to read
-- back their own order -- the tenant storefront's "Commandes" page and order
-- confirmation screen always come back empty. These two read-only RPCs close
-- that gap the same way create_order closes the write-side gap: they run as
-- the table owner and manually scope every row to the caller-supplied phone
-- number, which is the only identity a guest checkout has.

create or replace function public.get_customer_orders(p_restaurant_slug text, p_customer_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ord.id,
      'order_number', ord.order_number,
      'status', ord.status,
      'fulfillment_type', ord.fulfillment_type,
      'customer_name', ord.customer_name,
      'customer_phone', ord.customer_phone,
      'delivery_address', ord.delivery_address,
      'delivery_instructions', ord.delivery_instructions,
      'currency', ord.currency,
      'subtotal_amount', ord.subtotal_amount,
      'total_amount', ord.total_amount,
      'created_at', ord.created_at,
      'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name_snapshot,
            'unit_price', oi.unit_price_snapshot,
            'quantity', oi.quantity,
            'line_total', oi.line_total
          ) order by oi.created_at asc
        ), '[]'::jsonb)
        from public.order_items oi
        where oi.order_id = ord.id
      )
    ) order by ord.created_at desc
  ), '[]'::jsonb)
  from public.orders ord
  join public.restaurants r on r.id = ord.restaurant_id
  where r.slug = p_restaurant_slug
    and ord.customer_phone = p_customer_phone;
$$;

grant execute on function public.get_customer_orders(text, text) to anon, authenticated;

create or replace function public.get_customer_order(p_order_id uuid, p_customer_phone text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', ord.id,
    'order_number', ord.order_number,
    'status', ord.status,
    'fulfillment_type', ord.fulfillment_type,
    'customer_name', ord.customer_name,
    'customer_phone', ord.customer_phone,
    'delivery_address', ord.delivery_address,
    'delivery_instructions', ord.delivery_instructions,
    'currency', ord.currency,
    'subtotal_amount', ord.subtotal_amount,
    'total_amount', ord.total_amount,
    'created_at', ord.created_at,
    'restaurant', jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug),
    'items', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', oi.product_name_snapshot,
          'unit_price', oi.unit_price_snapshot,
          'quantity', oi.quantity,
          'line_total', oi.line_total
        ) order by oi.created_at asc
      ), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = ord.id
    )
  )
  from public.orders ord
  join public.restaurants r on r.id = ord.restaurant_id
  where ord.id = p_order_id
    and ord.customer_phone = p_customer_phone;
$$;

grant execute on function public.get_customer_order(uuid, text) to anon, authenticated;
