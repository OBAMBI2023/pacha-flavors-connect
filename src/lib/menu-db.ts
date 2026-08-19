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

export type MenuData = {
  categories: DbCategory[];
  rows: DbMenuItem[];
  items: MenuItem[];
};

export const MENU_BUCKET = "menu-images";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type PublicMenuRow = {
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

export async function fetchMenuData(): Promise<MenuData> {
  const { data, error } = await supabase.rpc("get_public_menu", { p_slug: "le-pacha" });
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

  return { categories: cats, rows: list, items };
}

export function useMenuData() {
  return useQuery({ queryKey: ["menu-data"], queryFn: fetchMenuData, staleTime: 60_000 });
}
