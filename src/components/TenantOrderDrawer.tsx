import { forwardRef, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Banknote,
  Clock,
  LocateFixed,
  MapPin,
  Navigation,
  Pencil,
  ShoppingBag,
  Truck,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCart, type CartOptionSelection } from "@/lib/cart";
import { createRestaurantOrder, cartLinesToOrderItems } from "@/lib/orders";
import { QuantitySelector } from "@/components/tenant/QuantitySelector";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";
import type { RestaurantAvailability } from "@/lib/businessHours";
import { useDeliveryLocation } from "@/lib/deliveryLocation";
import { lookupCustomerName } from "@/lib/customers-db";
import { computeDistanceBasedDelivery } from "@/lib/deliveryPricing";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";

const CUSTOMER_PHONE_KEY = "saovia.customer.phone";
const CUSTOMER_NAME_KEY = "saovia.customer.name";
const CUSTOMER_INSTRUCTIONS_KEY = "saovia.customer.instructions";

const PICKUP_TIME_OPTIONS = ["Dès que possible", "Dans 30 minutes", "Dans 1 heure"];

/**
 * A returning customer isn't a real logged-in account here -- it's whoever
 * this browser last placed an order as, saved to localStorage right after
 * checkout (see submit() below). That save already existed; nothing ever
 * read it back, so the name/phone fields started blank on every visit even
 * for someone who had just ordered. Only name/phone are restored -- not
 * instructions, which are specific to a single delivery, not the customer.
 */
