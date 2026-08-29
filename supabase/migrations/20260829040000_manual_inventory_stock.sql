-- Manual stock module (Admin Tenant): inventory + inventory_movements, tied 1:1 to
-- restaurant_products via (restaurant_id, product_id). Availability sync and order
-- consumption/restoration are handled server-side so the storefront needs zero changes:
-- restaurant_products.is_available already gates ordering/display everywhere.

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.restaurant_products(id) on delete cascade,
  quantity integer not null default 0,
  alert_threshold integer not null default 0,
  tracking_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_restaurant_product_unique unique (restaurant_id, product_id),
  constraint inventory_quantity_non_negative check (quantity >= 0),
  constraint inventory_alert_threshold_non_negative check (alert_threshold >= 0)
);

create index inventory_restaurant_id_idx on public.inventory (restaurant_id);
create index inventory_product_id_idx on public.inventory (product_id);

create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

alter table public.inventory enable row level security;

create policy inventory_select_members on public.inventory
  for select
  using (public.has_restaurant_access(restaurant_id));

create policy inventory_manage_owner_manager on public.inventory
  for all
  using (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]))
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]));

-- inventory_movements: immutable audit log. created_by_name is a snapshot (like
-- order_items.product_name_snapshot elsewhere) because profiles RLS only lets a
-- user read their own row, so a client-side join would show blank names for
-- movements created by teammates.
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.restaurant_products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  quantity integer not null,
  movement_type text not null,
  reason text,
  note text,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (movement_type in ('IN', 'OUT', 'ADJUSTMENT')),
  constraint inventory_movements_quantity_sign_check check (
    (movement_type in ('IN', 'OUT') and quantity > 0) or movement_type = 'ADJUSTMENT'
  )
);

create index inventory_movements_restaurant_id_idx on public.inventory_movements (restaurant_id, created_at desc);
create index inventory_movements_product_id_idx on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_order_id_idx on public.inventory_movements (order_id);

alter table public.inventory_movements enable row level security;

create policy inventory_movements_select_members on public.inventory_movements
  for select
  using (public.has_restaurant_access(restaurant_id));

create policy inventory_movements_insert_owner_manager on public.inventory_movements
  for insert
  with check (public.has_restaurant_role(restaurant_id, array['owner', 'manager']::restaurant_role[]));

-- Sync: when a tracked product's stock hits/leaves zero, mirror it onto the
-- existing is_available flag. create_order and every storefront query already
-- gate on is_available, so this alone enforces "can't order an out-of-stock item".
create or replace function public.sync_product_availability_from_inventory()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.tracking_enabled then
    update public.restaurant_products
      set is_available = (new.quantity > 0)
      where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger inventory_sync_product_availability
  after insert or update of quantity, tracking_enabled on public.inventory
  for each row execute function public.sync_product_availability_from_inventory();

