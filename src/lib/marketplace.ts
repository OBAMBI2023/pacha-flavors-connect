import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MENU_IMAGE_BUCKET = "menu-images";

export type MarketplaceRestaurant = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  city: string | null;
  commune: string | null;
  cover_url: string | null;
  logo_url: string | null;
  dish_types: string[];
  delivery_fee: number;
  minimum_order: number;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
};

export async function fetchMarketplaceRestaurants(params: { q?: string }) {
  const { data, error } = await supabase.rpc("get_public_restaurants" as never, {
    p_query: params.q?.trim() || null,
  } as never);
  if (error) throw error;

  const restaurants: MarketplaceRestaurant[] = ((data as any[]) ?? []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    city: row.city ?? null,
    commune: row.commune ?? null,
    cover_url: row.cover_url ?? null,
    logo_url: row.logo_url ?? null,
    dish_types: Array.isArray(row.dish_types) ? row.dish_types : [],
    delivery_fee: Number(row.delivery_fee ?? 0),
    minimum_order: Number(row.minimum_order ?? 0),
    delivery_enabled: row.delivery_enabled ?? true,
    pickup_enabled: row.pickup_enabled ?? true,
  }));

  return { restaurants };
}

export function useMarketplaceRestaurants(params: { q?: string }) {
  return useQuery({
    queryKey: ["marketplace-restaurants", params.q ?? ""],
    queryFn: () => fetchMarketplaceRestaurants(params),
    staleTime: 60_000,
  });
}

export type MarketplaceCheapProduct = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
};

export async function fetchMarketplaceCheapProducts(params: { maxPrice?: number; limit?: number }) {
  const { data, error } = await supabase.rpc("get_public_cheap_products" as never, {
    p_max_price: params.maxPrice ?? 4000,
    p_limit: params.limit ?? 20,
  } as never);
  if (error) throw error;

  const products: MarketplaceCheapProduct[] = ((data as any[]) ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price ?? 0),
    imageUrl: row.image_path ? supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(row.image_path).data.publicUrl : null,
    restaurantId: row.restaurant_id,
    restaurantSlug: row.restaurant_slug,
    restaurantName: row.restaurant_name,
  }));

  return { products };
}

export function useMarketplaceCheapProducts(params: { maxPrice?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["marketplace-cheap-products", params.maxPrice ?? 4000, params.limit ?? 20],
    queryFn: () => fetchMarketplaceCheapProducts(params),
    staleTime: 60_000,
  });
}

export function formatXof(amount: number) {
  return `${Math.round(amount).toLocaleString("fr-FR")} CFA`;
}
