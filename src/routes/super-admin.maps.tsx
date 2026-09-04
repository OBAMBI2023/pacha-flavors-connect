import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe2, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addCountrySettings,
  deleteCountrySettings,
  fetchAllCountrySettings,
  fetchPlatformSettings,
  updateCountrySettings,
  updatePlatformSettings,
  type CountrySettings,
  type MapsProvider,
  type NewCountrySettings,
  type PlatformSettings,
} from "@/lib/mapsConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/super-admin/maps")({
  ssr: false,
  component: SuperAdminMapsPage,
});

const PROVIDER_LABELS: Record<MapsProvider, string> = {
  osm_maplibre: "OpenStreetMap / MapLibre (gratuit, sans clé)",
  google: "Google Maps",
  mapbox: "Mapbox",
  none: "Aucun",
};

const EMPTY_NEW_COUNTRY: NewCountrySettings = {
  country_code: "",
  country_name: "",
  dial_code: "",
  currency_code: "",
  locale: "",
  timezone: "",
};

type FeatureKey =
  | "maps_provider_enabled"
  | "geocoding_enabled"
  | "reverse_geocoding_enabled"
  | "autocomplete_enabled"
  | "distance_matrix_enabled"
  | "map_display_enabled";

const FEATURE_TOGGLES: { key: FeatureKey; label: string }[] = [
  { key: "maps_provider_enabled", label: "Fournisseur actif" },
  { key: "geocoding_enabled", label: "Géocodage" },
  { key: "reverse_geocoding_enabled", label: "Géocodage inverse" },
  { key: "autocomplete_enabled", label: "Autocomplétion" },
  { key: "distance_matrix_enabled", label: "Calcul de distance" },
  { key: "map_display_enabled", label: "Affichage carte" },
];

