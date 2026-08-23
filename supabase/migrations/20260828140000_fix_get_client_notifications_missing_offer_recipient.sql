-- Bug found in testing: the offer branch used an INNER JOIN on
-- offer_recipients, so an active offer this visitor had never seen (no
-- recipient row yet) was correctly counted as unread by
-- get_unread_client_notifications_count (LEFT JOIN there) but silently
-- excluded from get_client_notifications's actual list (INNER JOIN here)
-- -- the badge would show 1 but the panel would show nothing new. Fixed
-- by lazily creating the recipient row first (same pattern as
-- get_tenant_offers) and switching to a LEFT JOIN, so the two RPCs agree.

create or replace function public.get_client_notifications(p_slug text, p_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_result jsonb;
begin
  if p_visitor_id is null or btrim(p_visitor_id) = '' then
    return '[]'::jsonb;
  end if;

  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug and r.is_public = true and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return '[]'::jsonb;
  end if;

  insert into public.offer_recipients (offer_id, visitor_id)
  select o.id, p_visitor_id
    from public.offers o
    where o.restaurant_id = v_restaurant_id
      and o.status = 'active'
      and (o.starts_at is null or o.starts_at <= now())
      and (o.ends_at is null or o.ends_at >= now())
  on conflict (offer_id, visitor_id) do nothing;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        n.created_at,
        jsonb_build_object(
          'id', n.id, 'type', n.type, 'title', n.title, 'body', n.body,
          'link_type', n.link_type, 'link_id', n.link_id, 'is_read', n.is_read, 'created_at', n.created_at
        ) as row_data
      from public.client_notifications n
      where n.restaurant_id = v_restaurant_id and n.visitor_id = p_visitor_id

      union all

      select
        o.created_at,
        jsonb_build_object(
          'id', o.id, 'type', 'new_offer', 'title', o.title,
          'body', format('Profitez de -%s%% sur %s', round((1 - o.offer_price / o.original_price) * 100), p.name),
          'link_type', 'offer', 'link_id', o.id, 'is_read', coalesce(r.is_read, false), 'created_at', o.created_at
        ) as row_data
      from public.offers o
      join public.restaurant_products p on p.id = o.product_id
      left join public.offer_recipients r on r.offer_id = o.id and r.visitor_id = p_visitor_id
      where o.restaurant_id = v_restaurant_id
        and o.status = 'active'
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at >= now())
    ) feed;

  return v_result;
end;
$function$;
