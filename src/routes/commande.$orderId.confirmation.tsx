import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { fetchCustomerOrder, formatOrderNumber, getDriverStepLabel, getOrderTrackingSteps, type OrderRow, type OrderStatus } from "@/lib/orders";
import { CartProvider } from "@/lib/cart";

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

export const Route = createFileRoute("/commande/$orderId/confirmation")({ ssr: false, component: ConfirmationPage });

function ConfirmationPage() {
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
  const steps = getOrderTrackingSteps(order?.status ?? "pending", order?.fulfillment_type);
  const isCancelled = order?.status === "cancelled";

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#F7F7F7] pb-16">
        <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
          {backSlug ? (
            <Link to="/r/$slug" params={{ slug: backSlug }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#666666] hover:text-[#171717]">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          ) : (
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#666666] hover:text-[#171717]">
              <ArrowLeft className="h-4 w-4" /> Retour
            </Link>
          )}

          {!order ? (
            <p className="mt-8 text-center text-sm text-[#666666]">{query.isLoading ? "Chargement..." : "Commande introuvable."}</p>
          ) : (
            <>
              <div className={`mt-5 flex flex-col items-center gap-1 rounded-3xl p-6 text-center ${isCancelled ? "border border-red-200 bg-red-50" : "border border-[#EAEAEA] bg-white shadow-sm"}`}>
                {isCancelled ? <XCircle className="h-12 w-12 text-red-500" /> : <CheckCircle2 className="h-12 w-12 text-[#F5A900]" />}
                {!isCancelled && <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#666666]">Commande enregistrée avec succès</p>}
                <h1 className="mt-1 font-display text-2xl font-extrabold text-[#171717]">{STATUS_HEADLINE[order.status]}</h1>
                <p className="text-sm text-[#666666]">{formatOrderNumber(order)} · {new Date(order.created_at).toLocaleString("fr-FR")}</p>
              </div>

              {!isCancelled && (
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {steps.map((step) => (
                    <div
                      key={step.key}
                      className={`rounded-xl px-2 py-2.5 text-center text-[11px] font-semibold ${
                        step.active ? "bg-[#F5A900] text-[#111111]" : "border border-[#EAEAEA] bg-white text-[#666666]"
                      }`}
                    >
                      {step.label}
                    </div>
                  ))}
                </div>
              )}

              {order.fulfillment_type === "delivery" &&
                order.status === "out_for_delivery" &&
                getDriverStepLabel(order.driver_delivery_status) && (
                  <p className="mt-2 text-center text-sm font-semibold text-[#171717]">
                    {getDriverStepLabel(order.driver_delivery_status)}
                  </p>
                )}

              <div className="mt-4 space-y-4 rounded-3xl border border-[#EAEAEA] bg-white p-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#666666]">Client</p>
                    <p className="font-semibold text-[#171717]">{order.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-[#666666]">Restaurant</p>
                    <p className="font-semibold text-[#171717]">{order.restaurant?.name ?? "Restaurant"}</p>
                  </div>
                  <div>
                    <p className="text-[#666666]">Réception</p>
                    <p className="font-semibold text-[#171717]">{order.fulfillment_type === "delivery" ? "Livraison" : "Retrait sur place"}</p>
                  </div>
                  <div>
                    <p className="text-[#666666]">Date</p>
                    <p className="font-semibold text-[#171717]">{new Date(order.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                </div>

                <div className="border-t border-[#EAEAEA] pt-4">
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#666666]">Produits commandés</p>
                  <ul className="space-y-2.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate">
                          <span className="font-semibold text-[#171717]">{item.quantity}×</span> <span className="text-[#171717]">{item.product_name}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-[#171717]">{item.line_total.toLocaleString("fr-FR")} FCFA</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between border-t border-[#EAEAEA] pt-4 text-base font-extrabold text-[#171717]">
                  <span>Total</span>
                  <span>{order.total_amount.toLocaleString("fr-FR")} FCFA</span>
                </div>
              </div>

              {backSlug ? (
                <Link
                  to="/r/$slug"
                  params={{ slug: backSlug }}
                  className="mt-4 flex h-[54px] w-full items-center justify-center rounded-2xl bg-[#F5A900] px-5 text-sm font-bold text-[#111111] shadow-sm transition-opacity hover:opacity-90"
                >
                  Retour
                </Link>
              ) : (
                <Link
                  to="/"
                  className="mt-4 flex h-[54px] w-full items-center justify-center rounded-2xl bg-[#F5A900] px-5 text-sm font-bold text-[#111111] shadow-sm transition-opacity hover:opacity-90"
                >
                  Retour
                </Link>
              )}
            </>
          )}
        </main>
      </div>
    </CartProvider>
  );
}
