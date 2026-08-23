import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function AccountLookupModal({
  restaurantName,
  onClose,
  onSubmit,
}: {
  restaurantName: string;
  onClose: () => void;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-3xl bg-card p-6 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Mes commandes</h2>
            <p className="mt-1 text-sm text-foreground/70">
              Entrez le numero utilise lors de votre commande chez {restaurantName} pour la retrouver.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (phone.trim()) onSubmit(phone.trim());
          }}
        >
          <input
            type="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Numero de telephone"
            className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={!phone.trim()}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Voir mes commandes
          </button>
        </form>
        <p className="mt-4 text-xs text-foreground/60">
          Pas encore commande ? Fermez cette fenetre et ajoutez un plat au panier pour passer votre premiere commande.
        </p>
      </div>
    </div>,
    document.body,
  );
}
