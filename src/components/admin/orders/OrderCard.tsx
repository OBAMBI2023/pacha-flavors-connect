import { Banknote, Bike, MapPin, Phone, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order, OrderStatus } from "@/lib/orders-db";
import type { DispatchProposalWithDriver } from "@/lib/delivery";
import { STATUS_BADGE_CLASS, STATUS_LABELS, elapsedLabel, fulfillmentLabel, nextActions } from "./orderStatusMeta";
import { PAYMENT_STATUS_BADGE_CLASS, PAYMENT_STATUS_LABELS } from "./paymentStatusMeta";

function dispatchLabel(order: Order, proposal: DispatchProposalWithDriver | undefined): string | null {
  if (order.fulfillment_type !== "delivery") return null;
  switch (order.delivery_dispatch_status) {
    case "searching":
      return proposal?.status === "pending"
        ? `Livreur proposé : ${proposal.driver_name}${proposal.distance_km !== null ? ` (~${proposal.distance_km.toFixed(1)} km)` : ""}`
        : "Recherche d'un livreur...";
    case "no_driver_available":
      return "Aucun livreur disponible -- recherche en cours";
    case "assigned":
      return proposal?.driver_name ? `Livreur assigné : ${proposal.driver_name}` : "Livreur assigné";
    default:
      return null;
  }
}

/**
 * Only the tenant-visible subset of driver_delivery_status -- 'assigned' is
 * already covered by dispatchLabel above, 'delivered' by the status badge;
 * going_to_pickup/collecting/cash_collection aren't on the requested list.
 */
function driverStepLabel(order: Order): string | null {
  if (order.fulfillment_type !== "delivery") return null;
  switch (order.driver_delivery_status) {
    case "arrived_at_restaurant":
      return "Livreur arrivé au restaurant";
    case "collected":
      return "Commande récupérée par le livreur";
    case "en_route":
      return "Livreur en route";
    case "arrived_at_customer":
      return "Livreur arrivé chez le client";
    case "payment_confirmed":
      return "Paiement confirmé (livreur)";
    default:
      return null;
  }
}

export function OrderCard({
  order,
  isNew,
  busy,
  dispatchProposal,
  onOpenDetail,
  onAdvance,
  onReject,
  onMarkPaid,
  onTrack,
}: {
  order: Order;
  isNew: boolean;
  busy: boolean;
  dispatchProposal?: DispatchProposalWithDriver | undefined;
  onOpenDetail: (order: Order) => void;
  onAdvance: (order: Order, nextStatus: OrderStatus) => void;
  onReject: (order: Order) => void;
  onMarkPaid: (order: Order) => void;
  onTrack: (order: Order) => void;
}) {
  const dispatch = dispatchLabel(order, dispatchProposal);
  const driverStep = driverStepLabel(order);
  const actions = nextActions(order);
  const time = new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm transition-colors ${
        isNew ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <button type="button" onClick={() => onOpenDetail(order)} className="flex items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">Commande #{order.order_number}</p>
          <p className="text-xs text-muted-foreground">
            {time} · il y a {elapsedLabel(order.created_at)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge className={STATUS_BADGE_CLASS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
          <Badge variant="outline" className={PAYMENT_STATUS_BADGE_CLASS[order.payment_status]}>
            {PAYMENT_STATUS_LABELS[order.payment_status]}
          </Badge>
        </div>
      </button>

      <div className="space-y-1 text-sm">
        <p className="truncate font-medium">{order.customer_name}</p>
        {order.customer_phone && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {order.customer_phone}
          </p>
        )}
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {fulfillmentLabel(order.fulfillment_type)}
        </p>
        {dispatch && (
          <p className="flex items-center gap-1.5 text-primary">
            <Bike className="h-3.5 w-3.5 shrink-0" /> {dispatch}
          </p>
        )}
        {driverStep && (
          <p className="flex items-center gap-1.5 text-primary">
            <Bike className="h-3.5 w-3.5 shrink-0" /> {driverStep}
          </p>
        )}
      </div>

      <div className="space-y-1.5 border-t border-border pt-3 text-sm">
        {order.items_summary && order.items_summary.length > 0 ? (
          <ul className="space-y-1">
            {order.items_summary.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5 text-muted-foreground">
                <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {item.quantity} × {item.product_name_snapshot}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" /> {order.item_count} article{order.item_count > 1 ? "s" : ""}
          </span>
        )}
        <div className="flex items-center justify-end">
          <span className="font-display text-base font-semibold">
            {order.total_amount.toLocaleString("fr-FR")} {order.currency}
          </span>
        </div>
      </div>

      {order.payment_status === "cash_pending" && (
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-11 w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            disabled={busy}
            onClick={() => onMarkPaid(order)}
          >
            <Banknote className="mr-2 h-4 w-4" /> Marquer comme encaissée
          </Button>
        </div>
      )}

      {order.fulfillment_type === "delivery" &&
        order.assigned_driver_id !== null &&
        order.status !== "delivered" &&
        order.status !== "cancelled" && (
          <div className="pt-1">
            <Button size="sm" variant="outline" className="h-11 w-full" onClick={() => onTrack(order)}>
              <MapPin className="mr-2 h-4 w-4" /> Voir la position du livreur
            </Button>
          </div>
        )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.map((action) => (
            <Button
              key={action.nextStatus}
              size="sm"
              variant={action.variant === "destructive" ? "outline" : "default"}
              className={
                action.variant === "destructive"
                  ? "h-11 border-destructive text-destructive hover:bg-destructive/10"
                  : "h-11"
              }
              disabled={busy}
              onClick={() => (action.nextStatus === "cancelled" ? onReject(order) : onAdvance(order, action.nextStatus))}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </article>
  );
}
