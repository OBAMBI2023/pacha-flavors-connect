import { createFileRoute } from "@tanstack/react-router";
import { PromoCodesPanel } from "@/components/admin/promotions/PromoCodesPanel";
import { useMarketingContext } from "@/hooks/useMarketingContext";
import { RequireOneRestaurant } from "@/components/superadmin/marketing/RequireOneRestaurant";

export const Route = createFileRoute("/super-admin/marketing/promotions")({
  ssr: false,
  component: MarketingPromotionsPage,
});

function MarketingPromotionsPage() {
  const { restaurantId, restaurant } = useMarketingContext();
  return (
    <RequireOneRestaurant restaurantId={restaurantId}>
      {restaurantId && restaurantId !== "all" && (
        <PromoCodesPanel restaurantId={restaurantId} currency={restaurant?.currency ?? "XOF"} />
      )}
    </RequireOneRestaurant>
  );
}
