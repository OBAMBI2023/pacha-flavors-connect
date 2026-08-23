-- ---------------------------------------------------------------------------
-- Feature: tenant business hours, date exceptions, and manual open/closed
-- override -- computed with priority exception > manual > weekly schedule,
-- timezone-aware (restaurants.timezone, already exists, default
-- Africa/Abidjan), correctly handling slots that cross midnight.
--
-- Naming note: every existing multi-tenant table uses `restaurant_id` (there
-- is no `tenants` table) -- these two new tables follow that exact existing
-- convention instead of introducing a one-off `tenant_id` synonym.
--
-- day_of_week uses the same convention as JS Date.getDay() / Postgres
-- extract(dow from ...): 0 = Sunday .. 6 = Saturday.
-- ---------------------------------------------------------------------------

create table public.tenant_business_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  opening_time time,
  closing_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_business_hours_times_check check (
    (is_open and opening_time is not null and closing_time is not null)
    or (not is_open and opening_time is null and closing_time is null)
  )
);

create index tenant_business_hours_restaurant_day_idx on public.tenant_business_hours (restaurant_id, day_of_week);

alter table public.tenant_business_hours enable row level security;

create policy business_hours_manage_owner_manager
  on public.tenant_business_hours for all
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner'::public.restaurant_role, 'manager'::public.restaurant_role]))
  with check (public.has_restaurant_role(restaurant_id, array['owner'::public.restaurant_role, 'manager'::public.restaurant_role]));

create policy business_hours_select_members
  on public.tenant_business_hours for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

-- Defense in depth beyond the CHECK constraint: prevents overlapping (or
-- exact duplicate) active slots on the same day, correctly accounting for
-- slots that cross midnight (closing_time <= opening_time).
create or replace function public.validate_business_hours_slot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start int;
  v_end int;
  v_conflict record;
  v_c_start int;
  v_c_end int;
begin
  if new.is_open then
    v_start := extract(hour from new.opening_time)::int * 60 + extract(minute from new.opening_time)::int;
    v_end := extract(hour from new.closing_time)::int * 60 + extract(minute from new.closing_time)::int;
    if v_end <= v_start then
      v_end := v_end + 1440;
    end if;

    for v_conflict in
      select opening_time, closing_time
      from public.tenant_business_hours
      where restaurant_id = new.restaurant_id
        and day_of_week = new.day_of_week
        and is_open = true
        and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    loop
      v_c_start := extract(hour from v_conflict.opening_time)::int * 60 + extract(minute from v_conflict.opening_time)::int;
      v_c_end := extract(hour from v_conflict.closing_time)::int * 60 + extract(minute from v_conflict.closing_time)::int;
      if v_c_end <= v_c_start then
        v_c_end := v_c_end + 1440;
      end if;
      if v_start < v_c_end and v_c_start < v_end then
        raise exception 'Ce créneau chevauche un créneau existant pour ce jour';
      end if;
    end loop;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tenant_business_hours_validate
  before insert or update on public.tenant_business_hours
  for each row execute function public.validate_business_hours_slot();

create table public.tenant_business_exceptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  date date not null,
  end_date date,
  is_open boolean not null,
  opening_time time,
  closing_time time,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_business_exceptions_end_date_check check (end_date is null or end_date >= date),
  constraint tenant_business_exceptions_times_check check (
    (is_open and opening_time is not null and closing_time is not null)
    or (not is_open and opening_time is null and closing_time is null)
  )
);

create index tenant_business_exceptions_restaurant_date_idx on public.tenant_business_exceptions (restaurant_id, date);

alter table public.tenant_business_exceptions enable row level security;

create policy business_exceptions_manage_owner_manager
  on public.tenant_business_exceptions for all
  to authenticated
  using (public.has_restaurant_role(restaurant_id, array['owner'::public.restaurant_role, 'manager'::public.restaurant_role]))
  with check (public.has_restaurant_role(restaurant_id, array['owner'::public.restaurant_role, 'manager'::public.restaurant_role]));

create policy business_exceptions_select_members
  on public.tenant_business_exceptions for select
  to authenticated
  using (public.has_restaurant_access(restaurant_id));

create or replace function public.touch_business_exception_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tenant_business_exceptions_touch
  before update on public.tenant_business_exceptions
  for each row execute function public.touch_business_exception_updated_at();

-- Manual override: reuses restaurant_settings (already one row per
-- restaurant, already RLS-protected by settings_manage_owner_manager /
-- settings_select_members) instead of a new table for just two fields.
alter table public.restaurant_settings
  add column manual_override boolean not null default false,
  add column manual_status text check (manual_status in ('open', 'closed')),
  add constraint restaurant_settings_manual_override_requires_status check (not manual_override or manual_status is not null);

