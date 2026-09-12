-- "Notre histoire" storefront section: fully tenant-configurable from Admin
-- Settings > Notre histoire. Reuses restaurant_settings exactly like every
-- other tenant preference (SEO fields, social_links, business hours...)
-- instead of a new table -- one row per restaurant already exists
-- (DB-enforced), the existing owner/manager ALL policy on
-- restaurant_settings already scopes reads/writes to the tenant's own row,
-- and no new RLS is needed. One jsonb column holds the whole section
-- (title/description/highlights/etc.) rather than ~11 new scalar columns,
-- matching the precedent set by `social_links`.
--
-- Shape (all keys optional, absent/empty = "not configured yet"):
-- {
--   "enabled": boolean,
--   "eyebrow": text, "title": text, "description": text,
--   "secondary_description": text, "signature": text, "cta_label": text,
--   "chef_name": text, "chef_role": text, "chef_message": text,
--   "main_image_url": text,
--   "highlights": [{ "icon": text, "title": text, "description": text }]  -- max 4
-- }
--
-- No length/shape CHECK constraint on the jsonb content: exactly like
-- tagline/description/social_links above it, length limits are enforced by
-- the admin form's own maxLength inputs, not the database. Rendering is
-- always plain JSX text interpolation (React's default escaping) on both
-- the admin preview and the public storefront -- never
-- dangerouslySetInnerHTML -- so a stored value can never execute as HTML/JS
-- regardless of its content.
alter table public.restaurant_settings
  add column if not exists about_section jsonb not null default '{}'::jsonb;

-- get_public_menu: signature and every existing field unchanged, only one
-- new key added to the `settings` object (same coalesce-to-'{}' shape as
-- every other settings field here). A restaurant that never configured this
-- section gets back the column's own default {} with no reference to any
-- other tenant's content -- restaurant_row is still resolved solely from
-- p_slug, exactly as before.
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
            'tagline', s.tagline,
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
            'custom_domain', s.custom_domain,
            'meta_pixel_id', case when s.meta_pixel_enabled then s.meta_pixel_id else null end,
            'about_section', coalesce(s.about_section, '{}'::jsonb)
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
      'business_hours', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'day_of_week', h.day_of_week,
              'is_open', h.is_open,
              'opening_time', h.opening_time,
              'closing_time', h.closing_time
            ) order by h.day_of_week, h.opening_time
          ),
          '[]'::jsonb
        )
        from public.tenant_business_hours h
        join restaurant_row r on r.id = h.restaurant_id
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
              'prep_time_minutes_max', p.prep_time_minutes_max,
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
