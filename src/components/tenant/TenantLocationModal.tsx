import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, LocateFixed, Loader2, MapPin, Search, X } from "lucide-react";
import { useDeliveryLocation, type DeliveryLocation } from "@/lib/deliveryLocation";
import { getCurrentPosition, reverseGeocode, GeoError, type GeoErrorKind } from "@/lib/geolocation";

type Step = "idle" | "locating" | "found" | "error";

/**
 * Friendly, non-technical copy for each GPS failure -- the raw
 * GeolocationPositionError text never reaches the customer, only console
 * logging (see geolocation.ts). A manual address is always offered right
 * alongside these, so a GPS failure never blocks ordering.
 */
const ERROR_CONTENT: Record<GeoErrorKind, { title: string; message: string; secondary: string; canRetry: boolean }> = {
  denied: {
    title: "Autorisation de localisation nécessaire",
    message: "Nous n'avons pas pu accéder à votre position.",
    secondary: "Vous pouvez autoriser la localisation dans les paramètres de votre navigateur ou de votre appareil, ou saisir votre adresse manuellement.",
    canRetry: true,
  },
  unavailable: {
    title: "Position momentanément indisponible",
    message: "Nous n'avons pas pu récupérer votre position actuellement.",
    secondary: "Vérifiez que la localisation est activée sur votre appareil, ou saisissez votre adresse manuellement.",
    canRetry: true,
  },
  timeout: {
    title: "La recherche a pris trop de temps",
    message: "Nous n'avons pas pu vous localiser à temps.",
    secondary: "Réessayez, ou saisissez votre adresse manuellement.",
    canRetry: true,
  },
  unsupported: {
    title: "Localisation non disponible",
    message: "Cet appareil ne permet pas la géolocalisation automatique.",
    secondary: "Vous pouvez saisir votre adresse manuellement.",
    canRetry: false,
  },
};

const GEOCODE_FAILURE_MESSAGE = "Position détectée, mais l'adresse n'a pas pu être déterminée. Vous pouvez saisir votre adresse manuellement.";

