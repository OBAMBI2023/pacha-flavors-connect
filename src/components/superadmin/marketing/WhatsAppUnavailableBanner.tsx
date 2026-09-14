import { AlertTriangle, MessageCircle } from "lucide-react";

/**
 * The one honest state for every WhatsApp Business API metric (delivered/read
 * statuses, templates, provider) anywhere in this module -- there is no real
 * integration anywhere in this codebase (src/lib/whatsapp.ts only builds
 * click-to-chat wa.me/api.whatsapp.com links). Never replace this with a
 * simulated status.
 */
export function WhatsAppUnavailableBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Non disponible — API WhatsApp Business non connectée
      </p>
    );
  }
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-amber-900">API WhatsApp Business non connectée</p>
          <p className="mt-0.5 text-sm text-amber-800">
            Statuts livré/lu, réponses, templates et coût par message nécessitent une intégration
            WhatsApp Business -- aucune n'est branchée sur ce projet aujourd'hui, ces données
            n'apparaissent donc pas.
          </p>
        </div>
      </div>
    </div>
  );
}