function SuperAdminMapsPage() {
  const [platform, setPlatform] = useState<PlatformSettings | null>(null);
  const [countries, setCountries] = useState<CountrySettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [platformBusy, setPlatformBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newCountry, setNewCountry] = useState<NewCountrySettings>(EMPTY_NEW_COUNTRY);
  const [adding, setAdding] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([fetchPlatformSettings(), fetchAllCountrySettings()]);
      setPlatform(p);
      setCountries(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger la configuration Maps.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleTogglePlatformEnabled(next: boolean) {
    setPlatformBusy(true);
    try {
      await updatePlatformSettings({ maps_enabled: next });
      toast.success(next ? "Maps activé globalement." : "Maps désactivé globalement.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setPlatformBusy(false);
    }
  }

  async function handleAddCountry(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await addCountrySettings({
        ...newCountry,
        country_code: newCountry.country_code.trim().toUpperCase(),
        dial_code: newCountry.dial_code.trim(),
        currency_code: newCountry.currency_code.trim().toUpperCase(),
      });
      toast.success("Pays ajouté.");
      setAddOpen(false);
      setNewCountry(EMPTY_NEW_COUNTRY);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter ce pays.");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleFeature(country: CountrySettings, key: FeatureKey, next: boolean) {
    setBusyCode(country.country_code);
    try {
      await updateCountrySettings(country.country_code, { [key]: next });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyCode(null);
    }
  }

  async function handleChangeProvider(country: CountrySettings, provider: MapsProvider) {
    setBusyCode(country.country_code);
    try {
      await updateCountrySettings(country.country_code, { maps_provider: provider });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyCode(null);
    }
  }

  async function handleToggleActive(country: CountrySettings, next: boolean) {
    setBusyCode(country.country_code);
    try {
      await updateCountrySettings(country.country_code, { is_active: next });
      toast.success(next ? "Pays activé." : "Pays désactivé.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyCode(null);
    }
  }

  async function handleDelete(country: CountrySettings) {
    setBusyCode(country.country_code);
    try {
      await deleteCountrySettings(country.country_code);
      toast.success("Pays supprimé.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 sm:text-3xl">Maps</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configuration Maps par pays -- géocodage, autocomplétion, calcul de distance et affichage carte. Aucune
          logique Maps du produit ne dépend d'un pays en particulier : tout se pilote ici.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold">Plateforme</h2>
        <p className="mt-1 text-sm text-slate-600">Coupe-circuit global -- désactive Maps pour tous les pays d'un coup.</p>
        {loading || !platform ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <Switch checked={platform.maps_enabled} disabled={platformBusy} onCheckedChange={(v) => void handleTogglePlatformEnabled(v)} aria-label="Maps activé globalement" />
            <span className="text-sm">{platform.maps_enabled ? "Maps activé globalement" : "Maps désactivé globalement"}</span>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0">
          <h2 className="font-display text-lg font-semibold">Pays configurés</h2>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" /> Ajouter un pays
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddCountry}>
                <DialogHeader>
                  <DialogTitle>Ajouter un pays</DialogTitle>
                  <DialogDescription>Le fournisseur par défaut (OpenStreetMap/MapLibre) est activé sur toutes les fonctionnalités dès la création.</DialogDescription>
                </DialogHeader>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="cc">Code pays (ISO alpha-2)</Label>
                    <Input id="cc" placeholder="CI" maxLength={2} value={newCountry.country_code} onChange={(e) => setNewCountry((c) => ({ ...c, country_code: e.target.value.toUpperCase() }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cn">Nom du pays</Label>
                    <Input id="cn" placeholder="Côte d'Ivoire" value={newCountry.country_name} onChange={(e) => setNewCountry((c) => ({ ...c, country_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dc">Indicatif</Label>
                    <Input id="dc" placeholder="+225" value={newCountry.dial_code} onChange={(e) => setNewCountry((c) => ({ ...c, dial_code: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="curr">Devise (ISO 4217)</Label>
                    <Input id="curr" placeholder="XOF" maxLength={3} value={newCountry.currency_code} onChange={(e) => setNewCountry((c) => ({ ...c, currency_code: e.target.value.toUpperCase() }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="loc">Locale</Label>
                    <Input id="loc" placeholder="fr-CI" value={newCountry.locale} onChange={(e) => setNewCountry((c) => ({ ...c, locale: e.target.value }))} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tz">Fuseau horaire</Label>
                    <Input id="tz" placeholder="Africa/Abidjan" value={newCountry.timezone} onChange={(e) => setNewCountry((c) => ({ ...c, timezone: e.target.value }))} required />
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button type="submit" disabled={adding}>
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
            </div>
          ) : countries.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-500">
              <Globe2 className="h-8 w-8 text-slate-300" />
              Aucun pays configuré.
            </div>
          ) : (
            <div className="space-y-4">
              {countries.map((country) => {
                const rowBusy = busyCode === country.country_code;
                return (
                  <div key={country.country_code} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {country.country_name} <span className="text-xs font-normal text-muted-foreground">({country.country_code})</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {country.dial_code} -- {country.currency_code} -- {country.locale} -- {country.timezone}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Switch checked={country.is_active} disabled={rowBusy} onCheckedChange={(v) => void handleToggleActive(country, v)} aria-label="Pays actif" />
                          <span className="text-xs text-muted-foreground">Pays actif</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" disabled={rowBusy}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer {country.country_name} ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Les tenants déjà associés à ce pays perdront leur configuration Maps (repli sur "non configuré"). Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => void handleDelete(country)}>Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Label className="text-xs text-muted-foreground">Fournisseur</Label>
                      <Select value={country.maps_provider} onValueChange={(v) => void handleChangeProvider(country, v as MapsProvider)} disabled={rowBusy}>
                        <SelectTrigger className="h-8 w-auto min-w-[220px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PROVIDER_LABELS) as MapsProvider[]).map((p) => (
                            <SelectItem key={p} value={p}>
                              {PROVIDER_LABELS[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                      {FEATURE_TOGGLES.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 text-xs">
                          <Switch
                            checked={country[key]}
                            disabled={rowBusy}
                            onCheckedChange={(v) => void handleToggleFeature(country, key, v)}
                            aria-label={label}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
