import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MapPinned, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDeliveryRadiusKm, updateDeliveryRadiusKm } from "@/lib/restaurantSettings";
import { fetchCountrySettings, type CountrySettings } from "@/lib/mapsConfig";
import type { DbRestaurant } from "@/lib/menu-db";

const MIN_KM = 0.5;
const MAX_KM = 100;

function validate(raw: string): string | null {
  if (raw.trim() === "") return null;
  if (!/^\d+([.,]\d+)?$/.test(raw.trim())) return "Entrez un nombre (ex. 8 ou 8.5).";
  const value = Number(raw.replace(",", "."));
  if (value < MIN_KM) return `Le rayon doit être d'au moins ${MIN_KM} km.`;
  if (value > MAX_KM) return `Le rayon ne peut pas dépasser ${MAX_KM} km.`;
  return null;
}

function FeatureBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-border bg-muted text-muted-foreground"}`}>
      {enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

/**
 * Tenant-facing "niveau_4" Maps settings: the one genuinely new tenant-level
 * field (delivery radius, restaurant_settings.delivery_radius_km) plus a
 * read-only view of "which Maps configuration applies to me" (resolved from
 * this restaurant's own country_code -- never a hardcoded country). Country/
 * city/address/lat/lng themselves already live on `restaurants` and aren't
 * duplicated here.
 */
export function MapsDeliverySettingsCard({ restaurantId, restaurant }: { restaurantId: string; restaurant: DbRestaurant | null }) {
  const [savedRadius, setSavedRadius] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState<CountrySettings | null>(null);
  const [countryLoading, setCountryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDeliveryRadiusKm(restaurantId)
      .then((km) => {
        if (cancelled) return;
        setSavedRadius(km);
        setInputValue(km === null ? "" : String(km));
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Impossible de charger le rayon de livraison."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(() => {
    let cancelled = false;
    setCountryLoading(true);
    fetchCountrySettings(restaurant?.country_code ?? "")
      .then((c) => {
        if (!cancelled) setCountry(c);
      })
      .catch(() => {
        if (!cancelled) setCountry(null);
      })
      .finally(() => {
        if (!cancelled) setCountryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant?.country_code]);

  const error = validate(inputValue);
  const dirty = inputValue.trim() !== (savedRadius === null ? "" : String(savedRadius));

  async function save() {
    if (error) return;
    setBusy(true);
    try {
      const radius = inputValue.trim() === "" ? null : Number(inputValue.replace(",", "."));
      await updateDeliveryRadiusKm(restaurantId, radius);
      setSavedRadius(radius);
      toast.success("Rayon de livraison mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de mettre à jour le rayon de livraison.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <MapPinned className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">Livraison & Maps</h2>
          <p className="text-sm text-muted-foreground">
            Zone de couverture et configuration Maps applicable à votre restaurant.
          </p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-10 w-full max-w-xs" />
      ) : (
        <div className="max-w-xs space-y-2">
          <Label htmlFor="delivery-radius-km">Rayon de livraison (km)</Label>
          <Input
            id="delivery-radius-km"
            type="text"
            inputMode="decimal"
            placeholder="Illimité si vide"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={busy}
          />
          {error && dirty && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            Distance maximale (à vol d'oiseau) autour de votre restaurant. Laissez vide pour ne fixer aucune limite.
          </p>
        </div>
      )}

      <Button onClick={() => void save()} disabled={busy || loading || dirty === false || Boolean(error)}>
        {busy ? "Enregistrement..." : "Enregistrer"}
      </Button>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Configuration Maps applicable</p>
        {countryLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !country ? (
          <p className="text-sm text-muted-foreground">
            Aucune configuration Maps n'est encore active pour votre pays -- SAOVIA active les fonctionnalités Maps pays
            par pays.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              {country.country_name} ({country.country_code}) -- fournisseur : <span className="font-medium">{country.maps_provider === "osm_maplibre" ? "OpenStreetMap / MapLibre" : country.maps_provider}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <FeatureBadge label="Carte" enabled={country.map_display_enabled} />
              <FeatureBadge label="Géocodage" enabled={country.geocoding_enabled} />
              <FeatureBadge label="Géocodage inverse" enabled={country.reverse_geocoding_enabled} />
              <FeatureBadge label="Autocomplétion" enabled={country.autocomplete_enabled} />
              <FeatureBadge label="Calcul de distance" enabled={country.distance_matrix_enabled} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
