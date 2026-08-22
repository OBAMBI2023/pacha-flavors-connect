import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, ClipboardList, RefreshCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchCustomerOrders, formatOrderNumber, getOrderTrackingSteps, type OrderRow } from "@/lib/orders";
import { CartProvider } from "@/lib/cart";

const STORAGE_PHONE = "saovia.customer.phone";
const STORAGE_RESTAURANT_SLUG = "saovia.restaurant.slug";

export const Route = createFileRoute("/commandes")({ ssr: false, component: OrdersPage });

function OrdersPage() {
  const slug = typeof window === "undefined" ? "" : window.localStorage.getItem(STORAGE_RESTAURANT_SLUG) ?? "";
  const phone = typeof window === "undefined" ? "" : window.localStorage.getItem(STORAGE_PHONE) ?? "";
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const query = useQuery({
    queryKey: ["customer-orders", slug, phone],
    queryFn: () => fetchCustomerOrders({ restaurantSlug: slug, customerPhone: phone }),
    enabled: Boolean(slug && phone),
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (query.data) setOrders(query.data);
  }, [query.data]);

  return (
    <CartProvider>
      <div className="min-h-screen bg-background pb-24">
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {slug ? (
            <Link to="/r/$slug" params={{ slug }} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          ) : (
            <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          )}
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.3em] text-primary">Suivi</p>
              <h1 className="mt-2 font-display text-4xl font-semibold">Commandes</h1>
            </div>
            <button onClick={() => void query.refetch()} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm">
              <RefreshCcw className="h-4 w-4" /> Actualiser
            </button>
          </div>
          {!phone || !slug || orders.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 font-medium">Aucune commande pour le moment.</p>
              <p className="mt-1 text-sm text-muted-foreground">Passez une commande depuis le menu pour la voir ici.</p>
              <Link to="/" className="mt-6 inline-flex items-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Explorer le menu</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const steps = getOrderTrackingSteps(order.status);
                return (
                  <Link key={order.id} to="/commande/$orderId/confirmation" params={{ orderId: order.id }} className="block rounded-3xl border border-border bg-card p-5 transition-colors hover:bg-accent/40">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{formatOrderNumber(order)}</p>
                        <p className="text-sm text-muted-foreground">{order.restaurant?.name ?? "Restaurant"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{order.total_amount.toLocaleString("fr-FR")} FCFA</p>
                        <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                      {steps.map((step) => (
                        <div key={step.key} className={`rounded-xl px-2 py-2 text-center ${step.active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{step.label}</div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                      <span>{order.fulfillment_type === "delivery" ? "Livraison" : "Retrait sur place"}</span>
                      <span className="inline-flex items-center gap-1">Détail <ChevronRight className="h-4 w-4" /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </CartProvider>
  );
}
