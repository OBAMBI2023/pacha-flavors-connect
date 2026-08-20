import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart, type CartLine } from "@/lib/cart";
import { formatPrice } from "@/data/menu";
import { createOrder, type CreateOrderResult, type FulfillmentType, type OrderSource } from "@/lib/orders-db";

type Mode = "livraison" | "emporter";

const FULFILLMENT_TYPE: Record<Mode, FulfillmentType> = {
  livraison: "delivery",
  emporter: "pickup",
};

/**
 * Resolves how this visit reached the storefront, purely from real browser
 * signals (URL query params SAOVIA-generated QR codes/links can carry,
 * document.referrer) -- never a value invented client-side and never
 * trusted verbatim server-side either: `create_order` re-validates
 * `order_source` against its own allow-list.
 */
function resolveOrderSource(): { source: OrderSource; metadata: Record<string, string> } {
  if (typeof window === "undefined") return { source: "direct", metadata: {} };
  const params = new URLSearchParams(window.location.search);
  const metadata: Record<string, string> = {};
  if (document.referrer) metadata["referrer"] = document.referrer;
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    if (value) metadata[key] = value;
  }
  const source: OrderSource = params.get("src") === "qr" ? "qr_code" : "direct";
  return { source, metadata };
}

/**
 * Generic order drawer for tenant storefronts (`/r/:slug`). The order is
 * created directly in SAOVIA via `create_order` (which re-validates every
 * product/option and recomputes the total server-side) and confirmed right
 * here -- there is no WhatsApp handoff. The restaurant receives it in its
 * dashboard through Realtime (Phase 2); this drawer never needs the
 * restaurant's phone number to complete a sale.
 */
export function TenantOrderDrawer({
  restaurantSlug,
  restaurantName,
}: {
  restaurantSlug: string;
  restaurantName: string;
}) {
  const { lines, count, subtotal, hasUnpriced, isOpen, closeCart, increment, decrement, remove, clear } =
    useCart();
  const [mode, setMode] = useState<Mode>("livraison");
  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    commune: "",
    adresse: "",
    instructions: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<CreateOrderResult | null>(null);
  const [confirmedLines, setConfirmedLines] = useState<CartLine[]>([]);
  const [showConfirmedDetails, setShowConfirmedDetails] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotalLabel = hasUnpriced
    ? subtotal > 0
      ? `${subtotal.toLocaleString("fr-FR")} FCFA + articles à confirmer`
      : "À confirmer avec le restaurant"
    : `${subtotal.toLocaleString("fr-FR")} FCFA`;

  async function submit() {
    if (lines.length === 0 || submitting) return;
    if (!form.nom.trim() || !form.telephone.trim()) {
      setError("Merci d'indiquer votre nom et votre téléphone.");
      return;
    }
    if (mode === "livraison" && (!form.commune.trim() || !form.adresse.trim())) {
      setError("Merci d'indiquer votre commune / quartier et votre adresse.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const { source, metadata } = resolveOrderSource();
      const order = await createOrder({
        slug: restaurantSlug,
        fulfillmentType: FULFILLMENT_TYPE[mode],
        customerName: form.nom,
        customerPhone: form.telephone,
        items: lines.map((l) => ({ product_id: l.item.id, quantity: l.qty })),
        deliveryCommune: mode === "livraison" ? form.commune : undefined,
        deliveryAddress: mode === "livraison" ? form.adresse : undefined,
        deliveryInstructions: mode === "livraison" ? form.instructions : undefined,
        orderSource: source,
        sourceMetadata: metadata,
      });

      // Order is confirmed server-side at this point -- only now is it safe
      // to show a success screen and empty the cart.
      setConfirmedLines(lines);
      setConfirmation(order);
      clear();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Impossible d'enregistrer la commande. Réessayez.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function backToMenu() {
    setConfirmation(null);
    setConfirmedLines([]);
    setShowConfirmedDetails(false);
    setForm({ nom: "", telephone: "", commune: "", adresse: "", instructions: "" });
    closeCart();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={confirmation ? backToMenu : closeCart} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        {confirmation ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-2xl font-semibold">Commande envoyée</h2>
              <button onClick={backToMenu} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="flex flex-col items-center text-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10">
                  <CheckCircle2 className="h-9 w-9 text-primary" />
                </span>
                <p className="mt-4 text-sm text-muted-foreground">
                  {restaurantName} a bien reçu votre commande.
                </p>
                <p className="mt-1 font-display text-3xl font-semibold">Commande n°{confirmation.order_number}</p>
                <p className="mt-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  En attente de confirmation
                </p>
                <p className="mt-5 font-display text-2xl font-semibold">
                  {confirmation.total_amount.toLocaleString("fr-FR")} {confirmation.currency}
                </p>
              </div>

              <button
                onClick={() => setShowConfirmedDetails((v) => !v)}
                className="mt-6 flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium"
              >
                Voir ma commande
                {showConfirmedDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showConfirmedDetails && (
                <ul className="mt-3 space-y-2">
                  {confirmedLines.map((l) => (
                    <li key={l.item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                      <span className="min-w-0 truncate">
                        {l.qty} × {l.item.name}
                      </span>
                      <span className="shrink-0 font-medium">{formatPrice(l.item.price)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-border px-5 py-4">
              <button
                onClick={backToMenu}
                className="w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Retourner au menu
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-2xl font-semibold">
                Votre panier{count > 0 ? ` (${count})` : ""}
              </h2>
              <button onClick={closeCart} aria-label="Fermer le panier" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Votre panier est vide.</p>
                  <button onClick={closeCart} className="text-sm font-semibold text-primary">
                    Parcourir la carte
                  </button>
                </div>
              ) : (
                <>
                  <ul className="space-y-3">
                    {lines.map((l) => (
                      <li key={l.item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                        {l.item.image && (
                          <img
                            src={l.item.image}
                            alt={l.item.name}
                            loading="lazy"
                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{l.item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatPrice(l.item.price)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => decrement(l.item.id)}
                              aria-label="Diminuer"
                              className="grid h-8 w-8 place-items-center rounded-full border border-border"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                            <button
                              onClick={() => increment(l.item.id)}
                              aria-label="Augmenter"
                              className="grid h-8 w-8 place-items-center rounded-full border border-border"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => remove(l.item.id)}
                              aria-label="Supprimer"
                              className="ml-auto grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <button onClick={clear} className="mt-3 text-xs font-medium text-muted-foreground underline">
                    Vider le panier
                  </button>

                  <div className="mt-6">
                    <h3 className="font-display text-xl font-semibold">Mode de réception</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(["livraison", "emporter"] as Mode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${
                            mode === m
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:bg-accent"
                          }`}
                        >
                          {m === "livraison" ? "Livraison" : "À emporter"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <Field label="Nom *" value={form.nom} onChange={set("nom")} />
                    <Field label="Téléphone *" type="tel" value={form.telephone} onChange={set("telephone")} />
                    {mode === "livraison" && (
                      <>
                        <Field label="Commune / quartier *" value={form.commune} onChange={set("commune")} />
                        <Field label="Adresse / indication *" value={form.adresse} onChange={set("adresse")} />
                        <label className="block">
                          <span className="text-xs font-medium text-muted-foreground">Instructions de livraison</span>
                          <textarea
                            rows={3}
                            value={form.instructions}
                            onChange={set("instructions")}
                            className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                          />
                        </label>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-border px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Sous-total</span>
                  <span className="text-right font-semibold">{subtotalLabel}</span>
                </div>
                {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
                <button
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="mt-3 w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Envoi de la commande..." : "Confirmer la commande"}
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