-- Enable/disable tracking for a product. First enable can seed an initial quantity,
-- logged as a single ADJUSTMENT movement; re-enabling later never touches quantity.
create or replace function public.set_inventory_tracking(
  p_restaurant_id uuid,
  p_product_id uuid,
  p_enabled boolean,
  p_initial_quantity integer default 0,
  p_alert_threshold integer default 0
)
returns public.inventory
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existing public.inventory;
  v_row public.inventory;
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_restaurant_role(p_restaurant_id, array['owner', 'manager']::restaurant_role[]) then
    raise exception 'Forbidden';
  end if;
  if not exists (
    select 1 from public.restaurant_products
    where id = p_product_id and restaurant_id = p_restaurant_id
  ) then
    raise exception 'Produit introuvable pour ce restaurant';
  end if;
  if p_initial_quantity < 0 then
    raise exception 'La quantité initiale ne peut pas être négative';
  end if;
  if p_alert_threshold < 0 then
    raise exception 'Le seuil d''alerte ne peut pas être négatif';
  end if;

  select * into v_existing
    from public.inventory
    where restaurant_id = p_restaurant_id and product_id = p_product_id;

  select full_name into v_actor_name from public.profiles where id = auth.uid();

  if v_existing.id is null then
    insert into public.inventory (restaurant_id, product_id, quantity, alert_threshold, tracking_enabled)
    values (p_restaurant_id, p_product_id, p_initial_quantity, p_alert_threshold, p_enabled)
    returning * into v_row;

    if p_enabled and v_row.quantity > 0 then
      insert into public.inventory_movements (
        restaurant_id, product_id, quantity, movement_type, reason, note, created_by, created_by_name
      ) values (
        p_restaurant_id, p_product_id, v_row.quantity, 'ADJUSTMENT', 'initial_stock',
        'Activation du suivi du stock', auth.uid(), v_actor_name
      );
    end if;
  else
    update public.inventory
      set tracking_enabled = p_enabled
      where id = v_existing.id
      returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.set_inventory_alert_threshold(
  p_restaurant_id uuid,
  p_product_id uuid,
  p_alert_threshold integer
)
returns public.inventory
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.inventory;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_restaurant_role(p_restaurant_id, array['owner', 'manager']::restaurant_role[]) then
    raise exception 'Forbidden';
  end if;
  if p_alert_threshold < 0 then
    raise exception 'Le seuil d''alerte ne peut pas être négatif';
  end if;

  update public.inventory
    set alert_threshold = p_alert_threshold
    where restaurant_id = p_restaurant_id and product_id = p_product_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Activez d''abord le suivi du stock pour ce produit';
  end if;

  return v_row;
end;
$$;

-- Single atomic entry point for manual IN / OUT / ADJUSTMENT movements.
-- p_value semantics: IN/OUT = amount moved (must be > 0); ADJUSTMENT = new absolute quantity.
-- The row lock (for update) + WHERE-guarded UPDATE make concurrent OUTs on the same
-- product serialize safely: quantity can never go negative even under a race.
create or replace function public.record_inventory_movement(
  p_restaurant_id uuid,
  p_product_id uuid,
  p_movement_type text,
  p_value integer,
  p_reason text,
  p_note text default null
)
returns public.inventory
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_current public.inventory;
  v_new_quantity integer;
  v_movement_quantity integer;
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_restaurant_role(p_restaurant_id, array['owner', 'manager']::restaurant_role[]) then
    raise exception 'Forbidden';
  end if;
  if p_movement_type not in ('IN', 'OUT', 'ADJUSTMENT') then
    raise exception 'Type de mouvement invalide: %', p_movement_type;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'Le motif est requis';
  end if;

  select * into v_current
    from public.inventory
    where restaurant_id = p_restaurant_id and product_id = p_product_id
    for update;

  if v_current.id is null then
    raise exception 'Activez d''abord le suivi du stock pour ce produit';
  end if;

  if p_movement_type = 'IN' then
    if p_value <= 0 then
      raise exception 'La quantité doit être supérieure à zéro';
    end if;
    v_new_quantity := v_current.quantity + p_value;
  elsif p_movement_type = 'OUT' then
    if p_value <= 0 then
      raise exception 'La quantité doit être supérieure à zéro';
    end if;
    if v_current.quantity - p_value < 0 then
      raise exception 'Stock insuffisant (disponible: %, demandé: %)', v_current.quantity, p_value;
    end if;
    v_new_quantity := v_current.quantity - p_value;
  else
    if p_value < 0 then
      raise exception 'Le stock ne peut pas être négatif';
    end if;
    v_new_quantity := p_value;
  end if;

  v_movement_quantity := case
    when p_movement_type = 'ADJUSTMENT' then v_new_quantity - v_current.quantity
    else p_value
  end;

  update public.inventory set quantity = v_new_quantity where id = v_current.id;

  if p_movement_type <> 'ADJUSTMENT' or v_movement_quantity <> 0 then
    select full_name into v_actor_name from public.profiles where id = auth.uid();
    insert into public.inventory_movements (
      restaurant_id, product_id, quantity, movement_type, reason, note, created_by, created_by_name
    ) values (
      p_restaurant_id, p_product_id, v_movement_quantity, p_movement_type,
      btrim(p_reason), nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), v_actor_name
    );
  end if;

  select * into v_current from public.inventory where id = v_current.id;
  return v_current;
