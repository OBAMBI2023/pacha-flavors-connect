import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, ShoppingBag, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCart } from "@/lib/cart";
import { createRestaurantOrder, cartLinesToOrderItems } from "@/lib/orders";

const CUSTOMER_PHONE_KEY = "saovia.customer.phone";
const CUSTOMER_NAME_KEY = "saovia.customer.name";
const CUSTOMER_ADDRESS_KEY = "saovia.customer.address";
const CUSTOMER_INSTRUCTIONS_KEY = "saovia.customer.instructions";

export function TenantOrderDrawer({ restaurantSlug, restaurantName }: { restaurantSlug: string; restaurantName: string }) {
  const navigate = useNavigate();
  const { lines, count, subtotal, hasUnpriced, isOpen, closeCart, increment, decrement, remove, clear } = useCart();
  const [mode, setMode] = useState<"delivery" | "pickup">("delivery");
  const [form, setForm] = useState({ name: "", phone: "", address: "", instructions: "" });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; address?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = lines.length > 0 && !submitting;
  const itemCountLabel = useMemo(() => `${count} article${count > 1 ? "s" : ""}`, [count]);

  if (!isOpen) return null;

  async function submit() {
    if (!canSubmit) return;
    const errors: typeof fieldErrors = {};
    if (!form.name.trim()) errors.name = "Merci d'indiquer votre nom.";
    if (!form.phone.trim()) errors.phone = "Merci d'indiquer votre téléphone.";
    if (mode === "delivery" && !form.address.trim()) errors.address = "Merci d'indiquer votre adresse.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const order = await createRestaurantOrder({
        restaurantSlug,
        fulfillment_type: mode,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        delivery_address: mode === "delivery" ? form.address.trim() : null,
        delivery_instructions: mode === "delivery" ? form.instructions.trim() || null : null,
        items: cartLinesToOrderItems(lines),
      });

      window.localStorage.setItem(CUSTOMER_PHONE_KEY, form.phone.trim());
      window.localStorage.setItem(CUSTOMER_NAME_KEY, form.name.trim());
      window.localStorage.setItem(CUSTOMER_ADDRESS_KEY, form.address.trim());
      window.localStorage.setItem(CUSTOMER_INSTRUCTIONS_KEY, form.instructions.trim());
      window.localStorage.setItem("saovia.restaurant.slug", restaurantSlug);

      closeCart();
      clear();
      navigate({ to: "/commande/$orderId/confirmation", params: { orderId: order.order_id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la commande.");
    } finally {
      setSubmitting(false);
    }
  }

  const subtotalLabel = hasUnpriced ? (subtotal > 0 ? `${subtotal.toLocaleString("fr-FR")} FCFA` : "À confirmer") : `${subtotal.toLocaleString("fr-FR")} FCFA`;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-cocoa/50 backdrop-blur-sm" onClick={closeCart} aria-hidden />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Votre commande</h2>
            <p className="text-xs text-muted-foreground">{restaurantName} · {itemCountLabel}</p>
          </div>
          <button onClick={closeCart} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10 opacity-40" />
              <p className="text-sm">Votre panier est vide.</p>
              <button onClick={closeCart} className="text-sm font-semibold text-primary">Parcourir la carte</button>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {lines.map((l) => (
                  <li key={l.item.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                    {l.item.image ? <img src={l.item.image} alt={l.item.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.item.name}</p>
                      <p className="text-xs text-muted-foreground">{(l.item.price ?? 0).toLocaleString("fr-FR")} FCFA</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => decrement(l.item.id)} aria-label="Diminuer" className="grid h-11 w-11 place-items-center rounded-full border border-border"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                        <button onClick={() => increment(l.item.id)} aria-label="Augmenter" className="grid h-11 w-11 place-items-center rounded-full border border-border"><Plus className="h-3.5 w-3.5" /></button>
                        <button onClick={() => remove(l.item.id)} aria-label="Supprimer" className="ml-auto grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-accent">×</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-3">
                <h3 className="font-display text-xl font-semibold">Mode de réception</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(["delivery", "pickup"] as const).map((value) => (
                    <button key={value} onClick={() => setMode(value)} className={`rounded-xl border px-3 py-3 text-sm font-medium ${mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-accent"}`}>
                      {value === "delivery" ? "Livraison" : "Retrait sur place"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <Field label="Nom *" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} error={fieldErrors.name} />
                <Field label="Téléphone *" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} error={fieldErrors.phone} type="tel" />
                {mode === "delivery" && (
                  <>
                    <Field label="Adresse / indication *" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} error={fieldErrors.address} />
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">Instructions de livraison</span>
                      <textarea rows={3} value={form.instructions} onChange={(e) => setForm((current) => ({ ...current, instructions: e.target.value }))} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary" />
                    </label>
                  </>
                )}
              </div>
            </>
          )}
          {error && <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        </div>

        {lines.length > 0 && (
          <div className="sticky bottom-0 border-t border-border bg-background px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Sous-total</span><span className="text-right font-semibold">{subtotalLabel}</span></div>
            <button onClick={submit} disabled={!canSubmit} className="mt-3 flex h-[54px] w-full items-center justify-center rounded-2xl bg-[#F5A900] px-6 text-base font-bold text-[#111111] shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Création en cours..." : "Commander"}
            </button>
          </div>
        )}
      </aside>
    </div>,
    document.body,
  );
}

function Field({ label, value, onChange, type = "text", error }: { label: string; value: string; onChange: (value: string) => void; type?: string; error?: string | undefined; }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} className={`mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary ${error ? "border-destructive" : "border-input"}`} />
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

