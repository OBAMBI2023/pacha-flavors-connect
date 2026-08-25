import { useState } from "react";
import { MapPin, Package, Phone } from "lucide-react";
import { DeliveryStepTimeline } from "@/components/driver/DeliveryStepTimeline";
import { DeliveryActionButton } from "@/components/driver/DeliveryActionButton";
import { CashCollectionSheet } from "@/components/driver/CashCollectionSheet";
import type { DriverActiveDelivery } from "@/lib/delivery";

/**
 * Extracted from livreur.tsx's previous inline block -- same fields, same
 * conditional rendering (nothing shown unless the underlying value is
 * non-null), same three child components (DeliveryStepTimeline/
 * DeliveryActionButton/CashCollectionSheet) driving the exact same existing
 * state machine and RPCs. Only the visual language changed.
 */
export function ActiveDeliveryCard({
  activeDelivery,
  onAdvanced,
}: {
  activeDelivery: DriverActiveDelivery;
  onAdvanced: () => void | Promise<void>;
}) {
  const [cashSheetOpen, setCashSheetOpen] = useState(false);

  return (
    <div className="space-y-4 rounded-3xl border border-primary/20 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">Course en cours</span>
        <p className="font-display text-2xl font-bold">
          {activeDelivery.total_amount.toLocaleString("fr-FR")} <span className="text-sm font-semibold text-muted-foreground">{activeDelivery.currency}</span>
        </p>
      </div>

      <div>
        <p className="font-display text-xl font-semibold">Commande #{activeDelivery.order_number}</p>
        <p className="text-sm text-muted-foreground">{activeDelivery.restaurant_name}</p>
      </div>

      <div className="space-y-2 border-t border-border pt-4 text-sm">
        {activeDelivery.is_for_someone_else && (
          <p className="inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">🎁 Livraison pour une autre personne</p>
        )}
        <p className="font-medium">{activeDelivery.is_for_someone_else ? activeDelivery.recipient_name : activeDelivery.customer_name}</p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {activeDelivery.is_for_someone_else ? activeDelivery.recipient_phone : activeDelivery.customer_phone}
        </p>
        {activeDelivery.delivery_address && (
          <p className="flex items-start gap-1.5 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {activeDelivery.delivery_address}
              {activeDelivery.delivery_neighborhood ? ` · ${activeDelivery.delivery_neighborhood}` : activeDelivery.delivery_commune ? ` · ${activeDelivery.delivery_commune}` : ""}
            </span>
          </p>
        )}
        {activeDelivery.delivery_landmark && (
          <p className="pl-5 text-xs text-muted-foreground">Point de repère : {activeDelivery.delivery_landmark}</p>
        )}
        {activeDelivery.delivery_distance_km !== null && (
          <p className="pl-5 text-xs text-muted-foreground">Distance : {activeDelivery.delivery_distance_km.toFixed(2)} km</p>
        )}
        {activeDelivery.allergy_information && (
          <p className="text-destructive">⚠️ Allergies : {activeDelivery.allergy_information}</p>
        )}
        {activeDelivery.delivery_instructions && (
          <p className="text-muted-foreground">Instructions : {activeDelivery.delivery_instructions}</p>
        )}
        {activeDelivery.driver_note && activeDelivery.driver_note !== activeDelivery.delivery_instructions && (
          <p className="text-muted-foreground">Consigne : {activeDelivery.driver_note}</p>
        )}
      </div>

      {activeDelivery.items.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
          {activeDelivery.items.map((item, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 shrink-0" />
              {item.quantity} × {item.product_name}
            </li>
          ))}
        </ul>
      )}

      <DeliveryStepTimeline
        status={activeDelivery.driver_delivery_status}
        isCashOrder={
          activeDelivery.payment_status === "cash_pending" ||
          activeDelivery.driver_delivery_status === "cash_collection" ||
          activeDelivery.driver_delivery_status === "payment_confirmed"
        }
      />
      <DeliveryActionButton activeDelivery={activeDelivery} onAdvanced={onAdvanced} onOpenCashCollection={() => setCashSheetOpen(true)} />
      <CashCollectionSheet open={cashSheetOpen} onOpenChange={setCashSheetOpen} activeDelivery={activeDelivery} onConfirmed={onAdvanced} />
    </div>
  );
}
