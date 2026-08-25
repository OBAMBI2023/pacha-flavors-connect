import { useState } from "react";
import { BellOff } from "lucide-react";
import { SecondaryScreenHeader } from "@/components/driver/SecondaryScreenHeader";

const CATEGORIES = ["Toutes", "Courses", "Système", "Paiements"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * No table/RPC gives a driver a readable notification feed today
 * (`notifications` is restaurant-staff-only via RLS, `client_notifications`
 * is customer-only). The reference mockup's four-tab layout is reproduced
 * for visual parity, but every tab renders the same honest empty state --
 * splitting an empty list into categories would only fabricate the
 * impression that categorized data exists.
 */
export function NotificationsTab({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState<Category>("Toutes");

  return (
    <>
      <SecondaryScreenHeader title="Notifications" onBack={onBack} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              category === c ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border bg-card py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
          <BellOff className="h-6 w-6" />
        </span>
        <p className="text-sm text-muted-foreground">Aucune notification pour le moment.</p>
        <p className="text-xs text-muted-foreground/70">Les nouvelles courses vous alertent directement sur l'accueil.</p>
      </div>
    </>
  );
}
