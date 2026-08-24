-- Tenant-wide, customer-typed promo codes redeemable at checkout.
-- Deliberately kept separate from product_promotions (an automatic, silent,
-- per-product discount with no code) and from offers (a campaign banner
-- system). Neither existing system is modified by this migration. See
-- resolve_promo_code() / validate_promo_code() and the create_order changes
-- in the next migration for how a code is validated and applied.

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  code text not null,
  discount_type public.promotion_type not null,
  discount_value numeric,
  visibility text not null default 'public' check (visibility in ('public', 'targeted', 'personal')),
  max_total_uses integer,
  max_uses_per_customer integer not null default 1,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_dates_check check (ends_at > starts_at),
  constraint promo_codes_value_shape_check check (
    (discount_type = 'free_delivery' and discount_value is null)
    or (discount_type = 'fixed_amount' and discount_value is not null and discount_value > 0)
    or (discount_type = 'percentage' and discount_value is not null and discount_value > 0 and discount_value < 100)
  ),
  constraint promo_codes_max_total_uses_check check (max_total_uses is null or max_total_uses > 0),
  constraint promo_codes_max_uses_per_customer_check check (max_uses_per_customer > 0),
  constraint promo_codes_restaurant_code_unique unique (restaurant_id, code)
);

create index promo_codes_restaurant_id_idx on public.promo_codes (restaurant_id);

create table public.promo_code_targets (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint promo_code_targets_unique unique (promo_code_id, customer_id)
);

create index promo_code_targets_promo_code_id_idx on public.promo_code_targets (promo_code_id);
create index promo_code_targets_customer_id_idx on public.promo_code_targets (customer_id);

create table public.promo_code_usages (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete cascade,
  discount_amount numeric not null check (discount_amount >= 0),
  used_at timestamptz not null default now(),
  constraint promo_code_usages_order_id_unique unique (order_id)
);

create index promo_code_usages_promo_code_id_idx on public.promo_code_usages (promo_code_id);
create index promo_code_usages_promo_code_customer_idx on public.promo_code_usages (promo_code_id, customer_id);

alter table public.orders
  add column promo_code_id uuid references public.promo_codes(id) on delete set null,
  add column promo_code_snapshot text;

create index orders_promo_code_id_idx on public.orders (promo_code_id);

-- Normalize the code (uppercase, no whitespace) before it is ever stored or
-- compared, mirroring validate_product_promotion's before-trigger pattern.
create or replace function public.validate_promo_code_row()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  new.code := upper(regexp_replace(btrim(coalesce(new.code, '')), '\s+', '', 'g'));
  if new.code = '' then
    raise exception 'Le code promo est requis';
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger promo_codes_validate
  before insert or update on public.promo_codes
  for each row execute function public.validate_promo_code_row();

-- Cross-tenant guard + "personal" visibility can only ever target one customer.
create or replace function public.validate_promo_code_target()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_promo record;
  v_customer_restaurant_id uuid;
  v_existing_count integer;
begin
  select id, restaurant_id, visibility into v_promo
    from public.promo_codes where id = new.promo_code_id;

  if v_promo.id is null then
    raise exception 'Code promo introuvable';
  end if;

  select restaurant_id into v_customer_restaurant_id
    from public.customers where id = new.customer_id;

  if v_customer_restaurant_id is distinct from v_promo.restaurant_id then
    raise exception 'Ce client n''appartient pas au même restaurant que ce code promo';
  end if;

  if v_promo.visibility = 'personal' then
    select count(*) into v_existing_count
      from public.promo_code_targets t
      where t.promo_code_id = new.promo_code_id and t.id is distinct from new.id;
    if v_existing_count >= 1 then
      raise exception 'Une promotion personnelle ne peut cibler qu''un seul client';
    end if;
  end if;

  return new;
end;
$function$;

create trigger promo_code_targets_validate
  before insert or update on public.promo_code_targets
  for each row execute function public.validate_promo_code_target();

