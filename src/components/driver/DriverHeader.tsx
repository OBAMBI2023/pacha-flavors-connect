import { Bell, Wallet } from "lucide-react";
import { AvailabilityToggle } from "@/components/driver/AvailabilityToggle";
import type { DriverProfile } from "@/lib/delivery";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** photo_path exists on driver_profiles (Phase 1 extra fields) but there's no signed-URL/public-URL wiring for it anywhere in this app yet -- rendering it here would require a new storage-read path this task doesn't touch, so this stays an initials avatar until that exists. */
export function DriverHeader({
  driver,
  available,
  togglingAvailability,
  onToggleAvailability,
  onOpenNotifications,
  onOpenGains,
}: {
  driver: DriverProfile;
  available: boolean;
  togglingAvailability: boolean;
  onToggleAvailability: () => void;
  onOpenNotifications: () => void;
  onOpenGains: () => void;
}) {
  const firstName = driver.full_name.trim().split(/\s+/)[0] ?? driver.full_name;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {initials(driver.full_name)}
            {available && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-[#22A447]" />}
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-primary">SAOVIA Partenaire</p>
            <h1 className="font-display text-xl font-semibold leading-tight">Bonjour, {firstName}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Mes gains"
            onClick={onOpenGains}
            className="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-sm"
          >
            <Wallet className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            onClick={onOpenNotifications}
            className="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-sm"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
      <AvailabilityToggle available={available} busy={togglingAvailability} onToggle={onToggleAvailability} />
    </div>
  );
}
