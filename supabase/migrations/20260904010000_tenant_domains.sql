-- Super Admin > Domaines: verified custom-domain management per tenant.
-- Supersedes the never-wired-up restaurant_settings.custom_domain free-text
-- placeholder (left in place, untouched, but no longer read by src/lib/seo.ts
-- or the QR code -- avoids running two parallel "which domain is this
-- tenant's" systems). A domain only ever counts as this tenant's active
-- public origin when is_primary AND is_verified AND is_active are all true;
-- existence/HTTP-response is never treated as proof of ownership -- only a
-- matching DNS TXT record at _saovia-verify.<domain> does that (checked
-- client-side by the Super Admin UI, which then flips is_verified here).

create table public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.restaurants(id) on delete cascade,
  domain text not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  is_active boolean not null default false,
  verification_token text not null default replace(gen_random_uuid()::text, '-', ''),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lowercase host, no scheme, no trailing slash, no path -- matches the
  -- normalization every write path (DB trigger below + client) applies
  -- before this constraint ever sees the value.
  constraint tenant_domains_domain_format check (
    domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
  ),
  constraint tenant_domains_domain_unique unique (domain),
  -- Defense in depth beyond the application query filter: an inactive
  -- domain can never be flagged verified-and-live at the same time as
  -- "verified" alone (is_verified without is_active just means "ownership
  -- proven, not yet switched on").
  constraint tenant_domains_active_requires_verified check (not is_active or is_verified)
);

-- At most one primary domain per tenant -- enforced at the DB level so a
-- races between two "set as primary" calls can't leave two primaries.
create unique index tenant_domains_one_primary_per_tenant
  on public.tenant_domains (tenant_id)
  where is_primary;

create index tenant_domains_tenant_id_idx on public.tenant_domains (tenant_id);

-- Fast lookup for the one row (if any) SEO/QR resolution actually needs:
-- "this tenant's active, verified, primary domain".
create index tenant_domains_active_primary_idx
  on public.tenant_domains (tenant_id)
  where is_primary and is_verified and is_active;

create trigger tenant_domains_set_updated_at
  before update on public.tenant_domains
  for each row execute function public.set_updated_at();

-- Normalizes on every insert/update so the format/uniqueness constraints
-- above always see the canonical form, regardless of what the client sent
-- (the client also normalizes before submitting, but this is the actual
-- guarantee).
create or replace function public.normalize_tenant_domain()
returns trigger
language plpgsql
as $$
begin
  -- Lowercase FIRST: the protocol-strip regex below is lowercase-only, so an
  -- uppercase "HTTPS://" prefix would otherwise survive un-stripped.
  new.domain := regexp_replace(regexp_replace(lower(trim(new.domain)), '^https?://', ''), '/+$', '');
  return new;
end;
$$;

create trigger tenant_domains_normalize
  before insert or update on public.tenant_domains
  for each row execute function public.normalize_tenant_domain();

alter table public.tenant_domains enable row level security;

-- Super Admin: full CRUD.
create policy tenant_domains_super_admin_all
  on public.tenant_domains
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Tenant staff: read-only visibility of their own restaurant's domains
-- (add/verify/activate/delete stay Super Admin-only actions, per spec).
create policy tenant_domains_tenant_select
  on public.tenant_domains
  for select
  using (public.has_restaurant_access(tenant_id));

-- Public: a verified+active domain is already a live, publicly-known URL --
-- exposing that one mapping (never pending/unverified rows, never the
-- verification_token of an unverified row to anyone but its own tenant/Super
-- Admin) leaks nothing DNS and the live site don't already show anyone.
-- Needed so the anonymous storefront loader can resolve a tenant's public
-- origin for canonical/OG tags and the QR code.
create policy tenant_domains_public_select_active
  on public.tenant_domains
  for select
  to anon
  using (is_verified and is_active);

-- Atomic "set as primary": clears any other primary for the same tenant and
-- sets this one, in a single transaction -- avoids the unique-index race a
-- naive two-step client update (unset old, set new) would risk.
create or replace function public.super_admin_set_primary_domain(_domain_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _tenant_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Accès refusé : réservé au Super Admin.';
  end if;

  select tenant_id into _tenant_id from public.tenant_domains where id = _domain_id;
  if _tenant_id is null then
    raise exception 'Domaine introuvable.';
  end if;

  update public.tenant_domains
    set is_primary = false
    where tenant_id = _tenant_id and is_primary and id <> _domain_id;

  update public.tenant_domains
    set is_primary = true
    where id = _domain_id;
end;
$$;

grant execute on function public.super_admin_set_primary_domain(uuid) to authenticated;
