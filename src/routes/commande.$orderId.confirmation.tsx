import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { MarketplaceShell } from "@/components/marketplace/MarketplaceShell";

type ConfirmationSearch = {
  number: number | undefined;
  restaurant: string | undefined;
  slug: string | undefined;
  total: number | undefined;
  currency: string | undefined;
  payment: string | undefined;
};

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function validateSearch(search: Record<string, unknown>): ConfirmationSearch {
  return {
    number: toOptionalNumber(search["number"]),
    restaurant: toOptionalString(search["restaurant"]),
    slug: toOptionalString(search["slug"]),
    total: toOptionalNumber(search["total"]),
    currency: toOptionalString(search["currency"]),
    payment: toOptionalString(search["payment"]),
  };
}

export const Route = createFileRoute("/commande/$orderId/confirmation")({
  ssr: false,
  validateSearch,
  head: () => ({
    meta: [
      { title: "Commande confirmée | SAOVIA" },
      { name: "description", content: "Confirmation de votre commande SAOVIA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderConfirmationPage,
});

function OrderConfirmationPage() {
  const { orderId } = Route.useParams();
  const { number, restaurant, slug, total, currency, payment } = Route.useSearch();

  return (
    <MarketplaceShell
      eyebrow="Confirmation"
      title="Commande confirmée"
      subtitle="Merci pour votre commande, transmise directement au restaurant."
      searchHref="/rechercher"
      ctas={
        <Link to="/restaurants" className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          Retour au Marketplace
        </Link>
      }
    >
      <section className="mx-auto max-w-xl space-y-6 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {number !== undefined ? `Commande #${number}` : "Commande transmise"}
          </h2>
          {restaurant ? <p className="mt-1 text-sm text-muted-foreground">{restaurant}</p> : null}
        </div>

        {total !== undefined ? (
          <p className="text-3xl font-semibold">
            {total.toLocaleString("fr-FR")} {currency ?? "FCFA"}
          </p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Votre commande a bien été transmise au restaurant.
          {payment === "cash" ? " Réglez directement sur place ou à la livraison." : ""}
        </p>

        <p className="text-xs text-muted-foreground">Référence : {orderId}</p>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            to="/restaurants"
            className="rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-accent"
          >
            Retour au Marketplace
          </Link>
          {slug ? (
            <Link
              to="/restaurant/$slug"
              params={{ slug }}
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Voir le restaurant
            </Link>
          ) : null}
        </div>
      </section>
    </MarketplaceShell>
  );
}