-- Single source of truth for "is this code usable right now, by this
-- customer, for this amount" -- called by validate_promo_code() (checkout
-- preview) and by create_order() (authoritative, in the next migration).
-- Not exposed to PostgREST: no EXECUTE grant to anon/authenticated below.
create or replace function public.resolve_promo_code(
  p_restaurant_id uuid,
  p_code text,
  p_customer_id uuid,
  p_base_amount numeric
)
returns table(promo_code_id uuid, code text, discount_amount numeric, waives_delivery boolean, error_message text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code_normalized text;
  v_promo public.promo_codes;
  v_total_uses integer;
  v_customer_uses integer;
  v_discount numeric := 0;
  v_waives boolean := false;
begin
  v_code_normalized := upper(regexp_replace(btrim(coalesce(p_code, '')), '\s+', '', 'g'));

  if v_code_normalized = '' then
    return query select null::uuid, null::text, null::numeric, false, 'Code promo requis';
    return;
  end if;

  select * into v_promo
    from public.promo_codes pc
    where pc.restaurant_id = p_restaurant_id
      and pc.code = v_code_normalized
    limit 1;

  if v_promo.id is null then
    return query select null::uuid, null::text, null::numeric, false, 'Code promo invalide';
    return;
  end if;

  if not v_promo.is_active then
    return query select null::uuid, null::text, null::numeric, false, 'Ce code promo est désactivé';
    return;
  end if;

  if now() < v_promo.starts_at or now() > v_promo.ends_at then
    return query select null::uuid, null::text, null::numeric, false, 'Ce code promo n''est plus valide';
    return;
  end if;

  if v_promo.visibility in ('targeted', 'personal') then
    if p_customer_id is null or not exists (
      select 1 from public.promo_code_targets t
      where t.promo_code_id = v_promo.id and t.customer_id = p_customer_id
    ) then
      return query select null::uuid, null::text, null::numeric, false, 'Ce code promo ne vous est pas accessible';
      return;
    end if;
  end if;

  if v_promo.max_total_uses is not null then
    select count(*) into v_total_uses from public.promo_code_usages u where u.promo_code_id = v_promo.id;
    if v_total_uses >= v_promo.max_total_uses then
      return query select null::uuid, null::text, null::numeric, false, 'Ce code promo a atteint sa limite d''utilisation';
      return;
    end if;
  end if;

  if p_customer_id is not null then
    select count(*) into v_customer_uses from public.promo_code_usages u
      where u.promo_code_id = v_promo.id and u.customer_id = p_customer_id;
    if v_customer_uses >= v_promo.max_uses_per_customer then
      return query select null::uuid, null::text, null::numeric, false, 'Vous avez déjà utilisé ce code promo';
      return;
    end if;
  end if;

  v_discount := case
    when v_promo.discount_type = 'fixed_amount' then least(v_promo.discount_value, greatest(p_base_amount, 0))
    when v_promo.discount_type = 'percentage' then round(greatest(p_base_amount, 0) * v_promo.discount_value / 100.0)
    else 0
  end;
  v_waives := v_promo.discount_type = 'free_delivery';

  return query select v_promo.id, v_promo.code, v_discount, v_waives, null::text;
end;
$function$;

revoke all on function public.resolve_promo_code(uuid, text, uuid, numeric) from public, anon, authenticated;

-- Checkout-facing preview: never trusted for the actual charge (create_order
-- recomputes everything independently), only used to show a live "code
-- accepted / discount amount" message before the order is placed.
create or replace function public.validate_promo_code(
  p_slug text,
  p_code text,
  p_phone text,
  p_subtotal numeric
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_restaurant_id uuid;
  v_phone_normalized text;
  v_customer_id uuid;
  v_result record;
begin
  select r.id into v_restaurant_id
    from public.restaurants r
    where r.slug = p_slug and r.is_public = true and r.status = 'active'
    limit 1;

  if v_restaurant_id is null then
    return jsonb_build_object('valid', false, 'message', 'Restaurant introuvable');
  end if;

  v_phone_normalized := public.normalize_phone(p_phone);
  if v_phone_normalized is not null then
    select id into v_customer_id
      from public.customers
      where restaurant_id = v_restaurant_id and phone = v_phone_normalized
      limit 1;
  end if;

  select * into v_result
    from public.resolve_promo_code(v_restaurant_id, p_code, v_customer_id, greatest(coalesce(p_subtotal, 0), 0));

  if v_result.error_message is not null then
    return jsonb_build_object('valid', false, 'message', v_result.error_message);
  end if;

  return jsonb_build_object(
    'valid', true,
    'message', null,
    'promo_code_id', v_result.promo_code_id,
    'discount_amount', v_result.discount_amount,
    'waives_delivery', v_result.waives_delivery
  );
end;
$function$;

grant execute on function public.validate_promo_code(text, text, text, numeric) to anon, authenticated;

alter table public.promo_codes enable row level security;

create policy promo_codes_manage_owner_manager on public.promo_codes
  for all
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]));

create policy promo_codes_select_members on public.promo_codes
  for select
  using (public.has_restaurant_access(restaurant_id));

alter table public.promo_code_targets enable row level security;

create policy promo_code_targets_manage_owner_manager on public.promo_code_targets
  for all
  using (exists (
    select 1 from public.promo_codes pc
    where pc.id = promo_code_targets.promo_code_id
      and public.has_restaurant_role(pc.restaurant_id, array['owner', 'manager']::restaurant_role[])
  ))
  with check (exists (
    select 1 from public.promo_codes pc
    where pc.id = promo_code_targets.promo_code_id
      and public.has_restaurant_role(pc.restaurant_id, array['owner', 'manager']::restaurant_role[])
  ));

create policy promo_code_targets_select_members on public.promo_code_targets
  for select
  using (exists (
    select 1 from public.promo_codes pc
    where pc.id = promo_code_targets.promo_code_id
      and public.has_restaurant_access(pc.restaurant_id)
  ));

alter table public.promo_code_usages enable row level security;

create policy promo_code_usages_select_members on public.promo_code_usages
  for select
  using (public.has_restaurant_access(restaurant_id));
