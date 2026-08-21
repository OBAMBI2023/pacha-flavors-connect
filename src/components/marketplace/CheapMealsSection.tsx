import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { formatXof, useMarketplaceCheapProducts } from "@/lib/marketplace";

export function CheapMealsSection() {
  const { data, isLoading } = useMarketplaceCheapProducts({ maxPrice: 4000, limit: 20 });
  const products = data?.products ?? [];

  if (!isLoading && products.length === 0) return null;

  return (
    <section className="-mx-4 rounded-t-[1.75rem] bg-[oklch(0.97_0.03_85)] px-4 pb-6 pt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Repas à moins de {formatXof(4000)}</h2>
          <p className="text-sm text-muted-foreground">Sans dépense minimum</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-foreground" />
      </div>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-40 w-36 shrink-0 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {products.map((product) => (
            <Link
              key={product.id}
              to="/restaurant/$slug"
              params={{ slug: product.restaurantSlug }}
              className="flex w-36 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="h-24 w-full bg-muted">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="truncate text-sm font-semibold">{product.name}</p>
                <p className="text-sm font-bold text-primary">{formatXof(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
