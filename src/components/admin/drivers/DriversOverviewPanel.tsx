import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchDriverFleetStats, type DriverFleetStats } from "@/lib/drivers";
import { AddDriverDialog } from "./AddDriverDialog";

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function DriversOverviewPanel({
  restaurantId,
  onNavigate,
}: {
  restaurantId: string;
  onNavigate: (tab: "livreurs" | "historique") => void;
}) {
  const [stats, setStats] = useState<DriverFleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const today = new Date();
      setStats(await fetchDriverFleetStats(today, today));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les statistiques.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>;

  const counts = stats?.driver_status_counts;
  const totals = stats?.period_totals;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Vue d'ensemble</h2>
        <p className="mt-1 text-sm text-muted-foreground">État de votre flotte de livreurs aujourd'hui.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Livreurs actifs" value={counts?.active ?? 0} />
        <Kpi label="Disponibles" value={counts?.available ?? 0} />
        <Kpi label="En livraison" value={counts?.on_delivery ?? 0} />
        <Kpi label="Hors ligne" value={counts?.offline ?? 0} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Livraisons aujourd'hui" value={totals?.total_deliveries ?? 0} />
        <Kpi label="Terminées" value={totals?.completed ?? 0} />
        <Kpi label="En cours" value={totals?.in_progress ?? 0} />
        <Kpi label="Annulées" value={totals?.cancelled ?? 0} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Kpi label="Temps moyen de livraison" value={totals?.avg_delivery_minutes != null ? `${totals.avg_delivery_minutes} min` : "—"} />
        <Kpi label="Taux de réussite" value={totals?.success_rate != null ? `${totals.success_rate}%` : "—"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAddOpen(true)}><Plus className="mr-2 h-4 w-4" />Ajouter un livreur</Button>
        <Button variant="outline" onClick={() => onNavigate("livreurs")}><Users className="mr-2 h-4 w-4" />Voir les livreurs disponibles</Button>
        <Button variant="outline" onClick={() => onNavigate("historique")}><Truck className="mr-2 h-4 w-4" />Voir les livraisons en cours</Button>
      </div>

      <AddDriverDialog restaurantId={restaurantId} open={addOpen} onClose={() => setAddOpen(false)} onCreated={refresh} />
    </div>
  );
}
