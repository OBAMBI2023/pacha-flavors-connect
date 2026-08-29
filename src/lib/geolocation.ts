export type GeoErrorKind = "denied" | "unavailable" | "timeout" | "unsupported";

export class GeoError extends Error {
  kind: GeoErrorKind;
  constructor(kind: GeoErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// Standard GeolocationPositionError codes -- compared as literal numbers
// (not the symbolic error.PERMISSION_DENIED etc.) so classification can't
// silently break if those constants are ever missing from the error object.
const GEO_PERMISSION_DENIED = 1;
const GEO_POSITION_UNAVAILABLE = 2;
const GEO_TIMEOUT = 3;

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new GeoError("unsupported", "La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }

    const request = () =>
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) => {
          // error.code is only ever exactly one of these three -- anything
          // else (there is no other value) still needs a branch, so it
          // falls through to "unavailable" rather than being misreported.
          if (error.code === GEO_PERMISSION_DENIED) {
            reject(
              new GeoError(
                "denied",
                "La localisation est bloquée pour cette application. Autorisez l'accès à votre position dans les paramètres de votre navigateur ou de votre appareil, puis réessayez.",
              ),
            );
          } else if (error.code === GEO_POSITION_UNAVAILABLE) {
            reject(new GeoError("unavailable", "Votre position actuelle est momentanément indisponible. Vérifiez que la localisation de votre appareil est activée."));
          } else if (error.code === GEO_TIMEOUT) {
            reject(new GeoError("timeout", "La récupération de votre position a pris trop de temps. Réessayez."));
          } else {
            reject(new GeoError("unavailable", "Votre position actuelle est momentanément indisponible. Vérifiez que la localisation de votre appareil est activée."));
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );

    // A browser that already has this origin's geolocation permission
    // permanently blocked will re-reject with PERMISSION_DENIED on every
    // call without ever showing a prompt -- from the user's side that looks
    // identical to "the click did nothing". Where the Permissions API is
    // available, checking first lets a user stuck in that state get the
    // real explanation (re-enable it in browser/device settings) instead of
    // silently repeating the same failed request. Not all browsers support
    // querying the "geolocation" permission (notably older Safari), so this
    // degrades to just calling getCurrentPosition directly.
    if (typeof navigator.permissions?.query === "function") {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (status.state === "denied") {
            reject(
              new GeoError(
                "denied",
                "La localisation est bloquée pour cette application. Autorisez l'accès à votre position dans les paramètres de votre navigateur ou de votre appareil, puis réessayez.",
              ),
            );
            return;
          }
          request();
        })
        .catch(request);
    } else {
      request();
    }
  });
}

export type ReverseGeocodeResult = {
  address: string;
  neighborhood: string | null;
  commune: string | null;
  city: string | null;
  country: string | null;
};

/**
 * OpenStreetMap Nominatim -- the only reverse-geocoding service reachable
 * with no API key/provider already configured in this project. Its public
 * endpoint allows direct browser calls (CORS-enabled); a failure here just
 * falls back to raw coordinates rather than blocking location capture.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=fr`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("reverse_geocode_failed");
  const data = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const addr = data.address ?? {};
  const neighborhood = addr["suburb"] ?? addr["neighbourhood"] ?? addr["quarter"] ?? addr["residential"] ?? null;
  const commune = addr["city_district"] ?? addr["municipality"] ?? addr["town"] ?? null;
  const city = addr["city"] ?? addr["county"] ?? null;
  const country = addr["country"] ?? null;
  // Nominatim's display_name is the *entire* formatted address (house
  // number through country) -- using it as-is would duplicate neighborhood/
  // commune/city wherever they're later joined back on for display (the
  // storefront summary line, the admin order view). Keep `address` to the
  // street-level detail only; the broader levels stay in their own fields.
  const road = addr["road"] ?? addr["pedestrian"] ?? addr["footway"] ?? null;
  const houseNumber = addr["house_number"] ?? null;
  const streetLine = [houseNumber, road].filter(Boolean).join(" ").trim() || null;
  const address = streetLine ?? neighborhood ?? commune ?? city ?? data.display_name ?? "";
  if (!address) throw new Error("reverse_geocode_empty");
  return { address, neighborhood, commune, city, country };
}

/**
 * Forward geocoding (address text -> coordinates), same provider/rationale
 * as reverseGeocode above: OpenStreetMap Nominatim is the only geocoding
 * service reachable with no API key/provider already configured in this
 * project. Used only for a recipient's typed delivery address ("commander
 * pour quelqu'un d'autre") -- there is no bulk/automated use here, only
 * one lookup per checkout, which stays well within Nominatim's usage
 * policy (max ~1 req/s, no heavy automated querying). Returns null on any
 * failure or no-match rather than throwing: geocoding failing must never
 * block checkout, it just means the order falls back to the tenant's flat
 * delivery fee instead of a distance-based one (see create_order).
 */
export async function geocodeAddress(query: string): Promise<{ latitude: number; longitude: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=1`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    if (!first?.lat || !first?.lon) return null;
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

export type AddressSuggestion = { label: string; latitude: number; longitude: number };

/**
 * Same provider/no-key rationale as reverseGeocode/geocodeAddress above,
 * just returning up to 5 candidates instead of 1 -- backs the address
 * search-as-you-type suggestion list in TenantLocationModal's map picker.
 * Callers debounce their own calls (one lookup per pause in typing) to stay
 * well within Nominatim's usage policy; a query under 3 characters is
 * rejected locally without hitting the network at all.
 */
export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=5&accept-language=fr`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const results = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    return results.flatMap((r) => {
      const latitude = Number(r.lat);
      const longitude = Number(r.lon);
      if (!r.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{ label: r.display_name, latitude, longitude }];
    });
  } catch {
    return [];
  }
}
