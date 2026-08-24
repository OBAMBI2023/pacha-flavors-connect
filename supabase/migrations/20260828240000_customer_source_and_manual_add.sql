-- Lets a restaurant add its own customers from the admin, distinguished from
-- customers created by a real site order, while staying in the same
-- `customers` table (no parallel table). All existing rows were created
-- exclusively by create_order (a real site order) up to this point, so
-- defaulting them to 'website' is factually correct, not just a safe guess.

alter table public.customers
  add column source text not null default 'website' check (source in ('website', 'restaurant')),
  add column internal_note text;

-- Normalizes phone on every insert/update (not just create_order's own
-- upsert) so a customer added manually by the restaurant and later found via
-- a real site order under the same phone number always collide on the same
-- row instead of silently diverging into two rows -- this is what lets
-- create_order's existing find-or-create-by-phone logic (unchanged) already
-- satisfy the "rattachement plutôt que doublon" requirement with no changes
-- to create_order itself.
create or replace function public.normalize_customer_phone()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  new.phone := public.normalize_phone(new.phone);
  if new.phone is null or new.phone = '' then
    raise exception 'Numéro de téléphone invalide';
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger customers_normalize_phone
  before insert or update on public.customers
  for each row execute function public.normalize_customer_phone();

-- customers previously had no INSERT policy at all (rows were only ever
-- written by the SECURITY DEFINER create_order/merge_customers functions).
-- Manually adding a client is an ordinary admin action, so it gets an
-- ordinary RLS policy -- same bar as the existing SELECT/UPDATE policies
-- (has_restaurant_access), not a stricter one.
create policy customers_insert_members on public.customers
  for insert
  with check (public.has_restaurant_access(restaurant_id));
