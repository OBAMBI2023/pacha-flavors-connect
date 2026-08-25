import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useOrganizationAuth } from "@/hooks/useOrganizationAuth";
import {
  createDelivery,
  listOrganizationPickupPoints,
  quoteDelivery,
  type CreateDeliveryResult,
  type DeliveryQuote,
  type DeliveryServiceLevel,
  type PickupPoint,
} from "@/lib/organizationDelivery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, CalendarClock } from "lucide-react";

const TITLE = "Nouvelle livraison | SAOVIA Delivery";

export const Route = createFileRoute("/delivery/new")({
  head: () => ({ meta: [{ title: TITLE }, { name: "robots", content: "noindex" }] }),
  component: NewDeliveryPage,
});

function tomorrowMinDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isScheduledDateValid(date: string): boolean {
  return date >= tomorrowMinDate();
}

function NewDeliveryPage() {
  const navigate = useNavigate();
  const { user, organization, loading: authLoading } = useOrganizationAuth();

  const [step, setStep] = useState(1);
  const [serviceLevel, setServiceLevel] = useState<DeliveryServiceLevel>("EXPRESS");
  const [scheduledDate, setScheduledDate] = useState(tomorrowMinDate());
  const [scheduledTime, setScheduledTime] = useState("09:00");

  const [packageDescription, setPackageDescription] = useState("");
  const [packageQuantity, setPackageQuantity] = useState("1");
  const [packageWeight, setPackageWeight] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [codAmount, setCodAmount] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(null);
  const [pickupName, setPickupName] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");

  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CreateDeliveryResult | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/delivery/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!organization) return;
    listOrganizationPickupPoints(organization.id)
      .then(setPickupPoints)
      .catch(() => void 0);
  }, [organization]);

  useEffect(() => {
    if (selectedPickupPointId) {
      const pp = pickupPoints.find((p) => p.id === selectedPickupPointId);
      if (pp) {
        setPickupName(pp.name);
        setPickupPhone(pp.contact_phone ?? "");
        setPickupAddress(pp.address);
      }
    }
  }, [selectedPickupPointId, pickupPoints]);

  async function fetchQuote() {
    setQuoting(true);
    try {
      const q = await quoteDelivery({
        pickupLat: null,
        pickupLng: null,
        destinationLat: null,
        destinationLng: null,
        serviceLevel,
      });
      setQuote(q);
    } catch {
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  }

  function goToEstimation() {
    setError(null);
    setStep(5);
    void fetchQuote();
  }

  async function handleConfirm() {
    if (!organization) return;
    setError(null);
    if (serviceLevel === "SCHEDULED" && !isScheduledDateValid(scheduledDate)) {
      setError("Les livraisons programmées doivent être planifiées à partir de demain.");
      return;
    }
    setSubmitting(true);
    try {
      const scheduledPickupAt =
        serviceLevel === "SCHEDULED" ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() : undefined;
      const result = await createDelivery({
        organizationId: organization.id,
        orderId: externalReference.trim() || `SAOVIA-${Date.now()}`,
        externalReference: externalReference.trim() || undefined,
        customerName,
        customerPhone,
        pickupName,
        pickupPhone,
        pickupAddress,
        destinationName: customerName,
        destinationPhone: customerPhone,
        destinationAddress,
        packageDescription: packageDescription.trim() || undefined,
        packageWeight: packageWeight ? Number(packageWeight) : undefined,
        packageQuantity: Number(packageQuantity) || 1,
        serviceLevel,
        scheduledPickupAt,
        declaredValue: declaredValue ? Number(declaredValue) : undefined,
        codAmount: codAmount ? Number(codAmount) : undefined,
        deliveryInstructions: deliveryInstructions.trim() || undefined,
        pickupPointId: selectedPickupPointId ?? undefined,
      });
      setConfirmation(result);
      setStep(7);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la livraison.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || !organization) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-4 h-64 w-full" />
      </main>
    );
  }

  if (step === 7 && confirmation) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Livraison créée</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">Commande #{confirmation.order_id}</h1>
        <Card className="mt-6 w-full space-y-2 p-5 text-left text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>HORS_RESTAURANT</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{confirmation.service_level === "EXPRESS" ? "Express" : "Programmée"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Statut</span><span>{confirmation.status}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Collecte</span><span>{pickupAddress}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span>{destinationAddress}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Prix définitif</span><span>{confirmation.delivery_fee.toLocaleString("fr-FR")} FCFA</span></div>
        </Card>
        <Button asChild className="mt-6 h-12 w-full">
          <Link to="/delivery/$id" params={{ id: confirmation.delivery_id }}>Voir ma livraison</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Nouvelle livraison</p>
      <h1 className="mt-1 font-display text-2xl font-semibold">Étape {step} sur 6</h1>

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Comment souhaitez-vous expédier ?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setServiceLevel("EXPRESS")}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-6 text-center transition-colors ${serviceLevel === "EXPRESS" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <Zap className="h-6 w-6 text-primary" />
              <span className="font-semibold">EXPRESS</span>
              <span className="text-xs text-muted-foreground">Collecte dès maintenant</span>
            </button>
            <button
              type="button"
              onClick={() => setServiceLevel("SCHEDULED")}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-6 text-center transition-colors ${serviceLevel === "SCHEDULED" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <CalendarClock className="h-6 w-6 text-primary" />
              <span className="font-semibold">COLLECTE J+1</span>
              <span className="text-xs text-muted-foreground">Collecte programmée demain</span>
            </button>
          </div>
          {serviceLevel === "SCHEDULED" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="scheduled-date">Date de collecte</Label>
                <Input id="scheduled-date" type="date" min={tomorrowMinDate()} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled-time">Heure</Label>
                <Input id="scheduled-time" type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
              </div>
            </div>
          )}
          <Button className="h-12 w-full" onClick={() => setStep(2)}>Continuer</Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Informations du colis</h2>
          <div className="space-y-2"><Label htmlFor="pkg-desc">Description</Label><Input id="pkg-desc" value={packageDescription} onChange={(e) => setPackageDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="pkg-qty">Quantité</Label><Input id="pkg-qty" type="number" min={1} value={packageQuantity} onChange={(e) => setPackageQuantity(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="pkg-weight">Poids (kg)</Label><Input id="pkg-weight" type="number" min={0} value={packageWeight} onChange={(e) => setPackageWeight(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="declared-value">Valeur déclarée (FCFA)</Label><Input id="declared-value" type="number" min={0} value={declaredValue} onChange={(e) => setDeclaredValue(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="cod-amount">Montant à encaisser -- COD (FCFA)</Label><Input id="cod-amount" type="number" min={0} value={codAmount} onChange={(e) => setCodAmount(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="external-ref">Référence externe</Label><Input id="external-ref" value={externalReference} onChange={(e) => setExternalReference(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="instructions">Instructions</Label><Textarea id="instructions" rows={3} value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} /></div>
          <div className="flex gap-3"><Button variant="outline" className="h-12 flex-1" onClick={() => setStep(1)}>Retour</Button><Button className="h-12 flex-1" onClick={() => setStep(3)}>Continuer</Button></div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Collecte</h2>
          {pickupPoints.length > 0 && (
            <div className="space-y-2">
              <Label>Point de collecte enregistré</Label>
              <select
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={selectedPickupPointId ?? ""}
                onChange={(e) => setSelectedPickupPointId(e.target.value || null)}
              >
                <option value="">Nouvelle adresse</option>
                {pickupPoints.map((pp) => (
                  <option key={pp.id} value={pp.id}>{pp.name} -- {pp.address}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2"><Label htmlFor="pickup-name">Nom</Label><Input id="pickup-name" value={pickupName} onChange={(e) => setPickupName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pickup-phone">Téléphone</Label><Input id="pickup-phone" type="tel" value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pickup-address">Adresse</Label><Textarea id="pickup-address" rows={2} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} /></div>
          <div className="flex gap-3"><Button variant="outline" className="h-12 flex-1" onClick={() => setStep(2)}>Retour</Button><Button className="h-12 flex-1" onClick={() => setStep(4)} disabled={!pickupName.trim() || !pickupPhone.trim() || !pickupAddress.trim()}>Continuer</Button></div>
        </div>
      )}

      {step === 4 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Destinataire</h2>
          <div className="space-y-2"><Label htmlFor="dest-name">Nom</Label><Input id="dest-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="dest-phone">Téléphone</Label><Input id="dest-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="dest-address">Adresse</Label><Textarea id="dest-address" rows={2} value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} /></div>
          <div className="flex gap-3">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setStep(3)}>Retour</Button>
            <Button className="h-12 flex-1" onClick={goToEstimation} disabled={!customerName.trim() || !customerPhone.trim() || !destinationAddress.trim()}>
              Voir l'estimation
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold">Estimation</h2>
          <Card className="space-y-2 p-5">
            {quoting ? (
              <Skeleton className="h-20 w-full" />
            ) : quote ? (
              <>
                {quote.delivery_distance_km !== null && (
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Distance estimée</span><span>{quote.delivery_distance_km.toFixed(1)} km</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Service</span><span>{serviceLevel === "EXPRESS" ? "Express" : "Programmée"}</span></div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Livraison</span><span>{quote.delivery_fee.toLocaleString("fr-FR")} FCFA</span></div>
                <p className="pt-1 text-xs italic text-muted-foreground">Estimation non contractuelle -- le prix définitif est calculé à la confirmation.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Estimation indisponible pour le moment.</p>
            )}
          </Card>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" className="h-12 flex-1" onClick={() => setStep(4)} disabled={submitting}>Retour</Button>
            <Button className="h-12 flex-1" onClick={() => void handleConfirm()} disabled={submitting}>
              {submitting ? "Confirmation..." : "Confirmer la livraison"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
