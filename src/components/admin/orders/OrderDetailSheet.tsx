import { useEffect, useState } from "react";
import { Banknote, Undo2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchOrderDetail, type Order, type OrderDetail, type OrderStatus } from "@/lib/orders-db";
import { STATUS_BADGE_CLASS, STATUS_LABELS, fulfillmentLabel, nextActions } from "./orderStatusMeta";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_BADGE_CLASS, PAYMENT_STATUS_LABELS } from "./paymentStatusMeta";

function money(amount: number, currency: string) {
  return `${amount.toLocaleString("fr-FR")} ${currency}`;
}

export function OrderDetailSheet({
  orderId,
  busy,
  onClose,
  onAdvance,
  onReject,
  onMarkPaid,
  onRefund,
}: {
  orderId: string | null;
  busy: boolean;
  onClose: () => void;
  onAdvance: (order: Order, nextStatus: OrderStatus) => void;
  onReject: (order: Order) => void;
  onMarkPaid: (order: Order) => void;
  onRefund: (order: Order) => void;
}) {
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
              </div>
              <SheetDescription>
                {new Date(detail.created_at).toLocaleString("fr-FR")}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-6 text-sm">
              <section className="space-y-1.5 rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Client</h3>
                <p>{detail.customer_name}</p>
                <p className="text-muted-foreground">{detail.customer_phone}</p>
                <p className="text-muted-foreground">{fulfillmentLabel(detail.fulfillment_type)}</p>
                {detail.fulfillment_type === "delivery" && (
                  <p className="text-muted-foreground">
                    {[detail.delivery_commune, detail.delivery_address].filter(Boolean).join(", ") || "Adresse non renseignée"}
                  </p>
                )}
                {detail.delivery_instructions && (
                  <p className="text-muted-foreground">Instructions : {detail.delivery_instructions}</p>
                )}
                {detail.customer_notes && <p className="text-muted-foreground">Notes client : {detail.customer_notes}</p>}
              </section>

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
                  <span className="text-muted-foreground">Sous-total</span>
                  <span>{money(detail.subtotal_amount, detail.currency)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Frais de livraison</span>
                  <span>{money(detail.delivery_fee_amount, detail.currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                  <span>Total</span>
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
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
