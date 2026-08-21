import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";
import { useMenuData } from "@/lib/menu-db";
import { supabase } from "@/integrations/supabase/client";
import type { CreateOrderResult } from "@/lib/orders-db";

type CartLine = {
  productId: string;
  name: string;
  price: number | null;
  quantity: number;
};

export const Route = createFileRoute("/restaurant/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} � Menu et commande en ligne | SAOVIA` },
      { name: "description", content: `D�couvrez le menu de ${params.slug} et commandez en ligne sur SAOVIA.` },
      { name: "robots", content: "index,follow" },
      { property: "og:title", content: `${params.slug} � Menu et commande en ligne | SAOVIA` },
      { property: "og:description", content: `D�couvrez le menu de ${params.slug} et commandez en ligne sur SAOVIA.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `/restaurant/${params.slug}` }],
  }),
  component: RestaurantPage,
});

function RestaurantPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMenuData(slug);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const product = useMemo(
    () => data?.items.find((item) => item.id === selected) ?? data?.items[0] ?? null,
    [data?.items, selected],
  );

  const subtotal = cart.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0);

  function addCurrentProduct() {
    if (!product) return;
    setCart((current) => {
      const index = current.findIndex((line) => line.productId === product.id);
      if (index < 0) {
        return [
          ...current,
          { productId: product.id, name: product.name, price: product.price, quantity: qty },
        ];
      }

      const existing = current[index];
      if (!existing) return current;
      const next = [...current];
      next[index] = { ...existing, quantity: existing.quantity + qty };
      return next;
    });
    toast.success("Produit ajout� au panier");
  }

  async function submitOrder() {
    if (!data?.restaurant || cart.length === 0) {
      toast.error("Ajoutez au moins un produit au panier.");
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Renseignez votre nom et votre t�l�phone.");
      return;
    }

    setSubmitting(true);
    const payload = {
      p_slug: slug,
      p_fulfillment_type: "pickup" as const,
      p_customer_name: customerName.trim(),
      p_customer_phone: customerPhone.trim(),
      p_customer_notes: notes.trim() || null,
      p_items: cart.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
      p_order_source: "marketplace",
      p_source_metadata: {
        marketplace_restaurant_id: data.restaurant.id,
        landing_path: `/restaurant/${slug}`,
        referrer: document.referrer || null,
        utm_source: new URLSearchParams(window.location.search).get("utm_source"),
        utm_medium: new URLSearchParams(window.location.search).get("utm_medium"),
        utm_campaign: new URLSearchParams(window.location.search).get("utm_campaign"),
      },
    };

    const { data: rpcData, error } = await supabase.rpc("create_order", payload as never);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    const order = rpcData as unknown as CreateOrderResult;

    setCart([]);
    setQty(1);
    toast.success("Commande créée avec succès");
    navigate({
      to: "/commande/$orderId/confirmation",
      params: { orderId: order.order_id },
      search: {
        number: order.order_number,
        restaurant: data.restaurant.name,
        slug,
        total: order.total_amount,
        currency: order.currency,
        payment: order.payment_method,
      },
    });
  }

  return (
    <MarketplaceShell
      eyebrow="Restaurant"
      title={data?.restaurant?.name ?? slug}
      subtitle={data?.settings?.description ?? "Menu public et commande en ligne sur SAOVIA."}
      searchHref="/rechercher"
      ctas={
        <button className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground" onClick={() => void submitOrder()} disabled={submitting}>
          {submitting ? "Cr�ation..." : "Commander"}
        </button>
      }
    >
      {isLoading ? (
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      ) : isError ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">Impossible de charger ce restaurant.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <section className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-3xl font-semibold">Menu</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {data?.items.map((item) => (
                <button key={item.id} onClick={() => { setSelected(item.id); setQty(1); }} className={`rounded-2xl border p-4 text-left transition-colors ${selected === item.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <p className="font-medium">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <p className="mt-2 text-sm font-semibold">{item.price === null ? "Prix sur demande" : `${item.price} FCFA`}</p>
                </button>
              ))}
            </div>
          </section>
          <aside className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-2xl font-semibold">Panier et checkout</h2>
            {product ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Produit s�lectionn�</p>
                  <p className="mt-1 font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.price === null ? "Prix sur demande" : `${product.price} FCFA`}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <button className="rounded-full border px-3 py-2" onClick={() => setQty((v) => Math.max(1, v - 1))}>-</button>
                    <span>{qty}</span>
                    <button className="rounded-full border px-3 py-2" onClick={() => setQty((v) => v + 1)}>+</button>
                  </div>
                  <button onClick={addCurrentProduct} className="mt-4 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Ajouter au panier</button>
                </div>
                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Panier</p>
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun produit pour le moment.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {cart.map((line) => (
                        <li key={line.productId} className="flex items-center justify-between gap-3">
                          <span>{line.quantity} � {line.name}</span>
                          <span>{line.price === null ? "�" : `${(line.price * line.quantity).toLocaleString("fr-FR")} FCFA`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm font-semibold">Total estim�: {subtotal.toLocaleString("fr-FR")} FCFA</p>
                </div>
                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Informations client</p>
                  <label className="block"><span className="text-xs text-muted-foreground">Nom *</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm" /></label>
                  <label className="block"><span className="text-xs text-muted-foreground">T�l�phone *</span><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm" /></label>
                  <label className="block"><span className="text-xs text-muted-foreground">Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm" /></label>
                  <button onClick={() => void submitOrder()} disabled={submitting || cart.length === 0} className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{submitting ? "Cr�ation de la commande..." : "Confirmer la commande"}</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">S�lectionnez un produit.</p>
            )}
          </aside>
        </div>
      )}
    </MarketplaceShell>
  );
}
