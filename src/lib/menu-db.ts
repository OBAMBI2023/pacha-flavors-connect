import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_IMAGES, type MenuItem } from "@/data/menu";

export type DbCategory = {
  id: string;
  label: string;
  position: number;
};

export type DbMenuItem = {
  id: string;
  slug: string;
  category_id: string | null;
  name: string;
  subtitle: string | null;
  description: string;
  price: number | null;
  image_path: string | null;
  available: boolean;
  daily: boolean;
  position: number;
};

export type PublicRestaurant = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  whatsapp_phone: string | null;
  email: string | null;
  address: string | null;
  commune: string | null;
  city: string | null;
  country_code: string | null;
  currency: string | null;
  timezone: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

export type PublicRestaurantSettings = {
  description: string | null;
  delivery_enabled: boolean | null;
  pickup_enabled: boolean | null;
  dine_in_enabled: boolean | null;
  reservation_enabled: boolean | null;
  whatsapp_message_template: string | null;
};

export type MenuData = {
  restaurant: PublicRestaurant | null;
  settings: PublicRestaurantSettings | null;
  categories: DbCategory[];
  rows: DbMenuItem[];
  items: MenuItem[];
};

export const MENU_BUCKET = "menu-images";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type PublicMenuRow = {
  restaurant: PublicRestaurant | null;
  settings: PublicRestaurantSettings | null;
  categories: Array<{
    id: string;
    name: string;
    label: string;
    sort_order: number | null;
    position?: number | null;
  }>;
  products: Array<{
    id: string;
    slug: string;
    category_id: string | null;
    name: string;
    subtitle: string | null;
    description: string;
    price: number | null;
    image_path: string | null;
    is_available: boolean;
    available?: boolean | null;
    is_daily_menu: boolean;
    daily?: boolean | null;
    sort_order: number | null;
    position?: number | null;
  }>;
};

/**
 * Fetches the public menu for a single restaurant, identified by its slug.
 * `slug` is required on purpose: this is shared multi-tenant logic and must
 * never silently fall back to a specific tenant (e.g. "le-pacha").
 */
export async function fetchMenuData(slug: string): Promise<MenuData> {
  const { data, error } = await supabase.rpc("get_public_menu", { p_slug: slug });
  if (error) throw error;
  const payload = data as PublicMenuRow | null;
  const cats = (payload?.categories ?? []).map((cat) => ({
    id: cat.id,
    label: cat.label ?? cat.name,
    position: cat.position ?? cat.sort_order ?? 0,
  }));
  const list = (payload?.products ?? []).map((row) => ({
    ...row,
    available: row.available ?? row.is_available,
    daily: row.daily ?? row.is_daily_menu,
    position: row.position ?? row.sort_order ?? 0,
  })) as DbMenuItem[];

  const items: MenuItem[] = list.map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
    image: row.image_path ? supabase.storage.from(MENU_BUCKET).getPublicUrl(row.image_path).data.publicUrl : FALLBACK_IMAGES[row.slug],
    category: slugify(cats.find((c) => c.id === row.category_id)?.label ?? "plats"),
    available: row.available,
    daily: row.daily,
  }));

  return {
    restaurant: payload?.restaurant ?? null,
    settings: payload?.settings ?? null,
    categories: cats,
    rows: list,
    items,
  };
}

export function useMenuData(slug: string) {
  return useQuery({
    queryKey: ["menu-data", slug],
    queryFn: () => fetchMenuData(slug),
    staleTime: 60_000,
    enabled: Boolean(slug),
  });
}

export type DbRestaurant = {
  id: string;
  name: string;
  slug: string;
};

export type AdminMenuData = {
  restaurant: DbRestaurant | null;
  categories: DbCategory[];
  rows: DbMenuItem[];
};

export async function fetchAdminMenuData(restaurantId: string): Promise<AdminMenuData> {
  const [{ data: restaurant, error: restaurantError }, { data: categoriesData, error: categoriesError }, { data: productsData, error: productsError }] =
    await Promise.all([
      supabase.from("restaurants").select("id,name,slug").eq("id", restaurantId).maybeSingle(),
      supabase
        .from("restaurant_categories")
        .select("id,name,sort_order")
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("restaurant_products")
        .select("id,slug,category_id,name,subtitle,description,price,image_path,is_available,is_daily_menu,sort_order")
        .eq("restaurant_id", restaurantId)
        .order("sort_order", { ascending: true }),
    ]);

  if (restaurantError) throw restaurantError;
  if (categoriesError) throw categoriesError;
  if (productsError) throw productsError;

  const categories: DbCategory[] = (categoriesData ?? []).map((cat) => ({
    id: cat.id,
    label: cat.name,
    position: cat.sort_order ?? 0,
  }));

  const rows: DbMenuItem[] = (productsData ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    category_id: row.category_id,
    name: row.name,
    subtitle: row.subtitle,
    description: row.description ?? "",
    price: row.price === null ? null : Number(row.price),
    image_path: row.image_path,
    available: row.is_available,
    daily: row.is_daily_menu,
    position: row.sort_order ?? 0,
  }));

  return {
    restaurant: (restaurant as DbRestaurant | null) ?? null,
    categories,
    rows,
  };
}

export function useAdminMenuData(restaurantId: string | null) {
  return useQuery({
    queryKey: ["admin-menu-data", restaurantId],
    queryFn: () => fetchAdminMenuData(restaurantId as string),
    enabled: Boolean(restaurantId),
  });
}
