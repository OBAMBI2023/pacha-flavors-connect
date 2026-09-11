import { supabase } from "@/integrations/supabase/client";

/**
 * Maps provider identifiers. "osm_maplibre" is the provider actually wired
 * up today (MapLibre GL + OpenFreeMap tiles for display, OpenStreetMap
 * Nominatim for geocoding/autocomplete -- see @/lib/geolocation and
 * AddressMapPicker.tsx) -- free and keyless worldwide, no per-country key
 * needed. "google"/"mapbox" are recognized so a country can be pointed at a
 * paid provider later; no client code for those exists yet, so
 * resolveMapsProvider() below only ever hands back "osm_maplibre" behavior.
 */
export type MapsProvider = "osm_maplibre" | "google" | "mapbox" | "none";

export type PlatformSettings = {
  maps_enabled: boolean;
  default_maps_provider: MapsProvider;
};

export type CountrySettings = {
  country_code: string;
  country_name: string;
  dial_code: string;
  currency_code: string;
  locale: string;
  timezone: string;
  maps_provider: MapsProvider;
  maps_provider_enabled: boolean;
  geocoding_enabled: boolean;
  reverse_geocoding_enabled: boolean;
  autocomplete_enabled: boolean;
  distance_matrix_enabled: boolean;
  map_display_enabled: boolean;
  /** Client-safe key only (e.g. a domain-restricted Maps JS key) -- never a secret server key. Null under the default osm_maplibre provider, which needs no key. */
  maps_public_client_key: string | null;
  is_active: boolean;
};

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from("platform_settings").select("maps_enabled,default_maps_provider").eq("id", true).single();
  if (error) throw error;
  return { maps_enabled: data.maps_enabled, default_maps_provider: data.default_maps_provider as MapsProvider };
}

export async function updatePlatformSettings(patch: Partial<PlatformSettings>): Promise<void> {
  const { error } = await supabase.from("platform_settings").update(patch).eq("id", true);
  if (error) throw error;
}

const COUNTRY_COLUMNS =
  "country_code,country_name,dial_code,currency_code,locale,timezone,maps_provider,maps_provider_enabled,geocoding_enabled,reverse_geocoding_enabled,autocomplete_enabled,distance_matrix_enabled,map_display_enabled,maps_public_client_key,is_active";

export async function fetchAllCountrySettings(): Promise<CountrySettings[]> {
  const { data, error } = await supabase.from("country_settings").select(COUNTRY_COLUMNS).order("country_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CountrySettings[];
}

/** Used by tenant/customer-facing code (address picker, storefront) -- only ever active countries, per country_settings' public RLS policy. */
export async function fetchCountrySettings(countryCode: string): Promise<CountrySettings | null> {
  if (!countryCode) return null;
  const { data, error } = await supabase
    .from("country_settings")
    .select(COUNTRY_COLUMNS)
    .eq("country_code", countryCode.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as CountrySettings | null) ?? null;
}

const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const DIAL_CODE_RE = /^\+[0-9]{1,4}$/;
const CURRENCY_CODE_RE = /^[A-Z]{3}$/;

export type NewCountrySettings = {
  country_code: string;
  country_name: string;
  dial_code: string;
  currency_code: string;
  locale: string;
  timezone: string;
};

function validateNewCountry(input: NewCountrySettings): string | null {
  if (!COUNTRY_CODE_RE.test(input.country_code)) return "Code pays invalide (ISO 3166-1 alpha-2, ex. CI).";
  if (!DIAL_CODE_RE.test(input.dial_code)) return "Indicatif invalide (ex. +225).";
  if (!CURRENCY_CODE_RE.test(input.currency_code)) return "Devise invalide (ISO 4217, ex. XOF).";
  if (!input.country_name.trim()) return "Nom du pays requis.";
  if (!input.locale.trim()) return "Locale requise (ex. fr-CI).";
  if (!input.timezone.trim()) return "Fuseau horaire requis (ex. Africa/Abidjan).";
  return null;
}

/** Super Admin only -- RLS additionally enforces this server-side. */
export async function addCountrySettings(input: NewCountrySettings): Promise<CountrySettings> {
  const validationError = validateNewCountry(input);
  if (validationError) throw new Error(validationError);
  const { data, error } = await supabase
    .from("country_settings")
    .insert({ ...input, country_code: input.country_code.toUpperCase() })
    .select(COUNTRY_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ce pays est déjà configuré.");
    throw error;
  }
  return data as CountrySettings;
}

/** Super Admin only -- RLS additionally enforces this server-side. Never patches country_code (immutable primary key -- delete and re-add instead). */
export async function updateCountrySettings(
  countryCode: string,
  patch: Partial<Omit<CountrySettings, "country_code">>,
): Promise<void> {
  const { error } = await supabase.from("country_settings").update(patch).eq("country_code", countryCode.toUpperCase());
  if (error) throw error;
}

export async function deleteCountrySettings(countryCode: string): Promise<void> {
  const { error } = await supabase.from("country_settings").delete().eq("country_code", countryCode.toUpperCase());
  if (error) throw error;
}

/**
 * The one place that decides "is this Maps feature usable for this tenant
 * right now, and if so, how". Combines platform_settings' global kill-switch
 * with the tenant's own country_settings row -- a feature is only ever
 * enabled when BOTH agree. Never assumes Côte d'Ivoire or any other specific
 * country: `countryCode` must come from the tenant's own `restaurants.country_code`
 * (or, for a not-yet-placed order, the customer's own selection), never a
 * hardcoded literal.
 */
export type ResolvedMapsConfig = {
  provider: MapsProvider;
  geocodingEnabled: boolean;
  reverseGeocodingEnabled: boolean;
  autocompleteEnabled: boolean;
  distanceMatrixEnabled: boolean;
  mapDisplayEnabled: boolean;
  locale: string;
  publicClientKey: string | null;
};

const DISABLED_CONFIG: ResolvedMapsConfig = {
  provider: "none",
  geocodingEnabled: false,
  reverseGeocodingEnabled: false,
  autocompleteEnabled: false,
  distanceMatrixEnabled: false,
  mapDisplayEnabled: false,
  locale: "en",
  publicClientKey: null,
};

export async function resolveMapsConfig(countryCode: string | null | undefined): Promise<ResolvedMapsConfig> {
  if (!countryCode) return DISABLED_CONFIG;
  const [platform, country] = await Promise.all([fetchPlatformSettings(), fetchCountrySettings(countryCode)]);
  if (!platform.maps_enabled || !country || !country.is_active || !country.maps_provider_enabled) {
    return DISABLED_CONFIG;
  }
  return {
    provider: country.maps_provider,
    geocodingEnabled: country.geocoding_enabled,
    reverseGeocodingEnabled: country.reverse_geocoding_enabled,
    autocompleteEnabled: country.autocomplete_enabled,
    distanceMatrixEnabled: country.distance_matrix_enabled,
    mapDisplayEnabled: country.map_display_enabled,
    locale: country.locale,
    publicClientKey: country.maps_public_client_key,
  };
}
