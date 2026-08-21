import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MarketplaceRestaurant = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  city: string | null;
  commune: string | null;
  cover_url: string | null;
  logo_url: string | null;
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
    description: null,
    cuisine: null,
    city: row.city ?? null,
    commune: row.commune ?? null,
    cover_url: row.cover_url ?? null,
    logo_url: row.logo_url ?? null,
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
