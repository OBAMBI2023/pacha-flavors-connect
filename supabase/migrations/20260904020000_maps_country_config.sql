-- Multi-country Maps configuration.
--
-- The app's actual Maps stack is already provider-agnostic and free/keyless
-- worldwide: MapLibre GL + OpenFreeMap tiles for display (DriverTrackingMap,
-- AddressMapPicker), OpenStreetMap Nominatim for geocoding/reverse-geocoding/
-- autocomplete (src/lib/geolocation.ts), and a plain Haversine formula in km
-- for distance (src/lib/deliveryPricing.ts, mirrored server-side by
-- public.haversine_km) -- none of that is Côte d'Ivoire-specific today. What
-- was missing was an actual per-country configuration record: geolocation.ts
-- hardcoded `accept-language=fr` for every lookup, and there was no place for
-- Super Admin to enable/disable Maps features per country or point a
-- specific country at a different provider later. This migration adds that
-- config layer only -- it does not replace the underlying providers.
--
-- Architecture (platform -> country -> tenant -> tenant map fields):
--   niveau_1 platform_settings   -- new, singleton, global default/kill-switch.
--   niveau_2 country_settings    -- new, one row per country: reference data
--                                   (dial code, currency, locale, timezone)
--                                   + per-country Maps provider/feature config.
--   niveau_3 tenant_settings     -- restaurant_settings, already exists, reused.
--   niveau_4 tenant map fields   -- country_code/city/address/lat/lng already
--                                   exist on public.restaurants (reused, not
--                                   duplicated); the one genuinely missing
--                                   tenant-level field, delivery radius, is
--                                   added to restaurant_settings below rather
--                                   than a new table, to avoid a second
--                                   location system for the same tenant.

create table public.platform_settings (
  id boolean primary key default true,
  maps_enabled boolean not null default true,
  default_maps_provider text not null default 'osm_maplibre',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

insert into public.platform_settings (id) values (true);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

create policy platform_settings_super_admin_all
  on public.platform_settings
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Not secret (no keys, no per-tenant data) -- every client needs this to
-- know whether Maps features are globally on before even checking a country.
create policy platform_settings_select_all
  on public.platform_settings
  for select
  using (true);

create table public.country_settings (
  country_code text primary key,
  country_name text not null,
  dial_code text not null,
  currency_code text not null,
  locale text not null,
  timezone text not null,
  maps_provider text not null default 'osm_maplibre',
  maps_provider_enabled boolean not null default true,
  geocoding_enabled boolean not null default true,
  reverse_geocoding_enabled boolean not null default true,
  autocomplete_enabled boolean not null default true,
  distance_matrix_enabled boolean not null default true,
  map_display_enabled boolean not null default true,
  -- Client-safe key only (e.g. a domain-restricted Maps JS key) -- a secret
  -- server-side API key must never be stored in a table any client can read.
  maps_public_client_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint country_settings_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint country_settings_dial_code_format check (dial_code ~ '^\+[0-9]{1,4}$'),
  constraint country_settings_currency_code_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint country_settings_maps_provider_known check (maps_provider in ('osm_maplibre', 'google', 'mapbox', 'none'))
);

create trigger country_settings_set_updated_at
  before update on public.country_settings
  for each row execute function public.set_updated_at();

alter table public.country_settings enable row level security;

create policy country_settings_super_admin_all
  on public.country_settings
  for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Every tenant/customer needs to read their own country's config client-side
-- to know which Maps features are enabled -- nothing here is secret (see
-- maps_public_client_key comment above).
create policy country_settings_select_active
  on public.country_settings
  for select
  using (is_active);

-- Seed data: the country already in production use (Côte d'Ivoire), with the
-- exact values that used to be scattered as literals (225/XOF/Africa/Abidjan
-- defaults on restaurants, `accept-language=fr` in geolocation.ts) -- now a
-- normal configurable row instead of code. Plus one genuinely different
-- second country (currency, locale, dial code, timezone all differ) so nothing
-- downstream can accidentally assume there's only ever one row.
insert into public.country_settings (country_code, country_name, dial_code, currency_code, locale, timezone) values
  ('CI', 'Côte d''Ivoire', '+225', 'XOF', 'fr-CI', 'Africa/Abidjan'),
  ('NG', 'Nigeria', '+234', 'NGN', 'en-NG', 'Africa/Lagos');

-- niveau_4: the one tenant-level Maps field not already on public.restaurants
-- (country_code/city/address/lat/lng all already exist there and are reused
-- as-is -- see the header comment).
alter table public.restaurant_settings add column delivery_radius_km numeric;
