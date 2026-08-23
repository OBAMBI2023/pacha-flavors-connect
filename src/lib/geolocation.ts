export type GeoErrorKind = "denied" | "unavailable" | "timeout" | "unsupported";

export class GeoError extends Error {
  kind: GeoErrorKind;
  constructor(kind: GeoErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new GeoError("unsupported", "La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new GeoError("denied", "La localisation est nécessaire pour déterminer votre adresse de livraison."));
        } else if (error.code === error.TIMEOUT) {
          reject(new GeoError("timeout", "La récupération de votre position prend trop de temps. Réessayez."));
        } else {
          reject(new GeoError("unavailable", "Impossible de récupérer votre position actuellement."));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
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
  const address = data.display_name ?? [neighborhood, commune, city].filter(Boolean).join(", ");
  if (!address) throw new Error("reverse_geocode_empty");
  return { address, neighborhood, commune, city, country };
}
