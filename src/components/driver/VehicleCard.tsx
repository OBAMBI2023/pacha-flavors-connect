import { Bike } from "lucide-react";

/**
 * `vehicles` RLS (vehicles_select_tenant_staff) only grants owner/manager/
 * staff of the restaurant -- there is no policy letting a driver read their
 * own vehicle row. Adding one is a real RLS change this task is explicitly
 * forbidden from making, so this card never queries `vehicles` at all; it
 * honestly points the driver to their restaurant instead of silently
 * showing nothing or fabricating vehicle details.
 */
export function VehicleCard() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Bike className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold">Mon véhicule</p>
        <p className="text-xs text-muted-foreground">Informations disponibles auprès de votre restaurant.</p>
      </div>
    </div>
  );
}
