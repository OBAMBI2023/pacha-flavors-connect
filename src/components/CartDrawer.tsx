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
    commune: "",
    adresse: "",
    instructions: "",
  });
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const subtotalLabel = hasUnpriced
    ? subtotal > 0
      ? `${subtotal.toLocaleString("fr-FR")} FCFA + articles à confirmer`
      : "À confirmer avec le restaurant"
    : `${subtotal.toLocaleString("fr-FR")} FCFA`;

  function submit() {
    if (lines.length === 0) return;
    if (!form.nom.trim() || !form.telephone.trim()) {
      setError("Merci d'indiquer votre nom et votre téléphone.");
      return;
    }
    if (mode === "livraison" && (!form.commune.trim() || !form.adresse.trim())) {
      setError("Merci d'indiquer votre commune / quartier et votre adresse.");
      return;
    }
    setError("");

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
      mode === "livraison" ? "Livraison" : "À emporter",
      "",
      "CLIENT",
      `Nom : ${form.nom}`,
      `Téléphone : ${form.telephone}`,
      ...(mode === "livraison"
        ? [
            `Quartier : ${form.commune}`,
            `Adresse : ${form.adresse}`,
            `Instructions : ${form.instructions || "-"}`,
          ]
        : []),
      "",
      "Merci.",
    ].join("\n");

    window.open(whatsappUrl(message), "_blank", "noopener,noreferrer");
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
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
                <Field
                  label="Téléphone *"
                  type="tel"
                  value={form.telephone}
                  onChange={set("telephone")}
                />
                {mode === "livraison" && (
                  <>
                    <Field label="Commune / quartier *" value={form.commune} onChange={set("commune")} />
                    <Field label="Adresse / indication *" value={form.adresse} onChange={set("adresse")} />
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
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="text-right font-semibold">{subtotalLabel}</span>
            </div>
            {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
            <button
              onClick={submit}
              className="mt-3 w-full rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Commander sur WhatsApp
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