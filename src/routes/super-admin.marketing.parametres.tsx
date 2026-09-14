import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { WhatsAppUnavailableBanner } from "@/components/superadmin/marketing/WhatsAppUnavailableBanner";

export const Route = createFileRoute("/super-admin/marketing/parametres")({
  ssr: false,
  component: MarketingSettingsPage,
});

/**
 * Deliberately read-only: every value below is a real, currently-fixed
 * constant in the code (src/lib/marketing.ts), not a saved setting. Building
 * editable inputs that don't actually change anything would be its own kind
 * of fake functionality -- this page documents the real current behavior
 * instead, until these are worth promoting to real per-restaurant settings.
 */
function MarketingSettingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Ces valeurs sont actuellement fixes dans le code -- pas encore des réglages modifiables par
        restaurant.
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">Anti-spam</h3>
        <p className="mt-1 text-sm text-slate-600">
          Un client déjà contacté par une campagne au cours des <strong>7 derniers jours</strong>{" "}
          est automatiquement exclu de toute nouvelle audience, pour tous les restaurants.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">Variables de message disponibles</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "{{prenom}}",
            "{{nom_restaurant}}",
            "{{code_promo}}",
            "{{montant_promo}}",
            "{{date_expiration}}",
            "{{derniere_commande}}",
            "{{montant_panier}}",
          ].map((v) => (
            <code key={v} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              {v}
            </code>
          ))}
        </div>
      </div>

      <WhatsAppUnavailableBanner />
    </div>
  );
}
