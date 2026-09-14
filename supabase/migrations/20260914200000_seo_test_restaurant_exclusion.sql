-- SEO cleanup: exclude explicitly-flagged test/diagnostic restaurants from
-- public sitemaps (Google Search Console audit, 2026-09-14 found
-- /r/test-diagnostic-claude-20260822 -- a restaurant literally named "TEST
-- DIAGNOSTIC Claude 20260822" -- live, public and indexable).
--
-- Rule applied: exclusion is driven by one explicit, auditable boolean
-- (restaurants.is_test), never inferred from slug/name patterns. A
-- slug/name denylist is fragile in both directions: it must be
-- hand-maintained for every future test row, and it can misfire on a real
-- tenant whose slug merely *looks* test-ish. Case in point from this same
-- audit -- /r/restaurant-test-2 resolves to "INNOS FOOD", a real, active,
-- is_public tenant that simply never had its placeholder slug renamed.
-- Flagging by slug would have deindexed a real, paying restaurant; is_test
-- leaves it untouched because nothing has ever explicitly marked it as test
-- data. Only rows a human has deliberately flagged are excluded.
--
-- Defaults to false so this changes nothing for any existing tenant until
-- someone explicitly opts a row in. No dedicated RPC/UI writes this column
-- yet -- toggling it today is a direct table UPDATE, the same access
-- boundary already documented for restaurants.status (Super Admin's fiche
-- tenant page / direct SQL), not exposed to tenant owners.
alter table public.restaurants
  add column if not exists is_test boolean not null default false;

comment on column public.restaurants.is_test is
  'Explicit, human-set flag for test/diagnostic restaurant rows. Never inferred from slug or name. Excluded from get_public_sitemap_index() and rendered noindex by get_public_menu() consumers, but otherwise fully functional (storefront still loads) so it stays usable for its actual testing purpose.';

-- get_public_sitemap_index: add the is_test exclusion. Everything else
-- (is_public = true, status = 'active', column list) is unchanged from
-- supabase/migrations/20260828740000_seo_infrastructure.sql.
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
  where r.is_public = true and r.status = 'active' and r.is_test = false;
$function$;

-- get_public_menu: expose is_test on the restaurant object so the storefront
-- (src/lib/seo.ts's buildTenantHeadMeta, via src/routes/r.$slug.tsx) can
-- render `noindex` on a flagged tenant's own page -- defense in depth beyond
-- just omitting it from the sitemap, in case a search engine reaches the URL
-- through some other path (a backlink, manual URL guessing, an old cached
-- link). Reproduced from the function's current live definition (confirmed
-- via pg_get_functiondef right before writing this migration -- it had
-- already drifted from supabase/migrations/20260828740000_seo_infrastructure.sql
-- to add tagline, meta_pixel_id, about_section, business_hours and
-- prep_time_minutes_max) with only the one `'is_test', r.is_test` addition.
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
          'updated_at', r.updated_at,
          'is_test', r.is_test
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

-- Flag the one row this audit found that is unambiguously test/diagnostic
-- data by its own business name (not by slug, not by a maintained list) --
-- "TEST DIAGNOSTIC Claude 20260822". No other column on this row changes;
-- this is metadata classification, not a business-data edit, and it is
-- fully reversible with `is_test = false`.
update public.restaurants
  set is_test = true
  where slug = 'test-diagnostic-claude-20260822'
    and name = 'TEST DIAGNOSTIC Claude 20260822';
