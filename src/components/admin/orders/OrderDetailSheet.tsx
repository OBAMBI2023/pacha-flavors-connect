import { useEffect, useState } from "react";
import { Banknote, CalendarClock, Copy, MapPin, Printer, Share2, Truck, Undo2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DbRestaurant } from "@/lib/menu-db";
import { fetchOrderDetail, type Order, type OrderDetail, type OrderStatus } from "@/lib/orders-db";
import { DRIVER_STATUS_BUCKET_CLASSNAMES, DRIVER_STATUS_BUCKET_LABELS, driverStatusBucket, fetchDriver, type Driver } from "@/lib/drivers";
import { formatMoney as money } from "@/lib/currency";
import { STATUS_BADGE_CLASS, STATUS_LABELS, buildDeliveryDetailsText, deliveryAddressLine, fulfillmentLabel, googleMapsUrl, nextActions } from "./orderStatusMeta";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_BADGE_CLASS, PAYMENT_STATUS_LABELS } from "./paymentStatusMeta";
import { OrderPrintTicket } from "./OrderPrintTicket";

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Impossible de copier -- copiez manuellement.");
  }
}

export function OrderDetailSheet({
  orderId,
  restaurant,
  busy,
  onClose,
  onAdvance,
  onReject,
  onMarkPaid,
  onRefund,
  onAssign,
}: {
  orderId: string | null;
  restaurant: DbRestaurant | null;
  busy: boolean;
  onClose: () => void;
  onAdvance: (order: Order, nextStatus: OrderStatus) => void;
  onReject: (order: Order) => void;
  onMarkPaid: (order: Order) => void;
  onRefund: (order: Order) => void;
  onAssign: (order: Order) => void;
}) {
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);

  useEffect(() => {
    if (!orderId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchOrderDetail(orderId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger la commande.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  useEffect(() => {
    if (!detail?.assigned_driver_id) {
      setAssignedDriver(null);
      return;
    }
    let cancelled = false;
    fetchDriver(detail.assigned_driver_id).then((d) => { if (!cancelled) setAssignedDriver(d); });
    return () => { cancelled = true; };
  }, [detail?.assigned_driver_id]);

  const actions = detail ? nextActions(detail) : [];

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "h-[92vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-lg"}
      >
        {loading && (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {error && <p className="pt-6 text-sm text-destructive">{error}</p>}
        {detail && (
          <>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle>Commande #{detail.order_number}</SheetTitle>
                <Badge className={STATUS_BADGE_CLASS[detail.status]}>{STATUS_LABELS[detail.status]}</Badge>
                <Badge variant="outline" className={PAYMENT_STATUS_BADGE_CLASS[detail.payment_status]}>
                  {PAYMENT_STATUS_LABELS[detail.payment_status]}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto h-8"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimer le ticket
                </Button>
              </div>
              <SheetDescription>
                {new Date(detail.created_at).toLocaleString("fr-FR")}
              </SheetDescription>
              {detail.scheduled_for && (
                <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-sm font-semibold text-violet-700">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  Commande programmée · {new Date(detail.scheduled_for).toLocaleString("fr-FR")}
                </p>
              )}
            </SheetHeader>

            <div className="mt-5 space-y-6 text-sm">
              <section className="space-y-1.5 rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Client</h3>
                <p>{detail.customer_name}</p>
                <p className="text-muted-foreground">{detail.customer_phone}</p>
                <p className="text-muted-foreground">{fulfillmentLabel(detail.fulfillment_type)}</p>
                {detail.estimated_preparation_minutes !== null && (
                  <p className="text-muted-foreground">Préparation estimée : ⏱️ {detail.estimated_preparation_minutes} min</p>
                )}
                {detail.customer_notes && <p className="text-muted-foreground">Notes client : {detail.customer_notes}</p>}
                <p className={detail.allergy_information ? "text-destructive" : "text-muted-foreground"}>
                  {detail.allergy_information ? `⚠️ Allergies : ${detail.allergy_information}` : "Allergies : aucune signalée"}
                </p>
                <p className="text-muted-foreground">Couverts : {detail.cutlery_requested ? "OUI" : "NON"}</p>
              </section>

              {detail.is_for_someone_else && (
                <section className="space-y-1.5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <h3 className="font-semibold">🎁 Commande pour quelqu'un d'autre</h3>
                  <p>{detail.recipient_name}</p>
                  {detail.recipient_phone && <p className="text-muted-foreground">{detail.recipient_phone}</p>}
                  {detail.customer_profile_address && (
                    <p className="text-xs text-muted-foreground">Adresse habituelle du client : {detail.customer_profile_address}</p>
                  )}
                  {detail.recipient_additional_info && (
                    <p className="text-muted-foreground">Informations complémentaires : {detail.recipient_additional_info}</p>
                  )}
                </section>
              )}

              {detail.fulfillment_type === "delivery" && (
                <section className="space-y-2 rounded-2xl border border-border p-4">
                  <h3 className="font-semibold">📍 Position de livraison</h3>
                  {(() => {
                    const addressLine = deliveryAddressLine(detail);
                    const hasCoordinates = detail.delivery_latitude !== null && detail.delivery_longitude !== null;
                    if (!addressLine && !hasCoordinates) {
                      return <p className="text-destructive">⚠️ Adresse de livraison non renseignée</p>;
                    }
                    return (
                      <>
                        <p>{addressLine ?? "Adresse non disponible"}</p>
                        {detail.delivery_landmark && (
                          <p className="text-muted-foreground">Point de repère : {detail.delivery_landmark}</p>
                        )}
                        {hasCoordinates && (
                          <p className="text-xs text-muted-foreground">
                            GPS : {detail.delivery_latitude!.toFixed(5)}, {detail.delivery_longitude!.toFixed(5)}
                          </p>
                        )}
                      </>
                    );
                  })()}
                  {detail.delivery_instructions && (
                    <p className="text-muted-foreground">Instructions : {detail.delivery_instructions}</p>
                  )}
                  {detail.driver_note && detail.driver_note !== detail.delivery_instructions && (
                    <p className="text-muted-foreground">Consigne au livreur : {detail.driver_note}</p>
                  )}
                  {detail.delivery_distance_km !== null && (
                    <p className="text-xs text-muted-foreground">
                      Distance : {detail.delivery_distance_km.toFixed(2)} km
                      {detail.delivery_fee_calculation_method === "fallback" && " (tarif forfaitaire, position non déterminée)"}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {detail.delivery_latitude !== null && detail.delivery_longitude !== null && (
                      <>
                        <a
                          href={googleMapsUrl(detail.delivery_latitude, detail.delivery_longitude)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-accent"
                        >
                          <MapPin className="h-3.5 w-3.5" /> Ouvrir dans Google Maps
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyText(`${detail.delivery_latitude},${detail.delivery_longitude}`, "Coordonnées copiées")}
                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-accent"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copier les coordonnées
                        </button>
                      </>
                    )}
                    {deliveryAddressLine(detail) && (
                      <button
                        type="button"
                        onClick={() => void copyText(deliveryAddressLine(detail) ?? "", "Adresse copiée")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-accent"
                      >
                        <Copy className="h-3.5 w-3.5" /> Copier l'adresse
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyText(buildDeliveryDetailsText(detail), "Informations de livraison copiées")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-accent"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copier les informations de livraison
                    </button>
                    {typeof navigator !== "undefined" && "share" in navigator && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.share({ text: buildDeliveryDetailsText(detail) }).catch(() => {
                            // User cancelled the share sheet -- not an error worth surfacing.
                          });
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-accent"
                      >
                        <Share2 className="h-3.5 w-3.5" /> Partager
                      </button>
                    )}
                  </div>
                </section>
              )}

              {detail.fulfillment_type === "delivery" && detail.status !== "cancelled" && (
                <section className="space-y-2 rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">🚴 Livreur</h3>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => onAssign(detail)}>
                      <UserRoundCog className="mr-1.5 h-3.5 w-3.5" />
                      {assignedDriver ? "Changer" : "Assigner un livreur"}
                    </Button>
                  </div>
                  {assignedDriver ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{assignedDriver.full_name}</span>
                        <Badge className={DRIVER_STATUS_BUCKET_CLASSNAMES[driverStatusBucket(assignedDriver.status)]}>
                          {DRIVER_STATUS_BUCKET_LABELS[driverStatusBucket(assignedDriver.status)]}
                        </Badge>
                      </div>
                      {detail.pickup_code && (
                        <div className="space-y-1 border-t border-border pt-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Code de collecte</span>
                            <span className="font-mono text-base font-semibold tracking-widest">{detail.pickup_code}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Statut de collecte</span>
                            <span className={detail.pickup_code_verified_at ? "font-medium text-emerald-700" : "text-muted-foreground"}>
                              {detail.pickup_code_verified_at ? "✅ Collecté" : "En attente"}
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Aucun livreur assigné pour le moment.</p>
                  )}
                </section>
              )}

              <section className="space-y-3">
                <h3 className="font-semibold">Produits</h3>
                <ul className="space-y-3">
                  {detail.items.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium">
                          {item.quantity} × {item.product_name_snapshot}
                        </p>
                        <p className="shrink-0 font-medium">{money(item.line_total, detail.currency)}</p>
                      </div>
                      {item.options.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          {item.options.map((opt) => (
                            <li key={opt.id}>
                              {opt.option_group_name_snapshot} : {opt.option_name_snapshot}
                              {opt.extra_price_snapshot > 0 ? ` (+${money(opt.extra_price_snapshot, detail.currency)})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.item_notes && (
                        <p className="mt-1.5 text-xs italic text-muted-foreground">Note : {item.item_notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-1.5 rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sous-total des plats</span>
                  <span>{money(detail.subtotal_amount, detail.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Frais de livraison</span>
                  <span>{money(detail.delivery_fee_amount, detail.currency)}</span>
                </div>
                {detail.discount_amount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span>Réduction</span>
                    <span>-{money(detail.discount_amount, detail.currency)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                  <span>TOTAL À PAYER</span>
                  <span>{money(detail.total_amount, detail.currency)}</span>
                </div>
              </section>

              <section className="space-y-2.5 rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Paiement</h3>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Méthode</span>
                  <span>{PAYMENT_METHOD_LABELS[detail.payment_method]}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge variant="outline" className={PAYMENT_STATUS_BADGE_CLASS[detail.payment_status]}>
                    {PAYMENT_STATUS_LABELS[detail.payment_status]}
                  </Badge>
                </div>
                {detail.payment_status === "cash_pending" && (
                  <Button
                    className="h-11 w-full border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onMarkPaid(detail)}
                  >
                    <Banknote className="mr-2 h-4 w-4" /> Marquer comme encaissée
                  </Button>
                )}
                {(detail.payment_status === "paid" || detail.payment_status === "partially_refunded") && (
                  <Button className="h-11 w-full" variant="outline" disabled={busy} onClick={() => onRefund(detail)}>
                    <Undo2 className="mr-2 h-4 w-4" /> Rembourser
                  </Button>
                )}
              </section>

              {detail.cancel_reason && (
                <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4">
                  <h3 className="font-semibold text-destructive">Motif d'annulation</h3>
                  <p className="mt-1 text-muted-foreground">{detail.cancel_reason}</p>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="font-semibold">Historique</h3>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {detail.history.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3">
                      <span>
                        {entry.from_status ? `${STATUS_LABELS[entry.from_status]} → ` : ""}
                        {STATUS_LABELS[entry.to_status]}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </span>
                      <span className="shrink-0">{new Date(entry.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {actions.length > 0 && (
              <div className="sticky bottom-0 mt-6 flex flex-wrap gap-2 border-t border-border bg-background pt-4">
                {actions.map((action) => (
                  <Button
                    key={action.nextStatus}
                    className="h-11 flex-1"
                    variant={action.variant === "destructive" ? "outline" : "default"}
                    disabled={busy}
                    onClick={() =>
                      action.nextStatus === "cancelled" ? onReject(detail) : onAdvance(detail, action.nextStatus)
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            <OrderPrintTicket order={detail} restaurant={restaurant} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