-- ---------------------------------------------------------------------------
-- get_next_opening: earliest future moment the restaurant will be open,
-- scanning up to 14 days ahead. Respects exceptions (a closed exception
-- blocks that date entirely; an open exception with its own hours is used
-- instead of the weekly schedule for that date) and a persistent manual
-- override (an indefinite manual closure has no "automatic" reopening to
-- report, so this returns null rather than a misleading future date).
-- ---------------------------------------------------------------------------
create or replace function public.get_next_opening(p_restaurant_id uuid, p_after timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_manual_override boolean;
  v_check_date date;
  v_day int;
  v_i int;
  v_exception record;
  v_slot record;
  v_starts_at timestamptz;
  v_best timestamptz := null;
begin
  select timezone into v_tz from public.restaurants where id = p_restaurant_id;
  if v_tz is null then
    return null;
  end if;

  select manual_override into v_manual_override from public.restaurant_settings where restaurant_id = p_restaurant_id;
  if coalesce(v_manual_override, false) then
    return null;
  end if;

  for v_i in 0..13 loop
    v_check_date := (p_after at time zone v_tz)::date + v_i;

    select * into v_exception
      from public.tenant_business_exceptions e
      where e.restaurant_id = p_restaurant_id
        and v_check_date between e.date and coalesce(e.end_date, e.date)
      order by e.updated_at desc
      limit 1;

    if v_exception.id is not null then
      if v_exception.is_open then
        v_starts_at := (v_check_date + v_exception.opening_time) at time zone v_tz;
        if v_starts_at > p_after then
          v_best := v_starts_at;
        end if;
      end if;
    else
      v_day := extract(dow from v_check_date)::int;
      for v_slot in
        select opening_time from public.tenant_business_hours
        where restaurant_id = p_restaurant_id and day_of_week = v_day and is_open = true
      loop
        v_starts_at := (v_check_date + v_slot.opening_time) at time zone v_tz;
        if v_starts_at > p_after and (v_best is null or v_starts_at < v_best) then
          v_best := v_starts_at;
        end if;
      end loop;
    end if;

    if v_best is not null then
      exit;
    end if;
  end loop;

  return v_best;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_restaurant_availability: the single source of truth for "is this
-- restaurant open right now", used identically by get_public_menu (display)
-- and create_order (real server-side enforcement) so the two can never
-- disagree. Priority: date exception > manual override > weekly schedule.
--
-- A restaurant that has never configured any weekly hours fails OPEN
-- (reason 'unconfigured') -- true for every existing tenant when this
-- feature ships, and required so it can never silently block ordering for
-- a tenant who hasn't opted into the schedule feature yet. Exceptions and
-- manual override are explicit admin actions and still take priority
-- regardless of whether weekly hours were ever configured.
-- ---------------------------------------------------------------------------
create or replace function public.get_restaurant_availability(p_restaurant_id uuid, p_now timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_local_date date;
  v_exception record;
  v_manual_override boolean;
  v_manual_status text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_offsets int[] := array[0, -1];
  v_offset int;
  v_check_date date;
  v_day int;
  v_slot record;
  v_has_any_hours boolean;
begin
  select timezone into v_tz from public.restaurants where id = p_restaurant_id;
  if v_tz is null then
    return jsonb_build_object('is_open', false, 'reason', 'unknown', 'closes_at', null, 'next_opens_at', null);
  end if;

  v_local_date := (p_now at time zone v_tz)::date;

  -- 1) Date exception.
  select * into v_exception
    from public.tenant_business_exceptions e
    where e.restaurant_id = p_restaurant_id
      and v_local_date between e.date and coalesce(e.end_date, e.date)
    order by e.updated_at desc
    limit 1;

  if v_exception.id is not null then
    if not v_exception.is_open then
      return jsonb_build_object(
        'is_open', false, 'reason', 'exception', 'closes_at', null,
        'next_opens_at', public.get_next_opening(p_restaurant_id, p_now)
      );
    end if;

    v_starts_at := (v_local_date + v_exception.opening_time) at time zone v_tz;
    v_ends_at := case when v_exception.closing_time <= v_exception.opening_time
      then (v_local_date + 1 + v_exception.closing_time) at time zone v_tz
      else (v_local_date + v_exception.closing_time) at time zone v_tz
    end;

    if p_now >= v_starts_at and p_now < v_ends_at then
      return jsonb_build_object('is_open', true, 'reason', 'exception', 'closes_at', v_ends_at, 'next_opens_at', null);
    end if;

    return jsonb_build_object(
      'is_open', false, 'reason', 'exception', 'closes_at', null,
      'next_opens_at', case when p_now < v_starts_at then v_starts_at else public.get_next_opening(p_restaurant_id, p_now) end
    );
  end if;

  -- 2) Manual override.
  select manual_override, manual_status into v_manual_override, v_manual_status
    from public.restaurant_settings where restaurant_id = p_restaurant_id;

  if coalesce(v_manual_override, false) then
    return jsonb_build_object(
      'is_open', (v_manual_status = 'open'), 'reason', 'manual', 'closes_at', null, 'next_opens_at', null
    );
  end if;

  -- 2.5) Never configured any weekly hours -- fail open.
  select exists(select 1 from public.tenant_business_hours where restaurant_id = p_restaurant_id) into v_has_any_hours;
  if not v_has_any_hours then
    return jsonb_build_object('is_open', true, 'reason', 'unconfigured', 'closes_at', null, 'next_opens_at', null);
  end if;

  -- 3) Weekly schedule -- check today AND yesterday's slots (an overnight
  -- slot from yesterday, e.g. 18:00->02:00, is still "open" in the early
  -- hours of today).
  foreach v_offset in array v_offsets loop
    v_check_date := v_local_date + v_offset;
    v_day := extract(dow from v_check_date)::int;
    for v_slot in
      select opening_time, closing_time from public.tenant_business_hours
      where restaurant_id = p_restaurant_id and day_of_week = v_day and is_open = true
    loop
      v_starts_at := (v_check_date + v_slot.opening_time) at time zone v_tz;
      v_ends_at := case when v_slot.closing_time <= v_slot.opening_time
        then (v_check_date + 1 + v_slot.closing_time) at time zone v_tz
        else (v_check_date + v_slot.closing_time) at time zone v_tz
      end;
      if p_now >= v_starts_at and p_now < v_ends_at then
        return jsonb_build_object('is_open', true, 'reason', 'schedule', 'closes_at', v_ends_at, 'next_opens_at', null);
      end if;
    end loop;
  end loop;

  return jsonb_build_object(
    'is_open', false, 'reason', 'schedule', 'closes_at', null,
    'next_opens_at', public.get_next_opening(p_restaurant_id, p_now)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_public_menu: additive diff -- adds 'availability' (is_open, reason,
-- closes_at, next_opens_at) computed via get_restaurant_availability.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_menu(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = 'public'
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
          'cover_url', r.cover_url
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
            'delivery_enabled', s.delivery_enabled,
            'pickup_enabled', s.pickup_enabled,
            'dine_in_enabled', s.dine_in_enabled,
            'reservation_enabled', s.reservation_enabled,
            'default_prep_time_minutes', s.default_prep_time_minutes,
            'primary_color', s.primary_color,
            'whatsapp_message_template', s.whatsapp_message_template,
            'social_links', s.social_links
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

-- ---------------------------------------------------------------------------
-- create_order: additive diff on the exact live function. Every existing
-- validation, join, and column is unchanged; the only new behavior is
-- rejecting new orders when the restaurant is currently closed, using the
-- same get_restaurant_availability the storefront displays -- so the two
-- can never disagree, and this can't be bypassed by a client that ignores
-- the public "closed" banner. Restaurants with no configured hours fail
-- open (see get_restaurant_availability), so this never blocks ordering for
-- a tenant who hasn't set up the schedule feature yet.
-- ---------------------------------------------------------------------------
create or replace function public.create_order(
  p_slug text,
  p_fulfillment_type public.order_fulfillment_type,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_delivery_commune text default null,
  p_delivery_address text default null,
  p_delivery_instructions text default null,
  p_customer_notes text default null,
  p_order_source text default 'direct',
  p_source_metadata jsonb default '{}'::jsonb,
  p_payment_method text default 'cash'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant record;
  v_settings record;
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_total numeric := 0;
  v_item_count integer := 0;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_unit_price numeric;
  v_options_price numeric;
  v_line_total numeric;
  v_order_item_id uuid;
  v_option text;
  v_option_id uuid;
  v_option_row record;
  v_group record;
  v_selected_count integer;
  v_order_source text;
  v_payment_method public.payment_method;
  v_payment_status public.payment_status;
  v_promo public.product_promotions;
  v_discount_amount numeric := 0;
  v_free_delivery boolean := false;
  v_availability jsonb;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'Le nom du client est requis';
  end if;
  if p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'Le téléphone du client est requis';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La commande doit contenir au moins un article';
  end if;

  v_order_source := case
    when p_order_source in ('direct', 'marketplace', 'qr_code', 'unknown') then p_order_source
    else 'unknown'
  end;
  v_payment_method := case
    when p_payment_method in ('cash', 'mobile_money', 'card', 'online') then p_payment_method::public.payment_method
    else 'unknown'::public.payment_method
  end;
  v_payment_status := case when v_payment_method = 'cash' then 'cash_pending'::public.payment_status else 'pending'::public.payment_status end;

  select r.id, r.currency
    into v_restaurant
    from public.restaurants r
    where r.slug = p_slug
      and r.is_public = true
      and r.status = 'active'
    limit 1;

  if v_restaurant.id is null then
    raise exception 'Restaurant introuvable ou indisponible';
  end if;

  v_availability := public.get_restaurant_availability(v_restaurant.id);
  if not coalesce((v_availability->>'is_open')::boolean, false) then
    raise exception 'Ce restaurant est actuellement fermé. Les commandes ne sont pas acceptées pour le moment.';
  end if;

  select s.delivery_enabled, s.pickup_enabled, s.delivery_fee, s.minimum_order
    into v_settings
    from public.restaurant_settings s
    where s.restaurant_id = v_restaurant.id;

  if p_fulfillment_type = 'delivery' and coalesce(v_settings.delivery_enabled, true) = false then
    raise exception 'La livraison n''est pas disponible pour ce restaurant';
  end if;
  if p_fulfillment_type = 'pickup' and coalesce(v_settings.pickup_enabled, true) = false then
    raise exception 'Le retrait sur place n''est pas disponible pour ce restaurant';
  end if;
  if p_fulfillment_type = 'delivery' and btrim(coalesce(p_delivery_address, '')) = '' then
    raise exception 'Adresse de livraison requise';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Quantité invalide pour un article';
    end if;

    select p.id, p.name, p.price, p.is_active, p.is_available
      into v_product
      from public.restaurant_products p
      where p.id = (v_item->>'product_id')::uuid
        and p.restaurant_id = v_restaurant.id;

    if v_product.id is null then
      raise exception 'Produit introuvable: %', (v_item->>'product_id');
    end if;
    if v_product.is_active = false or v_product.is_available = false then
      raise exception 'Produit indisponible: %', v_product.name;
    end if;
    if v_product.price is null then
      raise exception 'Ce produit n''a pas de prix défini: %', v_product.name;
    end if;

    v_options_price := 0;

    for v_group in
      select g.id, g.name, g.is_required, g.selection_type, g.min_select, g.max_select
        from public.product_option_groups g
        where g.product_id = v_product.id
          and g.restaurant_id = v_restaurant.id
          and g.is_active = true
    loop
      select count(*)
        into v_selected_count
        from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) sel(option_id)
        join public.product_options po
          on po.id = sel.option_id::uuid
         and po.option_group_id = v_group.id
         and po.is_active = true;

      if v_group.is_required and v_selected_count < greatest(v_group.min_select, 1) then
        raise exception 'Sélection requise pour: %', v_group.name;
      end if;
      if v_selected_count < v_group.min_select then
        raise exception 'Sélection insuffisante pour: %', v_group.name;
      end if;
      if v_group.selection_type = 'single' and v_selected_count > 1 then
        raise exception 'Une seule option autorisée pour: %', v_group.name;
      end if;
      if v_group.max_select is not null and v_selected_count > v_group.max_select then
        raise exception 'Trop d''options sélectionnées pour: %', v_group.name;
      end if;
    end loop;

    for v_option in select * from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) as t(value)
    loop
      v_option_id := v_option::uuid;

      select po.id, po.name, po.extra_price, g.name as group_name
        into v_option_row
        from public.product_options po
        join public.product_option_groups g on g.id = po.option_group_id
        where po.id = v_option_id
          and po.restaurant_id = v_restaurant.id
          and g.product_id = v_product.id
          and po.is_active = true;

      if v_option_row.id is null then
        raise exception 'Option invalide pour le produit %', v_product.name;
      end if;

      v_options_price := v_options_price + v_option_row.extra_price;
    end loop;

    v_promo := public.get_active_promotion(v_product.id);
    if v_promo.id is not null then
      v_unit_price := case
        when v_promo.type = 'fixed_amount' then greatest(v_product.price - v_promo.value, 0)
        when v_promo.type = 'percentage' then round(v_product.price * (1 - v_promo.value / 100.0))
        else v_product.price
      end;
      if v_promo.type = 'free_delivery' then
        v_free_delivery := true;
      end if;
      v_discount_amount := v_discount_amount + (v_product.price - v_unit_price) * v_qty;
    else
      v_unit_price := v_product.price;
    end if;

    v_line_total := (v_unit_price + v_options_price) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + v_qty;
  end loop;

  if v_settings.minimum_order is not null and v_subtotal < v_settings.minimum_order then
    raise exception 'Montant minimum de commande non atteint (% %)', v_settings.minimum_order, v_restaurant.currency;
  end if;

  if p_fulfillment_type = 'delivery' and not v_free_delivery then
    v_delivery_fee := coalesce(v_settings.delivery_fee, 0);
  end if;
  v_total := v_subtotal + v_delivery_fee;

  update public.restaurants
    set next_order_number = next_order_number + 1
    where id = v_restaurant.id
    returning next_order_number - 1 into v_order_number;

  insert into public.orders (
    restaurant_id, order_number, status, fulfillment_type, customer_name, customer_phone,
    delivery_commune, delivery_address, delivery_instructions, customer_notes,
    currency, subtotal_amount, delivery_fee_amount, discount_amount, total_amount, item_count,
    order_source, source_metadata, payment_method, payment_status
  ) values (
    v_restaurant.id, v_order_number, 'pending', p_fulfillment_type, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_delivery_commune, '')), ''), nullif(btrim(coalesce(p_delivery_address, '')), ''),
    nullif(btrim(coalesce(p_delivery_instructions, '')), ''), nullif(btrim(coalesce(p_customer_notes, '')), ''),
    v_restaurant.currency, v_subtotal, v_delivery_fee, v_discount_amount, v_total, v_item_count,
    v_order_source, coalesce(p_source_metadata, '{}'::jsonb), v_payment_method, v_payment_status
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    select p.id, p.name, p.price
      into v_product
      from public.restaurant_products p
      where p.id = (v_item->>'product_id')::uuid
        and p.restaurant_id = v_restaurant.id;

    v_promo := public.get_active_promotion(v_product.id);
    if v_promo.id is not null then
      v_unit_price := case
        when v_promo.type = 'fixed_amount' then greatest(v_product.price - v_promo.value, 0)
        when v_promo.type = 'percentage' then round(v_product.price * (1 - v_promo.value / 100.0))
        else v_product.price
      end;
    else
      v_unit_price := v_product.price;
    end if;

    v_options_price := 0;

    insert into public.order_items (
      order_id, restaurant_id, product_id, product_name_snapshot, unit_price_snapshot,
      options_price_snapshot, quantity, line_total, item_notes
    ) values (
      v_order_id, v_restaurant.id, v_product.id, v_product.name, v_unit_price,
      0, v_qty, 0, nullif(btrim(coalesce(v_item->>'notes', '')), '')
    )
    returning id into v_order_item_id;

    for v_option in select * from jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) as t(value)
    loop
      v_option_id := v_option::uuid;

      select po.id, po.name, po.extra_price, g.name as group_name
        into v_option_row
        from public.product_options po
        join public.product_option_groups g on g.id = po.option_group_id
        where po.id = v_option_id
          and po.restaurant_id = v_restaurant.id;

      insert into public.order_item_options (
        order_item_id, restaurant_id, option_id, option_group_name_snapshot,
        option_name_snapshot, extra_price_snapshot
      ) values (
        v_order_item_id, v_restaurant.id, v_option_row.id, v_option_row.group_name,
        v_option_row.name, v_option_row.extra_price
      );

      v_options_price := v_options_price + v_option_row.extra_price;
    end loop;

    update public.order_items
      set options_price_snapshot = v_options_price,
          line_total = (unit_price_snapshot + v_options_price) * quantity
      where id = v_order_item_id;
  end loop;

  insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
  values (v_restaurant.id, v_order_id, null, 'pending', null, 'Commande créée');

  perform public.create_notification(
    v_restaurant.id, v_order_id, 'new_order', 'Nouvelle commande',
    format('Commande #%s · %s %s', v_order_number, v_total, v_restaurant.currency),
    jsonb_build_object('order_number', v_order_number, 'total_amount', v_total)
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'currency', v_restaurant.currency,
    'subtotal_amount', v_subtotal,
    'discount_amount', v_discount_amount,
    'delivery_fee_amount', v_delivery_fee,
    'total_amount', v_total,
    'item_count', v_item_count,
    'order_source', v_order_source,
    'payment_method', v_payment_method,
    'payment_status', v_payment_status
  );
end;
$$;
