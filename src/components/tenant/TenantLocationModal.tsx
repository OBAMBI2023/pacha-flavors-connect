import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, LocateFixed, Loader2, MapPin, X } from "lucide-react";
import { useDeliveryLocation, type DeliveryLocation } from "@/lib/deliveryLocation";
import { getCurrentPosition, reverseGeocode, GeoError, type GeoErrorKind } from "@/lib/geolocation";

type Step = "idle" | "locating" | "found" | "error";

const ERROR_MESSAGES: Record<GeoErrorKind, string> = {
  denied: "La localisation est nécessaire pour déterminer votre adresse de livraison.",
  unavailable: "Impossible de récupérer votre position actuellement.",
  timeout: "La récupération de votre position prend trop de temps. Réessayez.",
  unsupported: "La géolocalisation n'est pas disponible sur cet appareil.",
};

export function TenantLocationModal() {
  const { location, isModalOpen, closeModal, setLocation } = useDeliveryLocation();
  const [step, setStep] = useState<Step>("idle");
  const [errorKind, setErrorKind] = useState<GeoErrorKind | null>(null);
  const [draft, setDraft] = useState<Omit<DeliveryLocation, "confirmed" | "updated_at"> | null>(
    location ? { latitude: location.latitude, longitude: location.longitude, address: location.address, neighborhood: location.neighborhood, commune: location.commune, city: location.city, country: location.country } : null,
  );
  const [manualAddress, setManualAddress] = useState(location?.address ?? "");
  const [manualMode, setManualMode] = useState(false);

  if (!isModalOpen) return null;

  async function handleUseMyPosition() {
    setStep("locating");
    setErrorKind(null);
    setManualMode(false);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      let geo;
      try {
        geo = await reverseGeocode(latitude, longitude);
      } catch {
        geo = {
          address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          neighborhood: null,
          commune: null,
          city: null,
          country: null,
        };
      }
      setDraft({ latitude, longitude, address: geo.address, neighborhood: geo.neighborhood, commune: geo.commune, city: geo.city, country: geo.country });
      setManualAddress(geo.address);
      setStep("found");
    } catch (err) {
      const kind = err instanceof GeoError ? err.kind : "unavailable";
      setErrorKind(kind);
      setStep("error");
    }
  }

  function handleClose() {
    closeModal();
    setStep("idle");
    setErrorKind(null);
  }

  function handleConfirm() {
    const address = manualAddress.trim();
    if (!address) return;
    setLocation({
      latitude: draft?.latitude ?? null,
      longitude: draft?.longitude ?? null,
      address,
      neighborhood: draft?.neighborhood ?? null,
      commune: draft?.commune ?? null,
      city: draft?.city ?? null,
      country: draft?.country ?? null,
      confirmed: true,
      updated_at: new Date().toISOString(),
    });
    handleClose();
  }

  const showManualField = manualMode || step === "found" || step === "error";

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-cocoa/50 backdrop-blur-sm" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-t-3xl bg-background p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Où souhaitez-vous être livré ?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Votre position exacte nous aide à livrer plus vite.</p>
          </div>
          <button onClick={handleClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {step === "error" && errorKind && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{ERROR_MESSAGES[errorKind]}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleUseMyPosition}
            disabled={step === "locating"}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {step === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {step === "locating" ? "Localisation en cours..." : "Utiliser ma position actuelle"}
          </button>

          {!showManualField && (
            <button type="button" onClick={() => setManualMode(true)} className="w-full text-center text-sm font-medium text-primary hover:underline">
              Saisir mon adresse manuellement
            </button>
          )}

          {showManualField && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              {draft && (draft.latitude !== null || step === "found") && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    {draft.latitude !== null && draft.longitude !== null
                      ? `Position détectée : ${draft.latitude.toFixed(5)}, ${draft.longitude.toFixed(5)}`
                      : "Adresse saisie manuellement"}
                  </span>
                </div>
              )}
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Adresse de livraison</span>
                <textarea
                  rows={2}
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Ex: Angré 8e Tranche, Cocody, Abidjan"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={handleClose} className="h-12 flex-1 rounded-xl border border-border text-sm font-semibold hover:bg-accent">
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!manualAddress.trim()}
            className="h-12 flex-1 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmer ma position
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
