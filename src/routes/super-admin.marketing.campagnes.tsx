import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/currency";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  cancelCampaign,
  fetchCampaign,
  fetchCampaignAttribution,
  fetchCampaignRecipients,
  fetchCampaigns,
  markCampaignSent,
  markRecipientSent,
  type Campaign,
  type CampaignAttribution,
  type CampaignRecipient,
  type CampaignStatus,
} from "@/lib/marketing";
import { useMarketingContext } from "@/hooks/useMarketingContext";

const STATUS_BADGE_CLASS: Record<CampaignStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  sending: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  failed: "bg-destructive/10 text-destructive",
};

function CampaignDetailSheet({ campaignId, onClose, onChanged }: { campaignId: string | null; onClose: () => void; onChanged: () => void }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [attribution, setAttribution] = useState<CampaignAttribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [c, r] = await Promise.all([fetchCampaign(campaignId), fetchCampaignRecipients(campaignId)]);
      setCampaign(c);
      setRecipients(r);
      setAttribution(c ? await fetchCampaignAttribution(c) : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger cette campagne.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function handleMarkSent(recipientId: string) {
    setBusy(true);
    try {
      await markRecipientSent(recipientId);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish() {
    if (!campaign) return;
    setBusy(true);
    try {
      await markCampaignSent(campaign.id);
      toast.success("Campagne marquée comme terminée");
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!campaign) return;
    setBusy(true);
    try {
      await cancelCampaign(campaign.id);
      toast.success("Campagne annulée");
      await refresh();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  const sentCount = recipients.filter((r) => r.status === "sent").length;

  return (
    <Sheet open={Boolean(campaignId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {loading && !campaign ? (
          <p className="pt-6 text-sm text-muted-foreground">Chargement...</p>
        ) : campaign ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {campaign.name}
                <Badge className={STATUS_BADGE_CLASS[campaign.status]}>{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge>
              </SheetTitle>
              <SheetDescription>
                {CAMPAIGN_OBJECTIVE_LABELS[campaign.objective]} · {campaign.restaurant?.name}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Ciblés</p>
                  <p className="mt-1 font-display text-xl font-semibold">{recipients.length}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Envoyés</p>
                  <p className="mt-1 font-display text-xl font-semibold">{sentCount}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase text-muted-foreground">Commandes</p>
                  <p className="mt-1 font-display text-xl font-semibold">{attribution?.ordersGenerated ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[0.65rem] font-medium uppercase text-muted-foreground">CA généré</p>
                  <p className="mt-1 font-display text-lg font-semibold">{formatMoney(attribution?.revenueGenerated ?? 0, "XOF")}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Message</p>
                <p className="mt-1 whitespace-pre-wrap">{campaign.message_template}</p>
              </div>

              {campaign.status !== "cancelled" && campaign.status !== "completed" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleFinish()} disabled={busy}>
                    <Send className="mr-1.5 h-3.5 w-3.5" /> Marquer la campagne comme terminée
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleCancel()} disabled={busy}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Annuler la campagne
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="font-semibold">Destinataires ({recipients.length})</h3>
                <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {recipients.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.name_snapshot}</p>
                        <p className="truncate text-xs text-muted-foreground">{r.phone_snapshot}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {r.status === "sent" ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Envoyé</Badge>
                        ) : (
                          <>
                            <a
                              href={r.wa_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Ouvrir WhatsApp
                            </a>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleMarkSent(r.id)}>
                              Marquer envoyé
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        ) : (
          <p className="pt-6 text-sm text-destructive">Campagne introuvable.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MarketingCampaignsPage() {
  const { restaurantId } = useMarketingContext();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [attributions, setAttributions] = useState<Record<string, CampaignAttribution>>({});
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  async function refresh() {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const rows = await fetchCampaigns(restaurantId);
      setCampaigns(rows);
      const entries = await Promise.all(rows.map(async (c) => [c.id, await fetchCampaignAttribution(c)] as const));
      setAttributions(Object.fromEntries(entries));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les campagnes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  if (!restaurantId) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}</p>
        <Link
          to="/super-admin/marketing/campagnes/nouvelle"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          Créer une campagne
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-12 text-center text-sm text-slate-500">
          Aucune campagne pour ce restaurant pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Campagne</th>
                <th className="px-4 py-3">Objectif</th>
                <th className="px-4 py-3">Ciblés</th>
                <th className="px-4 py-3">Commandes</th>
                <th className="px-4 py-3">CA généré</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{CAMPAIGN_OBJECTIVE_LABELS[c.objective]}</td>
                  <td className="px-4 py-3 text-slate-600">{c.recipient_count}</td>
                  <td className="px-4 py-3 text-slate-600">{attributions[c.id]?.ordersGenerated ?? 0}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMoney(attributions[c.id]?.revenueGenerated ?? 0, "XOF")}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_BADGE_CLASS[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDetailId(c.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Voir <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CampaignDetailSheet campaignId={detailId} onClose={() => setDetailId(null)} onChanged={() => void refresh()} />
    </div>
  );
}

export const Route = createFileRoute("/super-admin/marketing/campagnes")({
  ssr: false,
  component: MarketingCampaignsPage,
});
