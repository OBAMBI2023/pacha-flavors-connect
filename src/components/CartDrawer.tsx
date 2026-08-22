import { useState } from "react";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/data/menu";
import { whatsappUrl } from "@/data/site";

type Mode = "livraison" | "emporter";

export function CartDrawer() {
  const { lines, count, subtotal, hasUnpriced, isOpen, closeCart, increment, decrement, remove, clear } =
    useCart();
  const [mode, setMode] = useState<Mode>("livraison");
  const [form, setForm] = useState({
    nom: "",
    telephone: "",
    adresse: "",
    instructions: "",
  });
  const [fieldErrors, setFieldErrors] = useState<{ nom?: string; telephone?: string; adresse?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotalLabel = hasUnpriced
    ? subtotal > 0
      ? `${subtotal.toLocaleString("fr-FR")} FCFA + articles à confirmer`
      : "À confirmer avec le restaurant"
    : `${subtotal.toLocaleString("fr-FR")} FCFA`;

  const ctaTotalLabel = hasUnpriced && subtotal <= 0 ? "" : ` • ${subtotal.toLocaleString("fr-FR")} FCFA`;

  function submit() {
    if (lines.length === 0 || submitting) return;

    const errors: typeof fieldErrors = {};
    if (!form.nom.trim()) errors.nom = "Merci d'indiquer votre nom.";
    if (!form.telephone.trim()) errors.telephone = "Merci d'indiquer votre téléphone.";
    if (mode === "livraison" && !form.adresse.trim()) errors.adresse = "Merci d'indiquer votre adresse.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    const items = lines
      .map((l) => `${l.qty} × ${l.item.name}${l.item.subtitle ? ` (${l.item.subtitle})` : ""}`)
      .join("\n");

    const message = [
      "Bonjour LE PACHA",
      "Je souhaite passer une commande.",
      "",
      "COMMANDE",
      items,
      "",
      `Sous-total : ${subtotalLabel}`,
      "",
      "MODE",
      mode === "livraison" ? "Livraison" : "Retrait sur place",
      "",
      "CLIENT",
      `Nom : ${form.nom}`,
      `Téléphone : ${form.telephone}`,
      ...(mode === "livraison"
        ? [
            `Adresse : ${form.adresse}`,
            `Instructions : ${form.instructions || "-"}`,
          ]
        : []),
      "",
      "Merci.",
    ].join("\n");

    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
    window.setTimeout(() => setSubmitting(false), 1000);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        className="absolute inset-0 bg-cocoa/50 backdrop-blur-sm"
        onClick={closeCart}
        aria-hidden
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-background shadow-2xl">
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
                          className="grid h-11 w-11 place-items-center rounded-full border border-border"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                        <button
                          onClick={() => increment(l.item.id)}
                          aria-label="Augmenter"
                          className="grid h-11 w-11 place-items-center rounded-full border border-border"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(l.item.id)}
                          aria-label="Supprimer"
                          className="ml-auto grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-accent"
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
                      {m === "livraison" ? "Livraison" : "Retrait sur place"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <Field
                  label="Nom *"
                  value={form.nom}
                  onChange={set("nom")}
                  error={fieldErrors.nom}
                />
                <Field
                  label="Téléphone *"
                  type="tel"
                  value={form.telephone}
                  onChange={set("telephone")}
                  error={fieldErrors.telephone}
                />
                {mode === "livraison" && (
                  <>
                    <Field
                      label="Adresse / indication *"
                      value={form.adresse}
                      onChange={set("adresse")}
                      error={fieldErrors.adresse}
                    />
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        Instructions de livraison
                      </span>
                      <textarea
                        rows={3}
                        value={form.instructions}
                        onChange={set("instructions")}
                        className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                    </label>
                    <p className="rounded-xl bg-accent/60 p-3 text-xs leading-relaxed text-accent-foreground">
                      Les frais de livraison peuvent varier selon votre zone. Le restaurant vous
                      confirmera le montant.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {lines.length > 0 && (
          <div className="sticky bottom-0 border-t border-border bg-background px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="text-right font-semibold">{subtotalLabel}</span>
            </div>
            <button
              onClick={submit}
              disabled={submitting}
              className="mt-3 flex h-[54px] w-full items-center justify-center rounded-2xl bg-primary px-6 text-base font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Envoi en cours..." : `Commander${ctaTotalLabel}`}
            </button>
          </div>
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
  error,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  error?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        className={`mt-1 w-full rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary ${
          error ? "border-destructive" : "border-input"
        }`}
      />
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}