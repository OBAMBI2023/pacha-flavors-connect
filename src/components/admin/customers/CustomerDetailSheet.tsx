import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchCustomer, fetchCustomerOrderHistory, normalizePhoneForWhatsApp, type Customer, type CustomerOrderSummary } from "@/lib/customers-db";
import { STATUS_LABELS } from "@/components/admin/orders/orderStatusMeta";
import type { OrderStatus } from "@/lib/orders-db";
import { formatMoney as money } from "@/lib/currency";

export function CustomerDetailSheet({
  customerId,
  currency,
  onClose,
}: {
  customerId: string | null;
  currency: string;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      setHistory([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([fetchCustomer(customerId), fetchCustomerOrderHistory(customerId)])
      .then(([customerData, historyData]) => {
        if (cancelled) return;
        setCustomer(customerData);
        setHistory(historyData);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossible de charger ce client.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const wa = customer ? normalizePhoneForWhatsApp(customer.phone) : null;

  return (
    <Sheet open={Boolean(customerId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "h-[92vh] overflow-y-auto rounded-t-2xl" : "w-full overflow-y-auto sm:max-w-lg"}
      >
        {loading && (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {error && <p className="pt-6 text-sm text-destructive">{error}</p>}
        {customer && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {customer.full_name}
                <Badge className={customer.source === "restaurant" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}>
                  {customer.source === "restaurant" ? "Ajouté par le restaurant" : "Client du site"}
                </Badge>
              </SheetTitle>
              <SheetDescription>Client depuis le {new Date(customer.created_at).toLocaleDateString("fr-FR")}</SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-6 text-sm">
              <section className="space-y-1.5 rounded-2xl border border-border p-4">
                <h3 className="font-semibold">Informations personnelles</h3>
                <p className="text-muted-foreground">{customer.phone}</p>
                <p className="text-muted-foreground">{customer.email ?? "Email non renseigné"}</p>
                <p className="text-muted-foreground">{customer.address ?? "Adresse non renseignée"}</p>
                {customer.internal_note && (
                  <p className="mt-2 rounded-xl bg-muted/60 p-2.5 text-foreground">
                    <span className="font-medium">Note interne : </span>
                    {customer.internal_note}
                  </p>
                )}
                {wa && (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                    <MessageCircle className="h-4 w-4" /> Ouvrir WhatsApp
                  </a>
                )}
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commandes</p>
                  <p className="mt-1 font-display text-2xl font-semibold">{customer.orders_count}</p>
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total dépensé</p>
                  <p className="mt-1 font-display text-2xl font-semibold">{money(customer.total_spent, currency)}</p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="font-semibold">Historique des commandes</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune commande pour le moment.</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((order) => (
                      <li key={order.id} className="rounded-2xl border border-border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">#{order.order_number}</span>
                          <Badge variant="outline">{STATUS_LABELS[order.status as OrderStatus] ?? order.status}</Badge>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{new Date(order.created_at).toLocaleString("fr-FR")} · {order.items_summary}</span>
                          <span className="font-semibold text-foreground">{money(order.total_amount, order.currency)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