function loadStoredCustomer(): { name: string; phone: string } {
  if (typeof window === "undefined") return { name: "", phone: "" };
  try {
    return {
      name: window.localStorage.getItem(CUSTOMER_NAME_KEY) ?? "",
      phone: window.localStorage.getItem(CUSTOMER_PHONE_KEY) ?? "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

/**
 * The customer's payment *preference*, distinct from the backend's
 * payment_method enum ("cash" | "mobile_money" | "card" | "online"). Only
 * "cash" resolves anywhere today -- mark_cash_payment_received (the only
 * "mark as paid" action in the admin) is hard-gated to payment_status
 * "cash_pending". Wave/Orange Money/MTN Money still submit truthfully as
 * "mobile_money" (never silently downgraded to "cash"), they just land the
 * order in payment_status "pending" with no admin reconciliation action yet
 * -- a pre-existing gap in what the backend already exposes, not something
 * introduced here.
 */
type PaymentChoice = "cash" | "wave" | "orange_money" | "mtn_money";

function toBackendPaymentMethod(choice: PaymentChoice): "cash" | "mobile_money" {
  return choice === "cash" ? "cash" : "mobile_money";
}

/** "Choix du tchep : Tchep poulet" -- groups selections by their option group so the checkout summary shows exactly what was picked, not just a bare list of option names. */
function formatSelectedOptions(options: CartOptionSelection[]): string {
  const byGroup = new Map<string, string[]>();
  for (const o of options) {
    const names = byGroup.get(o.group_name) ?? [];
    names.push(o.name);
    byGroup.set(o.group_name, names);
  }
  return Array.from(byGroup.entries())
    .map(([group, names]) => `${group} : ${names.join(", ")}`)
    .join(" · ");
}

function isValidPhone(value: string): boolean {
  return value.replace(/[^0-9]/g, "").length >= 8;
}

export function TenantOrderDrawer({
  restaurantSlug,
  restaurantName,
  availability,
  timezone,
  deliveryFeeFallback,
  restaurantLat,
  restaurantLng,
}: {
  restaurantSlug: string;
  restaurantName: string;
  availability: RestaurantAvailability | null;
  timezone: string;
  /** Preview only -- applied when a distance-based quote isn't available (tenant or customer has no GPS coordinates). Never 0: create_order's own fallback branch uses this exact same tenant setting (default 1500 FCFA) so a customer is never shown or charged free delivery just because their position couldn't be determined. */
  deliveryFeeFallback: number;
  restaurantLat: number | null;
  restaurantLng: number | null;
}) {
  const navigate = useNavigate();
  const { lines, count, subtotal, hasUnpriced, isOpen, closeCart, increment, decrement, remove, clear, activeOfferId } = useCart();
  const { location, openModal: openLocationModal } = useDeliveryLocation();
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const deliveryQuote =
    mode === "delivery" ? computeDistanceBasedDelivery(restaurantLat, restaurantLng, location?.latitude ?? null, location?.longitude ?? null) : null;
  const [form, setForm] = useState(() => ({ ...loadStoredCustomer(), instructions: "" }));
  const [pickupTime, setPickupTime] = useState(PICKUP_TIME_OPTIONS[0]);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("cash");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Fails open on missing/loading data, matching the server's own
  // "unconfigured = open" default -- the cart is never cleared or blocked
  // by a transient fetch issue, only by a real, confirmed closure.
  const isClosed = availability !== null && !availability.is_open;
  // A delivery order without a confirmed drop-off point can't be fulfilled --
  // pickup never needs one, matching the server's own delivery-only address check.
  const needsLocation = mode === "delivery" && !location?.confirmed;
  const nameEmpty = !form.name.trim();
  const phoneEmpty = !form.phone.trim();
  const canSubmit = lines.length > 0 && !submitting && !isClosed && !needsLocation && !nameEmpty && !phoneEmpty;
  const itemCountLabel = useMemo(() => `${count} article${count > 1 ? "s" : ""}`, [count]);
  // Cart items typically prepare in parallel in the kitchen, not one after
  // another -- the longest single dish is a more honest "when will this be
  // ready" estimate than summing every line. null when nothing in the cart
  // has a preparation time set, so nothing is fabricated.
  const estimatedPrepMinutes = useMemo(() => {
    const values = lines.map((l) => l.item.prepTimeMinutes).filter((v): v is number => typeof v === "number");
    return values.length > 0 ? Math.max(...values) : null;
  }, [lines]);

  if (!isOpen) return null;

  // Covers a returning customer on a different device/browser than the one
  // that saved their name to localStorage -- only fills a still-empty name,
  // never overwrites whatever they've already typed themselves.
  async function handlePhoneBlur() {
    if (form.name.trim() || form.phone.replace(/[^0-9]/g, "").length < 6) return;
    const found = await lookupCustomerName(restaurantSlug, form.phone);
    if (found) setForm((current) => (current.name.trim() ? current : { ...current, name: found }));
  }

  async function submit() {
    const errors: typeof fieldErrors = {};
    if (!form.name.trim()) errors.name = "Merci d'indiquer votre nom.";
    if (!form.phone.trim()) errors.phone = "Merci d'indiquer votre téléphone.";
    else if (!isValidPhone(form.phone)) errors.phone = "Numéro de téléphone invalide.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const target = errors.name ? nameInputRef.current : phoneInputRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const order = await createRestaurantOrder({
        restaurantSlug,
        fulfillment_type: mode,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        delivery_address: mode === "delivery" ? location?.address ?? null : null,
        delivery_instructions: mode === "delivery" ? form.instructions.trim() || null : null,
        delivery_latitude: mode === "delivery" ? location?.latitude ?? null : null,
        delivery_longitude: mode === "delivery" ? location?.longitude ?? null : null,
        delivery_neighborhood: mode === "delivery" ? location?.neighborhood ?? null : null,
        delivery_commune: mode === "delivery" ? location?.commune ?? null : null,
        delivery_city: mode === "delivery" ? location?.city ?? null : null,
        delivery_landmark: mode === "delivery" ? location?.landmark ?? null : null,
        customer_notes: mode === "pickup" ? `Retrait : ${pickupTime}` : null,
        payment_method: toBackendPaymentMethod(paymentChoice),
        items: cartLinesToOrderItems(lines),
        offer_id: activeOfferId,
        visitor_id: getOrCreateVisitorId(),
      });

      window.localStorage.setItem(CUSTOMER_PHONE_KEY, form.phone.trim());
      window.localStorage.setItem(CUSTOMER_NAME_KEY, form.name.trim());
      window.localStorage.setItem(CUSTOMER_INSTRUCTIONS_KEY, form.instructions.trim());
      window.localStorage.setItem("saovia.restaurant.slug", restaurantSlug);

      closeCart();
      clear();
      navigate({ to: "/commande/$orderId/confirmation", params: { orderId: order.order_id } });
    } catch (err) {
      // The full technical error (Postgres/PostgREST code, details, hint)
      // always goes to the console for diagnosis. Only a deliberate
      // business-rule rejection -- a plpgsql `raise exception` in
      // create_order, which PostgREST always reports as code 'P0001' --
      // is safe to show to the customer as-is (its message is already
      // written to be user-facing, e.g. "Adresse de livraison requise").
      // Any other error (a real bug, a schema mismatch, a network issue)
      // must never leak raw internals to the customer.
      console.error("[checkout] create_order failed:", err);
      const isBusinessRuleError = typeof err === "object" && err !== null && "code" in err && (err as { code?: unknown }).code === "P0001";
      setError(
        isBusinessRuleError && err instanceof Error
          ? err.message
          : "Impossible de créer votre commande. Vérifiez vos informations et réessayez.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const subtotalLabel = hasUnpriced ? (subtotal > 0 ? `${subtotal.toLocaleString("fr-FR")} FCFA` : "À confirmer") : `${subtotal.toLocaleString("fr-FR")} FCFA`;
  // Preview only -- create_order always recomputes and charges the
  // authoritative total server-side (it also knows about free-delivery
  // promotions this preview can't see). Prefers the distance-based quote;
  // falls back to the tenant's flat citywide fee when either endpoint's
  // GPS coordinates are unknown, mirroring the server's own fallback.
  // Never 0: a distance-based quote of exactly 0 FCFA can only come from a
  // free_delivery promotion the server applies, and the fallback
  // (deliveryFeeFallback) is itself never 0 by design -- see
  // restaurant_settings.delivery_fee_fallback.
  const resolvedDeliveryFee = mode === "delivery" ? deliveryQuote?.fee ?? deliveryFeeFallback : null;
  const showDeliveryFeeLine = mode === "delivery" && resolvedDeliveryFee !== null;
  const deliveryFeeLabel = `${(resolvedDeliveryFee ?? 0).toLocaleString("fr-FR")} FCFA`;
  const totalAmount = subtotal + (mode === "delivery" ? resolvedDeliveryFee ?? 0 : 0);
  const totalLabel = hasUnpriced ? (subtotal > 0 ? `${totalAmount.toLocaleString("fr-FR")} FCFA` : "À confirmer") : `${totalAmount.toLocaleString("fr-FR")} FCFA`;
  const orderButtonLabel = submitting
    ? "Création en cours..."
    : isClosed
      ? "Fermé pour le moment"
      : needsLocation
        ? "Confirmez votre adresse"
        : `Commander · ${totalLabel}`;

  const addressHeadline = location ? location.commune ?? location.neighborhood ?? location.city ?? location.address : null;
  const addressDetail = location
    ? [location.address, location.neighborhood, location.commune, location.city].filter(
        (part, index) => part && (index === 0 || part !== location.address),
      ).join(", ")
    : null;

  const paymentOptions: { id: PaymentChoice; label: string; icon: LucideIcon }[] = [
    { id: "cash", label: mode === "delivery" ? "Espèces à la livraison" : "Espèces au retrait", icon: Banknote },
    { id: "wave", label: "Wave", icon: Wallet },
    { id: "orange_money", label: "Orange Money", icon: Wallet },
    { id: "mtn_money", label: "MTN Money", icon: Wallet },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-cocoa/50 backdrop-blur-sm" onClick={closeCart} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-[18px]">
          <div>
            <h2 className="font-display text-[27px] font-medium leading-tight text-foreground">Votre commande</h2>
            <p className="mt-1 text-sm text-muted-foreground">{itemCountLabel} · {subtotalLabel}</p>
          </div>
          <button onClick={closeCart} aria-label="Fermer" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-accent"><X className="h-6 w-6" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-[18px]">
          {isClosed && (
            <div className="mb-4 space-y-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-3">
              <AvailabilityBadge availability={availability} timezone={timezone} />
              <p className="text-sm text-destructive">
                Les commandes sont actuellement fermées. Votre panier est conservé — vous pourrez commander dès la réouverture.
              </p>
            </div>
          )}
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10 opacity-40" />
              <p className="text-sm">Votre panier est vide.</p>
              <button onClick={closeCart} className="text-sm font-semibold text-primary">Parcourir la carte</button>
            </div>
          ) : (
            <>
              {/* Order summary card -- item quantities stay directly editable here (steppers/remove) since
                  this drawer is the whole cart-and-checkout flow, not a separate step a "Modifier" link would return to. */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <h3 className="text-[17px] font-semibold text-foreground">Résumé de la commande</h3>
                <ul className="mt-3 space-y-3">
                  {lines.map((l) => {
                    const optionsExtra = l.options.reduce((sum, o) => sum + o.extra_price, 0);
                    return (
                      <li key={l.key} className="flex gap-3">
                        {l.item.image ? <img src={l.item.image} alt={l.item.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="h-14 w-14 shrink-0 rounded-xl bg-muted" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-foreground">{l.item.name}</p>
                          {l.options.length > 0 && <p className="truncate text-xs text-muted-foreground">{formatSelectedOptions(l.options)}</p>}
                          <p className="text-[15px] font-semibold text-foreground">{((l.item.price ?? 0) + optionsExtra).toLocaleString("fr-FR")} FCFA</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <QuantitySelector value={l.qty} onDecrement={() => decrement(l.key)} onIncrement={() => increment(l.key)} />
                            <button onClick={() => remove(l.key)} aria-label="Supprimer" className="ml-auto grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-accent">×</button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="mt-5">
                <h3 className="text-lg font-semibold text-foreground">Comment souhaitez-vous recevoir votre commande ?</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["delivery", "pickup"] as const).map((value) => {
                    const Icon = value === "delivery" ? Truck : ShoppingBag;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMode(value)}
                        className={`flex h-[58px] items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition-colors ${
                          mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4" /> {value === "delivery" ? "Livraison" : "Retrait sur place"}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Vos informations</h3>
                <Field ref={nameInputRef} label="Nom" required placeholder="Votre nom" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} error={fieldErrors.name} />
                <Field ref={phoneInputRef} label="Téléphone" required placeholder="07 XX XX XX XX" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} onBlur={() => void handlePhoneBlur()} error={fieldErrors.phone} type="tel" />
              </div>

              {mode === "delivery" && (
                <>
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-foreground">Adresse de livraison</h3>
                    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                      {location ? (
                        <>
                          <div className="flex items-start gap-2.5">
                            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[17px] font-medium text-foreground">{addressHeadline}</p>
                              {addressDetail && addressDetail !== addressHeadline && (
                                <p className="mt-0.5 text-sm text-muted-foreground">{addressDetail}</p>
                              )}
                              {location.landmark && (
                                <p className="mt-0.5 text-sm text-muted-foreground">Point de repère : {location.landmark}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                            <button type="button" onClick={() => openLocationModal()} className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                              <Pencil className="h-3.5 w-3.5" /> Modifier l'adresse
                            </button>
                            <button type="button" onClick={() => openLocationModal()} className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                              <Navigation className="h-3.5 w-3.5" /> Utiliser ma position
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">Aucune adresse sélectionnée</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openLocationModal()}
                              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                            >
                              <LocateFixed className="h-3.5 w-3.5 shrink-0" /> Ma position
                            </button>
                            <button
                              type="button"
                              onClick={() => openLocationModal({ manual: true })}
                              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-border px-2 text-xs font-semibold hover:bg-accent"
                            >
                              Saisir mon adresse
                            </button>
                          </div>
                        </div>
                      )}
                      {needsLocation && location && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs font-medium text-destructive">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Veuillez confirmer votre adresse de livraison avant de commander.</span>
                        </div>
                      )}
                      {deliveryQuote ? (
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                          <span className="text-muted-foreground">Distance : {deliveryQuote.distanceKm.toFixed(1)} km</span>
                          <span className="font-semibold text-foreground">Livraison : {deliveryQuote.fee.toLocaleString("fr-FR")} FCFA</span>
                        </div>
                      ) : location?.confirmed ? (
                        <div className="mt-3 border-t border-border pt-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Livraison forfaitaire</span>
                            <span className="font-semibold text-foreground">{deliveryFeeFallback.toLocaleString("fr-FR")} FCFA</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            La position n'a pas pu être déterminée. Un forfait de livraison de {deliveryFeeFallback.toLocaleString("fr-FR")} FCFA est appliqué.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Instructions pour le livreur</span>
                      <span className="text-xs text-muted-foreground">Facultatif</span>
                    </div>
                    <textarea
                      rows={3}
                      value={form.instructions}
                      onChange={(e) => setForm((current) => ({ ...current, instructions: e.target.value }))}
                      placeholder="Ex : appeler à l'arrivée, portail bleu..."
                      className="mt-1.5 min-h-[92px] w-full resize-none rounded-2xl border border-input bg-card p-4 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}

              {mode === "pickup" && (
                <div className="mt-6 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Lieu de retrait</h3>
                    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                      <p className="font-semibold text-foreground">{restaurantName}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">À retirer directement au restaurant</p>
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-sm font-semibold text-foreground">Heure de retrait</span>
                    <select
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="mt-1.5 h-[58px] w-full rounded-2xl border border-input bg-card px-4 text-base outline-none focus:border-primary"
                    >
                      {PICKUP_TIME_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-semibold text-foreground">Mode de paiement</h3>
                <div className="space-y-2">
                  {paymentOptions.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentChoice(id)}
                      className={`flex h-[58px] w-full items-center gap-3 rounded-2xl border px-4 text-sm font-medium transition-colors ${
                        paymentChoice === id ? "border-primary bg-primary/10 text-foreground" : "border-input bg-card text-foreground hover:bg-accent"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0 text-primary" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {error && <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        {lines.length > 0 && (
          <div className="sticky bottom-0 border-t border-border bg-background px-6 py-3.5 pb-[calc(1.125rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            {estimatedPrepMinutes !== null && (
              <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" /> Préparation estimée : environ {estimatedPrepMinutes} min
              </p>
            )}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Sous-total</span><span>{subtotalLabel}</span></div>
              {showDeliveryFeeLine && (
                <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Frais de livraison</span><span>{deliveryFeeLabel}</span></div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-1 text-[20px] font-bold text-foreground"><span className="text-sm font-semibold text-muted-foreground">Total à payer</span><span>{totalLabel}</span></div>
            </div>
            <button onClick={submit} disabled={!canSubmit} className="mt-3 flex h-[58px] w-full items-center justify-center rounded-2xl bg-primary px-6 text-lg font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {orderButtonLabel}
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

const Field = forwardRef<HTMLInputElement, { label: string; value: string; onChange: (value: string) => void; onBlur?: () => void; type?: string; placeholder?: string; required?: boolean; error?: string | undefined }>(
  function Field({ label, value, onChange, onBlur, type = "text", placeholder, required, error }, ref) {
    return (
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">{label}{required && " *"}</span>
        <input
          ref={ref}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          className={`mt-1.5 h-[58px] w-full rounded-2xl border bg-card px-[18px] text-base outline-none focus:border-primary ${error ? "border-destructive" : "border-input"}`}
        />
        {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
      </label>
    );
  },
);
