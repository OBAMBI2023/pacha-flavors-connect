import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Banknote,
  ChevronDown,
  Clock,
  Gift,
  LocateFixed,
  MapPin,
  Navigation,
  Pencil,
  ShieldAlert,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCart, type CartOptionSelection } from "@/lib/cart";
import { createRestaurantOrder, cartLinesToOrderItems } from "@/lib/orders";
import { validatePromoCode } from "@/lib/promoCodes";
import { QuantitySelector } from "@/components/tenant/QuantitySelector";
import { AvailabilityBadge } from "@/components/tenant/AvailabilityBadge";
import type { RestaurantAvailability } from "@/lib/businessHours";
import { useDeliveryLocation } from "@/lib/deliveryLocation";
import { lookupCustomerName } from "@/lib/customers-db";
import { computeDistanceBasedDelivery } from "@/lib/deliveryPricing";
import { geocodeAddress } from "@/lib/geolocation";
import { getOrCreateVisitorId } from "@/lib/visitorTracking";
import { trackMetaPixelEvent } from "@/lib/metaPixel";
import { formatMoney } from "@/lib/currency";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

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

/** Formats an ISO instant as the local `YYYY-MM-DDTHH:mm` a native `<input type="datetime-local">` expects, in the browser's own timezone (matches how the value is read back: `new Date(localValue)` interprets it in that same local timezone, so the round-trip instant is always correct). */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/**
 * Compact row (icon + title + short description + chevron) that reveals
 * its content only once tapped, per the "options se déplient uniquement
 * lorsque le client les active" requirement -- collapsed by default,
 * independent of every other row (no accordion-style exclusivity).
 * animate-collapsible-down/up (tw-animate-css, already imported globally)
 * drives the height transition off Radix's own measured content height,
 * so no extra CSS had to be added for this.
 */