export function TenantLocationModal() {
  const { location, isModalOpen, closeModal, setLocation, initialManualMode } = useDeliveryLocation();
  const [step, setStep] = useState<Step>("idle");
  const [errorKind, setErrorKind] = useState<GeoErrorKind | null>(null);
  const [draft, setDraft] = useState<Omit<DeliveryLocation, "confirmed" | "updated_at"> | null>(
    location
      ? { latitude: location.latitude, longitude: location.longitude, address: location.address, neighborhood: location.neighborhood, commune: location.commune, city: location.city, country: location.country, landmark: location.landmark }
      : null,
  );
  const [manualAddress, setManualAddress] = useState(location?.address ?? "");
  const [manualLandmark, setManualLandmark] = useState(location?.landmark ?? "");
  const [manualMode, setManualMode] = useState(false);
  // Once the address text is hand-edited it may no longer describe the
  // coordinates a previous GPS fetch produced -- confirming must then submit
  // address-only rather than pairing real coordinates with a different
  // place than the one they were captured for.
  const [addressEditedSinceGeo, setAddressEditedSinceGeo] = useState(false);
  // Reverse geocoding is a separate step from GPS capture: the position can
  // succeed while the address lookup fails. Tracked apart from `errorKind`
  // (a GeoError, i.e. GPS itself failing) so the two cases can't be confused
  // and a failed lookup never falls back to stuffing raw coordinates into
  // the address field as if they were a real address.
  const [geocodeFailed, setGeocodeFailed] = useState(false);

  // "Saisir mon adresse" from the cart opens straight into manual entry
  // instead of making the user tap through this screen a second time.
  useEffect(() => {
    if (isModalOpen && initialManualMode) setManualMode(true);
  }, [isModalOpen, initialManualMode]);

  if (!isModalOpen) return null;

  async function handleUseMyPosition() {
    setStep("locating");
    setErrorKind(null);
    setGeocodeFailed(false);
    setManualMode(false);
    setAddressEditedSinceGeo(false);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      try {
        const geo = await reverseGeocode(latitude, longitude);
        setDraft({ latitude, longitude, address: geo.address, neighborhood: geo.neighborhood, commune: geo.commune, city: geo.city, country: geo.country, landmark: manualLandmark.trim() || null });
        setManualAddress(geo.address);
      } catch {
        setDraft({ latitude, longitude, address: "", neighborhood: null, commune: null, city: null, country: null, landmark: manualLandmark.trim() || null });
        setManualAddress("");
        setGeocodeFailed(true);
      }
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
    setGeocodeFailed(false);
    setManualMode(false);
  }

  function handleConfirm() {
    const address = manualAddress.trim();
    if (!address) return;
    const coordsStillValid = !addressEditedSinceGeo;
    setLocation({
      latitude: coordsStillValid ? draft?.latitude ?? null : null,
      longitude: coordsStillValid ? draft?.longitude ?? null : null,
      address,
      neighborhood: draft?.neighborhood ?? null,
      commune: draft?.commune ?? null,
      city: draft?.city ?? null,
      country: draft?.country ?? null,
      landmark: manualLandmark.trim() || null,
      confirmed: true,
      updated_at: new Date().toISOString(),
    });
    handleClose();
  }

  const showManualField = manualMode || step === "found";
  const hasGpsCoordinates =
    !addressEditedSinceGeo && draft?.latitude !== null && draft?.longitude !== null && draft?.latitude !== undefined;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-cocoa/50 backdrop-blur-sm" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-t-3xl bg-background p-6 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Où souhaitez-vous être livré ?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Votre adresse nous permet de calculer les frais de livraison et de vous livrer rapidement.</p>
          </div>
          <button onClick={handleClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {step === "error" && errorKind ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/40 p-4 text-center">
              <p className="text-2xl" aria-hidden="true">📍</p>
              <div className="space-y-1">
                <p className="font-display text-base font-semibold text-foreground">{ERROR_CONTENT[errorKind].title}</p>
                <p className="text-sm text-muted-foreground">{ERROR_CONTENT[errorKind].message}</p>
                <p className="text-xs text-muted-foreground">{ERROR_CONTENT[errorKind].secondary}</p>
              </div>
              <div className="flex gap-2 pt-1">
                {ERROR_CONTENT[errorKind].canRetry && (
                  <button
                    type="button"
                    onClick={handleUseMyPosition}
                    className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                  >
                    Réessayer
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className={`flex h-11 items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-accent ${ERROR_CONTENT[errorKind].canRetry ? "flex-1" : "w-full"}`}
                >
                  Saisir mon adresse
                </button>
              </div>
            </div>
          ) : (
            <>
              {step === "found" && geocodeFailed && (
                <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{GEOCODE_FAILURE_MESSAGE}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleUseMyPosition}
                disabled={step === "locating"}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {step === "locating" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === "found" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                {step === "locating" ? "Localisation en cours..." : step === "found" ? "Position détectée" : "Utiliser ma position actuelle"}
              </button>

              {!showManualField && (
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent"
                >
                  <Search className="h-4 w-4" /> Saisir mon adresse
                </button>
              )}
            </>
          )}

          {showManualField && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              {hasGpsCoordinates && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>Position détectée : {draft!.latitude!.toFixed(5)}, {draft!.longitude!.toFixed(5)}</span>
                </div>
              )}
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Adresse</span>
                <textarea
                  rows={2}
                  value={manualAddress}
                  onChange={(e) => {
                    setManualAddress(e.target.value);
                    setAddressEditedSinceGeo(true);
                  }}
                  placeholder="Rechercher un quartier ou une adresse..."
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">Point de repère (optionnel)</span>
                <input
                  type="text"
                  value={manualLandmark}
                  onChange={(e) => setManualLandmark(e.target.value)}
                  placeholder="Ex: près du Feu du SICOMEX"
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
            {hasGpsCoordinates ? "Confirmer ma position" : "Utiliser cette adresse"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
