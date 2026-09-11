import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { fetchCustomerOrder, formatOrderNumber, getDriverStepLabel, type OrderRow, type OrderStatus } from "@/lib/orders";
import { formatMoney } from "@/lib/currency";
import { CartProvider } from "@/lib/cart";
import { OrderStatusTimeline } from "@/components/tenant/OrderStatusTimeline";
import { useStorefrontTheme } from "@/components/tenant/tenantTheme";
import { PublicFooter } from "@/components/PublicFooter";
import { OrderReviewSection } from "@/components/OrderReviewSection";

const STORAGE_PHONE = "saovia.customer.phone";
const STORAGE_RESTAURANT_SLUG = "saovia.restaurant.slug";

const STATUS_HEADLINE: Record<OrderStatus, string> = {
  pending: "Commande reçue",
  confirmed: "Commande acceptée",
  preparing: "Commande en préparation",
  ready: "Commande prête",
  out_for_delivery: "Commande en livraison",
  delivered: "Commande terminée",
  cancelled: "Commande refusée",
};

export const Route = createFileRoute("/commande/$orderId/confirmation")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: ConfirmationPage,
});

function ConfirmationPage() {
  useStorefrontTheme(null);
  const { orderId } = Route.useParams();
  const phone = typeof window === "undefined" ? "" : window.localStorage.getItem(STORAGE_PHONE) ?? "";
  const fallbackSlug = typeof window === "undefined" ? "" : window.localStorage.getItem(STORAGE_RESTAURANT_SLUG) ?? "";
  const [order, setOrder] = useState<OrderRow | null>(null);
  const query = useQuery({
    queryKey: ["order-confirmation", orderId, phone],
    queryFn: () => fetchCustomerOrder({ orderId, customerPhone: phone }),
    enabled: Boolean(orderId && phone),
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (query.data) setOrder(query.data);
  }, [query.data]);

  const backSlug = order?.restaurant?.slug || fallbackSlug;
  const isCancelled = order?.status === "cancelled";

  return (
    <CartProvider>
      <div className="min-h-screen bg-background pb-16">
        <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          {backSlug ? (
            <Link to="/r/$slug" params={{ slug: backSlug }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          ) : (
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          )}

          {!order ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">{query.isLoading ? "Chargement..." : "Commande introuvable."}</p>
          ) : (
            <>
              <div className={`mt-5 flex flex-col items-center gap-1 rounded-3xl p-6 text-center ${isCancelled ? "border border-destructive/20 bg-destructive/5" : "border border-border bg-card shadow-sm"}`}>
                {isCancelled ? <XCircle className="h-12 w-12 text-destructive" /> : <CheckCircle2 className="h-12 w-12 text-primary" />}
                {!isCancelled && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Commande enregistrée avec succès</p>}
                <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground">{STATUS_HEADLINE[order.status]}</h1>
                <p className="text-sm text-muted-foreground">{formatOrderNumber(order)} · {new Date(order.created_at).toLocaleString("fr-FR")}</p>
                {!isCancelled && order.estimated_preparation_minutes !== null && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 shrink-0 text-primary" /> Préparation estimée : environ {order.estimated_preparation_minutes} min
                  </p>
                )}
              </div>

              {!isCancelled && (
                <div className="mt-6 rounded-3xl border border-border bg-card p-5">
                  <OrderStatusTimeline status={order.status} fulfillmentType={order.fulfillment_type} variant="detailed" />
                </div>
              )}

              {order.fulfillment_type === "delivery" &&
                order.status === "out_for_delivery" &&
                getDriverStepLabel(order.driver_delivery_status) && (
                  <p className="mt-2 text-center text-sm font-semibold text-foreground">
                    {getDriverStepLabel(order.driver_delivery_status)}
                  </p>
                )}

              <div className="mt-4 space-y-4 rounded-3xl border border-border bg-card p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Client</p>
                    <p className="font-semibold text-foreground">{order.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Restaurant</p>
                    <p className="font-semibold text-foreground">{order.restaurant?.name ?? "Restaurant"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Réception</p>
                    <p className="font-semibold text-foreground">{order.fulfillment_type === "delivery" ? "Livraison" : "Retrait sur place"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-semibold text-foreground">{new Date(order.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Produits commandés</p>
                  <ul className="space-y-2.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="font-semibold text-foreground">{item.quantity}×</span> <span className="text-foreground">{item.product_name}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-foreground">{formatMoney(item.line_total, order.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4 text-base font-extrabold text-foreground">
                  <span>Total</span>
                  <span>{formatMoney(order.total_amount, order.currency)}</span>
                </div>
              </div>

              <OrderReviewSection orderId={order.id} customerPhone={phone} orderStatus={order.status} />

              {backSlug ? (
                <Link
                  to="/r/$slug"
                  params={{ slug: backSlug }}
                  className="mt-4 flex h-[54px] w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Retour
                </Link>
              ) : (
                <Link
                  to="/"
                  className="mt-4 flex h-[54px] w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
                >
                  Retour
                </Link>
              )}
            </>
          )}
        </main>
        <PublicFooter />
      </div>
    </CartProvider>
  );
}