function ExpandableOption({
  icon: Icon,
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-2xl border border-border bg-card">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
        <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Same compact row shape as ExpandableOption, but a switch instead of a chevron/expanding content -- for a plain yes/no option like cutlery. */
function SwitchOption({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  // The whole row toggles (not just the visual switch, which is only
  // 20x36px on its own -- well under the 44px minimum touch target) --
  // the Switch itself is inert (tabIndex -1, pointer-events-none) so a tap
  // never fires onCheckedChange twice via bubbling.
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      aria-pressed={checked}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} tabIndex={-1} className="pointer-events-none shrink-0" />
    </button>
  );
}

export function TenantOrderDrawer({
  restaurantSlug,
  restaurantName,
  currency,
  availability,
  timezone,
  deliveryFeeFallback,
  restaurantLat,
  restaurantLng,
  deliveryEnabled = true,
  pickupEnabled = true,
}: {
  restaurantSlug: string;
  restaurantName: string;
  currency: string | null;
  availability: RestaurantAvailability | null;
  timezone: string;
  /** Preview only -- applied when a distance-based quote isn't available (tenant or customer has no GPS coordinates). Never 0: create_order's own fallback branch uses this exact same tenant setting (default 1500 FCFA) so a customer is never shown or charged free delivery just because their position couldn't be determined. */
  deliveryFeeFallback: number;
  restaurantLat: number | null;
  restaurantLng: number | null;
  /** Tenant-configured fulfillment modes -- fail open (both true) while settings haven't loaded yet, same fail-open convention as `isClosed` below. create_order re-validates this server-side regardless. */
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
}) {
  const navigate = useNavigate();
  const { lines, count, subtotal, hasUnpriced, isOpen, closeCart, increment, decrement, remove, clear, activeOfferId } = useCart();
  const { location, openModal: openLocationModal } = useDeliveryLocation();
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const availableModes = (["delivery", "pickup"] as const).filter((m) => (m === "delivery" ? deliveryEnabled : pickupEnabled));

  // Keeps the selection valid (and auto-picks the only remaining option) if
  // settings resolve after mount, or the tenant disables the mode currently
  // selected -- self-healing rather than a one-time init, since props here
  // can change after the initial render (settings load asynchronously).
  useEffect(() => {
    if (mode === "delivery" && !deliveryEnabled && pickupEnabled) setMode("pickup");
    else if (mode === "pickup" && !pickupEnabled && deliveryEnabled) setMode("delivery");
  }, [deliveryEnabled, pickupEnabled, mode]);
  const deliveryQuote =
    mode === "delivery" ? computeDistanceBasedDelivery(restaurantLat, restaurantLng, location?.latitude ?? null, location?.longitude ?? null) : null;
  const [form, setForm] = useState(() => ({ ...loadStoredCustomer(), instructions: "" }));
  const [pickupTime, setPickupTime] = useState(PICKUP_TIME_OPTIONS[0]);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("cash");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Checkout options -- all collapsed/off by default, independent of each
  // other (no accordion-style exclusivity).
  const [allergiesOpen, setAllergiesOpen] = useState(false);
  const [allergies, setAllergies] = useState("");
  const [needsCutlery, setNeedsCutlery] = useState(false);
  const [orderForSomeoneOpen, setOrderForSomeoneOpen] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientCity, setRecipientCity] = useState("");
  const [recipientNeighborhood, setRecipientNeighborhood] = useState("");
  const [recipientLandmark, setRecipientLandmark] = useState("");
  const [recipientAdditionalInfo, setRecipientAdditionalInfo] = useState("");
  const [recipientErrors, setRecipientErrors] = useState<{ name?: string; phone?: string; address?: string }>({});
  const recipientNameRef = useRef<HTMLInputElement>(null);
  const recipientPhoneRef = useRef<HTMLInputElement>(null);
  const recipientAddressRef = useRef<HTMLTextAreaElement>(null);

  // Promo code: only ever entered inside this drawer (unlike activeOfferId,
  // which can be set from TenantOffersSheet before checkout even opens), so
  // it lives here as local state rather than in the shared cart context.
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState<{ promoCodeId: string; discountAmount: number; waivesDelivery: boolean } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoValidating, setPromoValidating] = useState(false);

  // Fails open on missing/loading data, matching the server's own
  // "unconfigured = open" default -- the cart is never cleared or blocked
  // by a transient fetch issue, only by a real, confirmed closure.
  const isClosed = availability !== null && !availability.is_open;
  // Scheduled checkout while closed: a datetime-local input value (browser's
  // own local time -- converted to an absolute instant via `new Date()` right
  // before submit, so the UTC moment sent to create_order is always correct
  // regardless of display timezone). Defaulted to the server's own computed
  // next opening the moment it becomes known; create_order is the sole
  // authority on whether the final chosen instant actually falls in an open
  // window -- this default is only ever a convenience, never trusted.
  const [scheduledFor, setScheduledFor] = useState("");
  useEffect(() => {
    if (isClosed && availability?.next_opens_at && !scheduledFor) {
      setScheduledFor(toDatetimeLocalValue(availability.next_opens_at));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClosed, availability?.next_opens_at]);
  const scheduledForDate = scheduledFor ? new Date(scheduledFor) : null;
  const needsSchedule = isClosed && (!scheduledForDate || Number.isNaN(scheduledForDate.getTime()) || scheduledForDate.getTime() <= Date.now());
  // A delivery order without a confirmed drop-off point can't be fulfilled --
  // pickup never needs one, matching the server's own delivery-only address check.
  // Ordering for someone else replaces the delivery point with the
  // recipient's typed address -- the orderer's own confirmed location is
  // irrelevant in that case, only the recipient fields (validated
  // separately below) matter.
  const orderingForSomeone = mode === "delivery" && orderForSomeoneOpen;
  const needsLocation = mode === "delivery" && !orderingForSomeone && !location?.confirmed;
  const nameEmpty = !form.name.trim();
  const phoneEmpty = !form.phone.trim();
  const canSubmit = lines.length > 0 && !submitting && !geocoding && !needsSchedule && !needsLocation && !nameEmpty && !phoneEmpty;
  const itemCountLabel = useMemo(() => `${count} article${count > 1 ? "s" : ""}`, [count]);
  // Cart items typically prepare in parallel in the kitchen, not one after
  // another -- the longest single dish is a more honest "when will this be
  // ready" estimate than summing every line. null when nothing in the cart
  // has a preparation time set, so nothing is fabricated.
  const estimatedPrepMinutes = useMemo(() => {
    const values = lines.map((l) => l.item.prepTimeMinutes).filter((v): v is number => typeof v === "number");
    return values.length > 0 ? Math.max(...values) : null;
  }, [lines]);

  // Recalculates the discount whenever the cart or the phone (per-customer
  // limits are checked by phone) changes while a code is applied -- reuses
  // the exact same validation call, so there's no separate recompute logic
  // to keep in sync. Must stay above the `if (!isOpen) return null` below --
  // every hook in this component has to run on every render regardless of
  // isOpen, or React sees a different hook count between renders.
  useEffect(() => {
    if (!appliedPromoCode) return;
    void applyPromoCode(appliedPromoCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, form.phone]);

  // InitiateCheckout: fires once per "drawer opens with items in it" --
  // this drawer doubles as the cart view and the checkout form (there's no
  // separate step), so opening it with a non-empty cart is this app's
  // equivalent of "began checkout". Never refires while the drawer stays
  // open (quantity edits, promo code entry, etc. aren't a new checkout).
  useEffect(() => {
    if (isOpen && lines.length > 0) {
      trackMetaPixelEvent("InitiateCheckout", {
        value: subtotal,
        currency: currency ?? undefined,
        num_items: count,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  // Covers a returning customer on a different device/browser than the one
  // that saved their name to localStorage -- only fills a still-empty name,
  // never overwrites whatever they've already typed themselves.
  async function handlePhoneBlur() {
    if (form.name.trim() || form.phone.replace(/[^0-9]/g, "").length < 6) return;
    const found = await lookupCustomerName(restaurantSlug, form.phone);
    if (found) setForm((current) => (current.name.trim() ? current : { ...current, name: found }));
  }

  async function applyPromoCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    if (!form.phone.trim()) {
      setPromoError("Indiquez votre téléphone avant d'appliquer un code promo.");
      return;
    }
    setPromoValidating(true);
    setPromoError(null);
    try {
      const result = await validatePromoCode({ restaurantSlug, code: trimmed, phone: form.phone.trim(), subtotal });
      if (!result.valid) {
        setPromoError(result.message);
        setPromoDiscount(null);
        setAppliedPromoCode(null);
        return;
      }
      setAppliedPromoCode(trimmed);
      setPromoDiscount({ promoCodeId: result.promoCodeId, discountAmount: result.discountAmount, waivesDelivery: result.waivesDelivery });
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : "Impossible de vérifier ce code promo.");
      setPromoDiscount(null);
      setAppliedPromoCode(null);
    } finally {
      setPromoValidating(false);
    }
  }

  function removePromoCode() {
    setAppliedPromoCode(null);
    setPromoDiscount(null);
    setPromoError(null);
    setPromoCodeInput("");
  }

  async function submit() {
    const errors: typeof fieldErrors = {};
    if (!form.name.trim()) errors.name = "Merci d'indiquer votre nom.";
    if (!form.phone.trim()) errors.phone = "Merci d'indiquer votre téléphone.";
    else if (!isValidPhone(form.phone)) errors.phone = "Numéro de téléphone invalide.";

    const recErrors: typeof recipientErrors = {};
    if (orderingForSomeone) {
      if (!recipientName.trim()) recErrors.name = "Merci d'indiquer le nom du destinataire.";
      if (!recipientPhone.trim()) recErrors.phone = "Merci d'indiquer le téléphone du destinataire.";
      else if (!isValidPhone(recipientPhone)) recErrors.phone = "Numéro de téléphone invalide.";
      if (!recipientAddress.trim()) recErrors.address = "Merci d'indiquer l'adresse du destinataire.";
    }

    if (Object.keys(errors).length > 0 || Object.keys(recErrors).length > 0) {
      setFieldErrors(errors);
      setRecipientErrors(recErrors);
      const target = errors.name
        ? nameInputRef.current
        : errors.phone
          ? phoneInputRef.current
          : recErrors.name
            ? recipientNameRef.current
            : recErrors.phone
              ? recipientPhoneRef.current
              : recErrors.address
                ? recipientAddressRef.current
                : null;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus();
      return;
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    setRecipientErrors({});

    // Ordering for someone else: the recipient's typed address replaces
    // the delivery point. It's attempted through the same forward-geocoding
    // used nowhere else in the checkout flow (see geocodeAddress) so a
    // distance-based fee can still apply -- a manually-typed address isn't
    // automatically untrustworthy, it just isn't pre-verified like a pinned
    // GPS location is. Geocoding failing (no match, network down) is not an
    // error: it just means no coordinates travel with the order, and
    // create_order's own fallback (flat fee) applies exactly as it already
    // does for any other address it can't place -- checkout is never blocked.
    let recipientLat: number | null = null;
    let recipientLng: number | null = null;
    if (orderingForSomeone) {
      setGeocoding(true);
      const query = [recipientAddress, recipientNeighborhood, recipientCity, "Côte d'Ivoire"].filter((p) => p.trim()).join(", ");
      const geocoded = await geocodeAddress(query).catch(() => null);
      setGeocoding(false);
      recipientLat = geocoded?.latitude ?? null;
      recipientLng = geocoded?.longitude ?? null;
    }

    const notesParts: string[] = [];
    if (mode === "pickup") notesParts.push(`Retrait : ${pickupTime}`);

    try {
      const order = await createRestaurantOrder({
        restaurantSlug,
        fulfillment_type: mode,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        delivery_address: mode === "delivery" ? (orderingForSomeone ? recipientAddress.trim() : location?.address ?? null) : null,
        delivery_instructions: mode === "delivery" ? form.instructions.trim() || null : null,
        delivery_latitude: mode === "delivery" ? (orderingForSomeone ? recipientLat : location?.latitude ?? null) : null,
        delivery_longitude: mode === "delivery" ? (orderingForSomeone ? recipientLng : location?.longitude ?? null) : null,
        delivery_neighborhood: mode === "delivery" ? (orderingForSomeone ? recipientNeighborhood.trim() || null : location?.neighborhood ?? null) : null,
        delivery_commune: mode === "delivery" && !orderingForSomeone ? location?.commune ?? null : null,
        delivery_city: mode === "delivery" ? (orderingForSomeone ? recipientCity.trim() || null : location?.city ?? null) : null,
        delivery_landmark: mode === "delivery" ? (orderingForSomeone ? recipientLandmark.trim() || null : location?.landmark ?? null) : null,
        customer_notes: notesParts.length > 0 ? notesParts.join(" · ") : null,
        payment_method: toBackendPaymentMethod(paymentChoice),
        items: cartLinesToOrderItems(lines),
        offer_id: activeOfferId,
        visitor_id: getOrCreateVisitorId(),
        cutlery_requested: needsCutlery,
        is_for_someone_else: orderingForSomeone,
        recipient_name: orderingForSomeone ? recipientName.trim() : null,
        recipient_phone: orderingForSomeone ? recipientPhone.trim() : null,
        recipient_address: orderingForSomeone ? recipientAddress.trim() : null,
        recipient_city: orderingForSomeone ? recipientCity.trim() || null : null,
        recipient_neighborhood: orderingForSomeone ? recipientNeighborhood.trim() || null : null,
        recipient_landmark: orderingForSomeone ? recipientLandmark.trim() || null : null,
        recipient_additional_info: orderingForSomeone ? recipientAdditionalInfo.trim() || null : null,
        allergy_information: allergies.trim() || null,
        driver_note: mode === "delivery" ? form.instructions.trim() || null : null,
        customer_profile_address: mode === "delivery" ? location?.address ?? null : null,
        promo_code: appliedPromoCode,
        scheduled_for: isClosed && scheduledForDate ? scheduledForDate.toISOString() : null,
      });

      window.localStorage.setItem(CUSTOMER_PHONE_KEY, form.phone.trim());
      window.localStorage.setItem(CUSTOMER_NAME_KEY, form.name.trim());
      window.localStorage.setItem(CUSTOMER_INSTRUCTIONS_KEY, form.instructions.trim());
      window.localStorage.setItem("saovia.restaurant.slug", restaurantSlug);

      closeCart();
      clear();
      removePromoCode();
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

  const subtotalLabel = hasUnpriced ? (subtotal > 0 ? formatMoney(subtotal, currency) : "À confirmer") : formatMoney(subtotal, currency);
  // Preview only -- create_order always recomputes and charges the
  // authoritative total server-side (it also knows about free-delivery
  // promotions this preview can't see). Prefers the distance-based quote;
  // falls back to the tenant's flat citywide fee when either endpoint's
  // GPS coordinates are unknown, mirroring the server's own fallback.
  // Never 0: a distance-based quote of exactly 0 FCFA can only come from a
  // free_delivery promotion the server applies, and the fallback
  // (deliveryFeeFallback) is itself never 0 by design -- see
  // restaurant_settings.delivery_fee_fallback.
  const resolvedDeliveryFee =
    mode === "delivery" ? (promoDiscount?.waivesDelivery ? 0 : deliveryQuote?.fee ?? deliveryFeeFallback) : null;
  const showDeliveryFeeLine = mode === "delivery" && resolvedDeliveryFee !== null;
  const deliveryFeeLabel = formatMoney(resolvedDeliveryFee ?? 0, currency);
  const promoDiscountAmount = promoDiscount?.discountAmount ?? 0;
  const showDiscountLine = promoDiscountAmount > 0;
  const discountLabel = `-${formatMoney(promoDiscountAmount, currency)}`;
  const totalAmount = Math.max(subtotal - promoDiscountAmount, 0) + (mode === "delivery" ? resolvedDeliveryFee ?? 0 : 0);
  const totalLabel = hasUnpriced ? (subtotal > 0 ? formatMoney(totalAmount, currency) : "À confirmer") : formatMoney(totalAmount, currency);
  const orderButtonLabel = geocoding
    ? "Recherche de l'adresse..."
    : submitting
    ? isClosed
      ? "Programmation en cours..."
      : "Création en cours..."
    : needsSchedule
      ? "Choisissez un créneau"
      : isClosed
        ? `Programmer ma commande · ${totalLabel}`
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
            <div className="mb-4 space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
                  <Clock className="h-4 w-4 shrink-0" /> Restaurant actuellement fermé
                </p>
                <p className="text-sm text-violet-700">
                  Vous pouvez programmer votre commande pour le prochain créneau disponible.
                </p>
              </div>
              <AvailabilityBadge availability={availability} timezone={timezone} />
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Date et heure souhaitées *</span>
                <input
                  type="datetime-local"
                  required
                  min={toDatetimeLocalValue(new Date().toISOString())}
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>
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
                          <p className="text-[15px] font-semibold text-foreground">{formatMoney((l.item.price ?? 0) + optionsExtra, currency)}</p>
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
                <div className={`mt-3 grid gap-2 ${availableModes.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {availableModes.map((value) => {
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
                          <span className="font-semibold text-foreground">Livraison : {formatMoney(deliveryQuote.fee, currency)}</span>
                        </div>
                      ) : location?.confirmed ? (
                        <div className="mt-3 border-t border-border pt-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Livraison forfaitaire</span>
                            <span className="font-semibold text-foreground">{formatMoney(deliveryFeeFallback, currency)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            La position n'a pas pu être déterminée. Un forfait de livraison de {formatMoney(deliveryFeeFallback, currency)} est appliqué.
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

              <div className="mt-5 space-y-2.5">
                <ExpandableOption
                  icon={ShieldAlert}
                  title="Allergies ou instructions alimentaires"
                  description="Facultatif"
                  open={allergiesOpen}
                  onOpenChange={setAllergiesOpen}
                >
                  <textarea
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ex. Sans arachides, allergie aux crevettes..."
                    rows={2}
                    className="w-full resize-none rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-primary"
                  />
                </ExpandableOption>

                <SwitchOption
                  icon={UtensilsCrossed}
                  title="Des couverts ?"
                  description="Ajoutez des couverts à votre commande"
                  checked={needsCutlery}
                  onCheckedChange={setNeedsCutlery}
                />

                {mode === "delivery" && (
                  <ExpandableOption
                    icon={Gift}
                    title="Vous commandez pour quelqu'un ?"
                    description="Faites livrer à une autre personne"
                    open={orderForSomeoneOpen}
                    onOpenChange={setOrderForSomeoneOpen}
                  >
                    <Field
                      ref={recipientNameRef}
                      label="Nom du destinataire"
                      required
                      placeholder="Nom et prénom"
                      value={recipientName}
                      onChange={setRecipientName}
                      error={recipientErrors.name}
                    />
                    <Field
                      ref={recipientPhoneRef}
                      label="Numéro de téléphone"
                      required
                      type="tel"
                      placeholder="Ex. 07 XX XX XX XX"
                      value={recipientPhone}
                      onChange={setRecipientPhone}
                      error={recipientErrors.phone}
                    />
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Adresse de livraison *</span>
                      <textarea
                        ref={recipientAddressRef}
                        value={recipientAddress}
                        onChange={(e) => setRecipientAddress(e.target.value)}
                        placeholder="Adresse complète du destinataire"
                        rows={2}
                        aria-invalid={Boolean(recipientErrors.address)}
                        className={`mt-1.5 w-full resize-none rounded-xl border bg-card p-3 text-sm outline-none focus:border-primary ${recipientErrors.address ? "border-destructive" : "border-input"}`}
                      />
                      {recipientErrors.address && <span className="mt-1 block text-xs font-medium text-destructive">{recipientErrors.address}</span>}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Quartier" placeholder="Ex. Cocody" value={recipientNeighborhood} onChange={setRecipientNeighborhood} />
                      <Field label="Ville" placeholder="Ex. Abidjan" value={recipientCity} onChange={setRecipientCity} />
                    </div>
                    <Field label="Point de repère" placeholder="Ex. Près de la pharmacie" value={recipientLandmark} onChange={setRecipientLandmark} />
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Informations complémentaires</span>
                      <textarea
                        value={recipientAdditionalInfo}
                        onChange={(e) => setRecipientAdditionalInfo(e.target.value)}
                        placeholder="Ex. Portail vert, sonner deux fois..."
                        rows={2}
                        className="mt-1.5 w-full resize-none rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-primary"
                      />
                    </label>
                  </ExpandableOption>
                )}
              </div>

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
            <div className="mb-3 space-y-2">
              {appliedPromoCode ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <span className="truncate text-sm font-medium text-foreground">Code « {appliedPromoCode} » appliqué</span>
                  <button type="button" onClick={removePromoCode} className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-destructive">
                    Retirer
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value)}
                    placeholder="Entrez votre code promo"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => void applyPromoCode(promoCodeInput)}
                    disabled={!promoCodeInput.trim() || !form.phone.trim() || promoValidating}
                    className="h-11 shrink-0 rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {promoValidating ? "..." : "Appliquer"}
                  </button>
                </div>
              )}
              {promoError && <p className="text-xs font-medium text-destructive">{promoError}</p>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Sous-total</span><span>{subtotalLabel}</span></div>
              {showDiscountLine && (
                <div className="flex items-center justify-between gap-3 text-sm text-primary"><span>Réduction</span><span>{discountLabel}</span></div>
              )}
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