end;
$$;

-- Order-lifecycle hooks, called from update_order_status below. Not directly
-- grantable to clients: only reachable through that function's own transaction.
create or replace function public.consume_inventory_for_order(p_order_id uuid, p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_item record;
  v_current public.inventory;
  v_actor_name text;
begin
  select full_name into v_actor_name from public.profiles where id = auth.uid();

  for v_item in
    select oi.product_id, oi.quantity, oi.product_name_snapshot
    from public.order_items oi
    where oi.order_id = p_order_id
  loop
    select * into v_current
      from public.inventory
      where restaurant_id = p_restaurant_id and product_id = v_item.product_id
      for update;

    if v_current.id is not null and v_current.tracking_enabled then
      if v_current.quantity - v_item.quantity < 0 then
        raise exception 'Stock insuffisant pour %: disponible %, requis %',
          v_item.product_name_snapshot, v_current.quantity, v_item.quantity;
      end if;

      update public.inventory set quantity = quantity - v_item.quantity where id = v_current.id;

      insert into public.inventory_movements (
        restaurant_id, product_id, order_id, quantity, movement_type, reason, created_by, created_by_name
      ) values (
        p_restaurant_id, v_item.product_id, p_order_id, v_item.quantity, 'OUT', 'order_confirmed',
        auth.uid(), v_actor_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.restore_inventory_for_order(p_order_id uuid, p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row record;
  v_actor_name text;
begin
  select full_name into v_actor_name from public.profiles where id = auth.uid();

  for v_row in
    select product_id, sum(quantity) as total_qty
    from public.inventory_movements
    where order_id = p_order_id and movement_type = 'OUT' and reason = 'order_confirmed'
    group by product_id
  loop
    update public.inventory
      set quantity = quantity + v_row.total_qty
      where restaurant_id = p_restaurant_id and product_id = v_row.product_id;

    insert into public.inventory_movements (
      restaurant_id, product_id, order_id, quantity, movement_type, reason, created_by, created_by_name
    ) values (
      p_restaurant_id, v_row.product_id, p_order_id, v_row.total_qty, 'IN', 'order_cancelled',
      auth.uid(), v_actor_name
    );
  end loop;
end;
$$;

-- Re-declare update_order_status verbatim (from 20260828xxxxxx) plus two new
-- `perform` calls at the end: decrement tracked stock on confirmation, restore it
-- if a confirmed (but not yet preparing) order is cancelled. Both run inside this
-- function's own transaction, so a stock failure aborts the whole status change.
create or replace function public.update_order_status(p_order_id uuid, p_new_status order_status, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_allowed boolean;
  v_notif_title text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select o.id, o.restaurant_id, o.status, o.order_number, o.fulfillment_type, o.assigned_driver_id
    into v_order
    from public.orders o
    where o.id = p_order_id;

  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if not (
    public.has_restaurant_access(v_order.restaurant_id)
    or (auth.uid() = v_order.assigned_driver_id and p_new_status = 'out_for_delivery')
  ) then
    raise exception 'Forbidden';
  end if;

  v_allowed := case v_order.status
    when 'pending' then p_new_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_new_status in ('preparing', 'cancelled')
    when 'preparing' then p_new_status in ('ready', 'cancelled')
    when 'ready' then p_new_status in ('out_for_delivery', 'delivered', 'cancelled')
    when 'out_for_delivery' then p_new_status in ('delivered', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'Transition de statut invalide: % -> %', v_order.status, p_new_status;
  end if;

  update public.orders
    set status = p_new_status,
        cancel_reason = case when p_new_status = 'cancelled' then p_note else cancel_reason end,
        confirmed_at = case when p_new_status = 'confirmed' then now() else confirmed_at end,
        preparing_at = case when p_new_status = 'preparing' then now() else preparing_at end,
        ready_at = case when p_new_status = 'ready' then now() else ready_at end,
        out_for_delivery_at = case when p_new_status = 'out_for_delivery' then now() else out_for_delivery_at end,
        delivered_at = case when p_new_status = 'delivered' then now() else delivered_at end,
        cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
    where id = p_order_id;

  insert into public.order_status_history (restaurant_id, order_id, from_status, to_status, changed_by, note)
  values (v_order.restaurant_id, p_order_id, v_order.status, p_new_status, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));

  perform public.log_audit_event(
    v_order.restaurant_id, auth.uid(), 'order', p_order_id,
    case when p_new_status = 'cancelled' then 'order_cancelled' else 'order_status_changed' end,
    jsonb_build_object('from_status', v_order.status, 'to_status', p_new_status, 'note', p_note)
  );

  v_notif_title := case p_new_status
    when 'confirmed' then 'Commande acceptée'
    when 'cancelled' then 'Commande refusée'
    when 'ready' then 'Commande prête'
    when 'delivered' then 'Commande livrée'
    else null
  end;
  if v_notif_title is not null then
    perform public.create_notification(
      v_order.restaurant_id, p_order_id, 'order_status_changed', v_notif_title,
      format('Commande #%s', v_order.order_number),
      jsonb_build_object('order_number', v_order.order_number, 'status', p_new_status)
    );
  end if;

  if p_new_status = 'confirmed' and v_order.fulfillment_type = 'delivery' then
    perform public.dispatch_find_and_propose_driver(p_order_id);
  end if;

  if p_new_status = 'cancelled' then
    update public.driver_profiles
      set status = 'available'
      where id in (select driver_id from public.delivery_proposals where order_id = p_order_id and status = 'pending');
    update public.delivery_proposals
      set status = 'cancelled', responded_at = now()
      where order_id = p_order_id and status = 'pending';
    if v_order.assigned_driver_id is not null then
      update public.driver_profiles set status = 'available' where id = v_order.assigned_driver_id;
    end if;
  end if;

  if p_new_status = 'delivered' and v_order.assigned_driver_id is not null then
    update public.driver_profiles set status = 'available' where id = v_order.assigned_driver_id;
  end if;

  if p_new_status = 'confirmed' then
    perform public.consume_inventory_for_order(p_order_id, v_order.restaurant_id);
  end if;

  if p_new_status = 'cancelled' and v_order.status = 'confirmed' then
    perform public.restore_inventory_for_order(p_order_id, v_order.restaurant_id);
  end if;

  return jsonb_build_object('order_id', p_order_id, 'status', p_new_status);
end;
$function$;

-- Grants: client-facing mutation RPCs are staff-only (owner/manager, enforced
-- inside each function body); the two order-lifecycle helpers are internal-only,
-- reachable solely through update_order_status's own SECURITY DEFINER context.
revoke all on function public.set_inventory_tracking(uuid, uuid, boolean, integer, integer) from public;
grant execute on function public.set_inventory_tracking(uuid, uuid, boolean, integer, integer) to authenticated;

revoke all on function public.set_inventory_alert_threshold(uuid, uuid, integer) from public;
grant execute on function public.set_inventory_alert_threshold(uuid, uuid, integer) to authenticated;

revoke all on function public.record_inventory_movement(uuid, uuid, text, integer, text, text) from public;
grant execute on function public.record_inventory_movement(uuid, uuid, text, integer, text, text) to authenticated;

revoke all on function public.consume_inventory_for_order(uuid, uuid) from public, anon, authenticated;
revoke all on function public.restore_inventory_for_order(uuid, uuid) from public, anon, authenticated;
