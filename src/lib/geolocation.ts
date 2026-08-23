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
