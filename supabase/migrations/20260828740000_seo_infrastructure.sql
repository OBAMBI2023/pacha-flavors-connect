-- SEO infrastructure for tenant storefronts.
--
-- Adds per-tenant SEO override fields to the existing restaurant_settings
-- table (already 1:1 with restaurants, already RLS'd the same way every
-- other tenant setting is) -- no new table, no duplicated per-tenant
-- identity. Exposes them (plus the already-existing but previously unused
-- restaurants.favicon_url/legal_name) through the existing get_public_menu
-- RPC, which already is the single, safely tenant-scoped
-- (is_public = true and status = 'active') public read path used by the
-- storefront. Adds one new narrow RPC, get_public_sitemap_index, purely to
-- enumerate public tenant slugs for the build-time sitemap generator --
-- it returns nothing beyond slug/name/updated_at, no private data.

alter table public.restaurant_settings
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text,
  add column if not exists seo_og_image_url text,
  add column if not exists google_site_verification text,
  add column if not exists bing_site_verification text,
  -- Architecture placeholder for a future custom-domain feature (see task
  -- notes) -- not yet wired to any request-routing/hosting behavior. When
  -- set, the SEO module treats it as the tenant's canonical origin.
  add column if not exists custom_domain text;

create unique index if not exists restaurant_settings_custom_domain_key
  on public.restaurant_settings (custom_domain)
  where custom_domain is not null;

create or replace function public.get_public_menu(p_slug text)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with restaurant_row as (
    select r.*
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1
  )
  select case
    when not exists (select 1 from restaurant_row) then null
    else jsonb_build_object(
      'restaurant', (
        select jsonb_build_object(
          'id', r.id,
          'name', r.name,
          'legal_name', r.legal_name,
          'slug', r.slug,
          'phone', r.phone,
          'whatsapp_phone', r.whatsapp_phone,
          'email', r.email,
          'address', r.address,
          'commune', r.commune,
          'city', r.city,
          'country_code', r.country_code,
          'currency', r.currency,
          'timezone', r.timezone,
          'logo_url', r.logo_url,
          'cover_url', r.cover_url,
          'favicon_url', r.favicon_url,
          'lat', r.lat,
          'lng', r.lng,
          'updated_at', r.updated_at
        )
        from restaurant_row r
      ),
      'settings', (
        select coalesce(
          jsonb_build_object(
            'description', s.description,
            'opening_hours', s.opening_hours,
            'minimum_order', s.minimum_order,
            'delivery_fee', s.delivery_fee,
            'delivery_fee_fallback', s.delivery_fee_fallback,
            'delivery_enabled', s.delivery_enabled,
            'pickup_enabled', s.pickup_enabled,
            'dine_in_enabled', s.dine_in_enabled,
            'reservation_enabled', s.reservation_enabled,
            'default_prep_time_minutes', s.default_prep_time_minutes,
            'primary_color', s.primary_color,
            'whatsapp_message_template', s.whatsapp_message_template,
            'social_links', s.social_links,
            'seo_title', s.seo_title,
            'seo_description', s.seo_description,
            'seo_keywords', s.seo_keywords,
            'seo_og_image_url', s.seo_og_image_url,
            'google_site_verification', s.google_site_verification,
            'bing_site_verification', s.bing_site_verification,
            'custom_domain', s.custom_domain
          ),
          '{}'::jsonb
        )
        from restaurant_row r
        left join public.restaurant_settings s on s.restaurant_id = r.id
      ),
      'availability', (
        select public.get_restaurant_availability(r.id)
        from restaurant_row r
      ),
      'categories', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'description', c.description,
              'sort_order', c.sort_order
            ) order by c.sort_order, c.name
          ),
          '[]'::jsonb
        )
        from public.restaurant_categories c
        join restaurant_row r on r.id = c.restaurant_id
        where c.is_active = true
      ),
      'products', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', p.id,
              'category_id', p.category_id,
              'name', p.name,
              'slug', p.slug,
              'subtitle', p.subtitle,
              'description', p.description,
              'price', p.price,
              'image_path', p.image_path,
              'sku', p.sku,
              'is_available', p.is_available,
              'is_featured', p.is_featured,
              'is_daily_menu', p.is_daily_menu,
              'prep_time_minutes', p.prep_time_minutes,
              'sort_order', p.sort_order,
              'promotion', (
                select case when promo.id is null then null else jsonb_build_object(
                  'title', promo.title,
                  'type', promo.type,
                  'value', promo.value,
                  'final_price', case
                    when promo.type = 'fixed_amount' then greatest(p.price - promo.value, 0)
                    when promo.type = 'percentage' then round(p.price * (1 - promo.value / 100.0))
                    else p.price
                  end
                ) end
                from public.get_active_promotion(p.id) promo
              ),
              'option_groups', (
                select coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'id', g.id,
                      'name', g.name,
                      'is_required', g.is_required,
                      'selection_type', g.selection_type,
                      'min_select', g.min_select,
                      'max_select', g.max_select,
                      'options', (
                        select coalesce(
                          jsonb_agg(
                            jsonb_build_object('id', o.id, 'name', o.name, 'extra_price', o.extra_price)
                            order by o.sort_order, o.name
                          ),
                          '[]'::jsonb
                        )
                        from public.product_options o
                        where o.option_group_id = g.id and o.is_active = true
                      )
                    ) order by g.sort_order, g.name
                  ),
                  '[]'::jsonb
                )
                from public.product_option_groups g
                where g.product_id = p.id and g.is_active = true
              )
            ) order by p.sort_order, p.name
          ),
          '[]'::jsonb
        )
        from public.restaurant_products p
        join restaurant_row r on r.id = p.restaurant_id
        where p.is_active = true
      )
    )
  end;
$function$;

-- Narrow, public, read-only enumeration of indexable tenants for the
-- build-time sitemap generator. Only slug/name/updated_at -- never
-- customer, order, or Admin data.
create or replace function public.get_public_sitemap_index()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slug', r.slug,
        'name', r.name,
        'custom_domain', s.custom_domain,
        'updated_at', greatest(r.updated_at, coalesce(s.updated_at, r.updated_at))
      ) order by r.slug
    ),
    '[]'::jsonb
  )
  from public.restaurants r
  left join public.restaurant_settings s on s.restaurant_id = r.id
  where r.is_public = true and r.status = 'active';
$function$;
