import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useMarketingContext } from "@/hooks/useMarketingContext";
import { RequireOneRestaurant } from "@/components/superadmin/marketing/RequireOneRestaurant";
import { WhatsAppUnavailableBanner } from "@/components/superadmin/marketing/WhatsAppUnavailableBanner";

export const Route = createFileRoute("/super-admin/marketing/whatsapp")({
  ssr: false,
  component: MarketingWhatsAppPage,
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function WhatsAppCenter({ restaurantId }: { restaurantId: string }) {
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("restaurants")
      .select("whatsapp_phone")
      .eq("id", restaurantId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setContactPhone((data?.whatsapp_phone as string | null) ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  return (
    <div className="space-y-4">
      <WhatsAppUnavailableBanner />

      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">Numéro de contact (liens click-to-chat)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Utilisé pour les liens "Ouvrir WhatsApp" (campagnes, fiche client) -- distinct d'une
          intégration WhatsApp Business API, qui n'existe pas encore.
        </p>
        <div className="mt-3">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : contactPhone ? (
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Phone className="h-4 w-4 text-slate-400" /> {contactPhone}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Aucun numéro configuré pour ce restaurant.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">Intégration WhatsApp Business</h3>
        <div className="mt-2">
          <InfoRow label="Statut API" value="Non disponible" />
          <InfoRow label="Numéro Business connecté" value="Non disponible" />
          <InfoRow label="Provider" value="Non disponible" />
          <InfoRow label="Templates approuvés" value="Non disponible" />
          <InfoRow label="Messages via API" value="Non disponible" />
        </div>
        <Button
          className="mt-4"
          disabled
          title="Fonctionnalité à venir -- nécessite une intégration WhatsApp Business réelle"
        >
          <MessageCircle className="mr-2 h-4 w-4" /> Configurer WhatsApp
        </Button>
      </div>
    </div>
  );
}

function MarketingWhatsAppPage() {
  const { restaurantId } = useMarketingContext();
  return (
    <RequireOneRestaurant restaurantId={restaurantId}>
      {restaurantId && restaurantId !== "all" && <WhatsAppCenter restaurantId={restaurantId} />}
    </RequireOneRestaurant>
  );
}
