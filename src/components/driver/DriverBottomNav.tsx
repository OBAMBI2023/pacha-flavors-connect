import { Home, MessageCircle, Package, User } from "lucide-react";

export type DriverTab = "accueil" | "courses" | "messages" | "profil" | "gains" | "notifications" | "readiness";

/** Only these four are persistent bottom-tab destinations (matches the SAOVIA reference: Accueil/Courses/Messages/Profil). Gains, Notifications and "Avant de commencer" are reached via secondary entry points (header icons, Accueil/Profil links) and pushed as full screens -- see livreur.tsx's SECONDARY_TABS handling. */
const TABS: Array<{ key: DriverTab; label: string; icon: typeof Home }> = [
  { key: "accueil", label: "Accueil", icon: Home },
  { key: "courses", label: "Courses", icon: Package },
  { key: "messages", label: "Messages", icon: MessageCircle },
  { key: "profil", label: "Profil", icon: User },
];

/** Mirrors TenantBottomNav's construction (fixed, rounded-t, safe-area padding) so the driver app reads as the same product rather than a different nav pattern bolted on. Local tab state, not router navigation -- livreur.tsx already centralizes realtime subscriptions/hooks in one component tree, splitting into separate routed pages would duplicate that state for no real benefit. */
export function DriverBottomNav({ active, onChange }: { active: DriverTab; onChange: (tab: DriverTab) => void }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
      style={{ height: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex h-[76px] max-w-lg items-center">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${isActive ? "font-bold text-primary" : "font-medium text-muted-foreground"}`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${isActive ? "bg-primary/10" : ""}`}>
                <Icon className="h-5 w-5" />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
