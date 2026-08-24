import { useState } from "react";
import { DriversOverviewPanel } from "./DriversOverviewPanel";
import { DriversListPanel } from "./DriversListPanel";
import { VehiclesPanel } from "./VehiclesPanel";
import { DocumentsPanel } from "./DocumentsPanel";
import { DriverStatsPanel } from "./DriverStatsPanel";
import { DeliveryHistoryPanel } from "./DeliveryHistoryPanel";

const SUB_TABS = [
  { value: "apercu", label: "Vue d'ensemble" },
  { value: "livreurs", label: "Livreurs" },
  { value: "vehicules", label: "Véhicules" },
  { value: "documents", label: "Documents" },
  { value: "statistiques", label: "Statistiques" },
  { value: "historique", label: "Historique" },
] as const;

type SubTab = (typeof SUB_TABS)[number]["value"];

export function DriversPanel({ restaurantId }: { restaurantId: string }) {
  const [tab, setTab] = useState<SubTab>("apercu");

  return (
    <div className="space-y-6">
      <div className="inline-flex flex-wrap rounded-full border border-border bg-muted p-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.value ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "apercu" && <DriversOverviewPanel restaurantId={restaurantId} onNavigate={(t) => setTab(t)} />}
      {tab === "livreurs" && <DriversListPanel restaurantId={restaurantId} />}
      {tab === "vehicules" && <VehiclesPanel restaurantId={restaurantId} />}
      {tab === "documents" && <DocumentsPanel restaurantId={restaurantId} />}
      {tab === "statistiques" && <DriverStatsPanel restaurantId={restaurantId} />}
      {tab === "historique" && <DeliveryHistoryPanel restaurantId={restaurantId} />}
    </div>
  );
}
