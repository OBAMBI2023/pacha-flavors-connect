import type { ReactNode } from "react";
import {
  AlarmClock,
  AlertTriangle,
  Banknote,
  Bike,
  CalendarClock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  ShoppingBag,
  Store,
  UserRound,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Order, OrderStatus } from "@/lib/orders-db";
import type { DispatchProposalWithDriver } from "@/lib/delivery";
import { formatMoney } from "@/lib/currency";
import {
  STATUS_BADGE_CLASS,
  STATUS_LABELS,
  deliveryAddressLine,
  elapsedLabel,
  fulfillmentLabel,
  googleMapsUrl,
  nextActions,
  telUrl,
  whatsappUrl,
} from "./orderStatusMeta";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_BADGE_CLASS, PAYMENT_STATUS_LABELS } from "./paymentStatusMeta";
import { OrderPrepCountdown } from "./OrderPrepCountdown";

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

/** Compact "label / value" cell for the 3-column metadata row -- identical shape for prep time, mode, and payment so the row always reads as one aligned unit. */
function MetaCell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof AlarmClock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-muted/30 px-2.5 py-2">
      <span className="flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {label}
      </span>
      <span className="truncate text-xs font-semibold text-foreground">{children}</span>
    </div>
  );
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
  const addressLine = deliveryAddressLine(order);
  const hasCoords = order.delivery_latitude !== null && order.delivery_longitude !== null;

  return (
    <article
      className={`flex flex-col gap-2.5 rounded-2xl border bg-card p-3.5 shadow-sm transition-colors ${
        isNew ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <button type="button" onClick={() => onOpenDetail(order)} className="flex items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold leading-tight">Commande #{order.order_number}</p>
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

      {order.scheduled_for && (
        <p className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-sm font-semibold text-violet-700">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          Commande programmée ·{" "}
          {new Date(order.scheduled_for).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}

      {/* Client -- avatar + name/phone on the left, contact actions on the right, one row. */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            <span className="truncate">{order.customer_name}</span>
            {order.is_for_someone_else && (
              <span className="shrink-0 truncate rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                Pour {order.recipient_name}
              </span>
            )}
          </p>
          {order.customer_phone && <p className="truncate text-xs text-muted-foreground">{order.customer_phone}</p>}
        </div>
        {order.customer_phone && (
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={whatsappUrl(order.customer_phone)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Contacter sur WhatsApp"
              className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a
              href={telUrl(order.customer_phone)}
              aria-label="Appeler le client"
              className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-accent"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => onOpenDetail(order)}
              aria-label="Plus d'options"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-accent"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {(dispatch || driverStep || order.cutlery_requested || order.allergy_information) && (
        <div className="space-y-1 text-xs">
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
          {order.cutlery_requested && (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <Utensils className="h-3.5 w-3.5 shrink-0" /> Couverts demandés
            </p>
          )}
          {order.allergy_information && (
            <p className="flex items-center gap-1.5 font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Allergie signalée
            </p>
          )}
        </div>
      )}

      {order.fulfillment_type === "delivery" && (
        <div className="rounded-xl border border-border bg-muted/40 p-2.5 text-xs">
          <p className="flex items-center gap-1 font-semibold uppercase tracking-wide text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" /> Adresse de livraison
          </p>
          {addressLine ? (
            <p className="mt-1 text-sm text-foreground">{addressLine}</p>
          ) : hasCoords ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {order.delivery_latitude!.toFixed(5)}, {order.delivery_longitude!.toFixed(5)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-destructive">⚠️ Adresse de livraison non renseignée</p>
          )}
          {order.delivery_landmark && <p className="text-muted-foreground">Repère : {order.delivery_landmark}</p>}
          {hasCoords && (
            <a
              href={googleMapsUrl(order.delivery_latitude!, order.delivery_longitude!)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 font-semibold text-primary hover:bg-accent"
            >
              <MapPin className="h-3 w-3" /> Voir sur la carte
            </a>
          )}
        </div>
      )}

      <div className="space-y-1 border-t border-border pt-2.5">
        {order.items_summary && order.items_summary.length > 0 ? (
          <ul className="space-y-1.5">
            {order.items_summary.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {item.quantity} × {item.product_name_snapshot}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShoppingBag className="h-3.5 w-3.5" /> {order.item_count} article{order.item_count > 1 ? "s" : ""}
          </span>
        )}

        <div className="space-y-0.5 rounded-xl bg-muted/30 px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Sous-total plats</span>
            <span>{formatMoney(order.subtotal_amount, order.currency)}</span>
          </div>
          {order.delivery_fee_amount > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Frais de livraison</span>
              <span>{formatMoney(order.delivery_fee_amount, order.currency)}</span>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Remise</span>
              <span>-{formatMoney(order.discount_amount, order.currency)}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-1 text-sm font-bold text-foreground">
            <span>Total client</span>
            <span className="text-primary">{formatMoney(order.total_amount, order.currency)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MetaCell icon={AlarmClock} label="Préparation">
          {order.status === "preparing" && order.preparing_at && order.estimated_preparation_minutes !== null ? (
            <OrderPrepCountdown
              preparingAt={order.preparing_at}
              estimatedPreparationMinutes={order.estimated_preparation_minutes}
            />
          ) : order.estimated_preparation_minutes !== null ? (
            `${order.estimated_preparation_minutes} min`
          ) : (
            "Non renseigné"
          )}
        </MetaCell>
        <MetaCell icon={order.fulfillment_type === "delivery" ? Bike : Store} label="Mode">
          {fulfillmentLabel(order.fulfillment_type)}
        </MetaCell>
        <MetaCell icon={Banknote} label="Paiement">
          {PAYMENT_METHOD_LABELS[order.payment_method]}
        </MetaCell>
      </div>

      {order.payment_status === "cash_pending" && (
        <Button
          size="sm"
          variant="outline"
          className="h-11 w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
          disabled={busy}
          onClick={() => onMarkPaid(order)}
        >
          <Banknote className="mr-2 h-4 w-4" /> Marquer comme encaissée
        </Button>
      )}

      {order.fulfillment_type === "delivery" &&
        order.assigned_driver_id !== null &&
        order.status !== "delivered" &&
        order.status !== "cancelled" && (
          <Button size="sm" variant="outline" className="h-11 w-full" onClick={() => onTrack(order)}>
            <MapPin className="mr-2 h-4 w-4" /> Voir la position du livreur
          </Button>
        )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.nextStatus}
              size="sm"
              variant={action.variant === "destructive" ? "outline" : "default"}
              className={
                action.variant === "destructive"
                  ? "h-11 flex-1 border-destructive text-destructive hover:bg-destructive/10"
                  : "h-11 flex-1"
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
