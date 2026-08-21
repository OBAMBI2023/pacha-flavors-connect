-- Extend the public marketplace feed with the data needed for restaurant discovery:
-- dish-type tags (derived from real menu categories), delivery/pickup info, and a
-- cheap-meals feed. No fabricated fields (ratings, ETAs, promos) are introduced.

create or replace function public.get_public_restaurants(p_query text default null)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'slug', r.slug,
        'name', r.name,
        'logo_url', r.logo_url,
        'cover_url', r.cover_url,
        'address', r.address,
        'commune', r.commune,
        'city', r.city,
        'description', s.description,
        'delivery_fee', coalesce(s.delivery_fee, 0),
        'minimum_order', coalesce(s.minimum_order, 0),
        'delivery_enabled', coalesce(s.delivery_enabled, true),
        'pickup_enabled', coalesce(s.pickup_enabled, true),
        'dish_types', coalesce(dt.types, '{}'::text[])
      )
      order by r.name asc
    ),
    '[]'::jsonb
  )
  from public.restaurants r
  left join public.restaurant_settings s on s.restaurant_id = r.id
  left join lateral (
    select array_agg(distinct c.name order by c.name) as types
    from public.restaurant_categories c
    where c.restaurant_id = r.id
      and c.is_active
      and exists (
        select 1 from public.restaurant_products p
        where p.category_id = c.id and p.is_active and p.is_available
      )
  ) dt on true
  where r.is_public = true
    and r.status = 'active'
    and (p_query is null or btrim(p_query) = '' or r.name ilike '%' || p_query || '%');
$$;

revoke all on function public.get_public_restaurants(text) from public;
grant execute on function public.get_public_restaurants(text) to anon, authenticated;

create or replace function public.get_public_cheap_products(p_max_price numeric default 4000, p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'name', x.name,
        'price', x.price,
        'image_path', x.image_path,
        'restaurant_id', x.restaurant_id,
        'restaurant_slug', x.restaurant_slug,
        'restaurant_name', x.restaurant_name
      )
      order by x.price asc
    ),
    '[]'::jsonb
  )
  from (
    select p.id, p.name, p.price, p.image_path,
           r.id as restaurant_id, r.slug as restaurant_slug, r.name as restaurant_name
    from public.restaurant_products p
    join public.restaurants r on r.id = p.restaurant_id
    where p.is_active and p.is_available
      and p.price is not null and p.price <= p_max_price
      and r.is_public = true and r.status = 'active'
    order by p.price asc
    limit greatest(p_limit, 0)
  ) x;
$$;

revoke all on function public.get_public_cheap_products(numeric, integer) from public;
grant execute on function public.get_public_cheap_products(numeric, integer) to anon, authenticated;
