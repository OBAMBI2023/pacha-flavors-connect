import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_IMAGES, type MenuItem } from "@/data/menu";

export type DbCategory = {
  id: string;
  slug: string;
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

async function signImages(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(MENU_BUCKET).createSignedUrls(paths, 60 * 60 * 24);
  const map: Record<string, string> = {};
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
  }
  return map;
}

export async function fetchMenuData(): Promise<MenuData> {
  const [{ data: categories, error: catError }, { data: rows, error: itemError }] =
    await Promise.all([
      supabase.from("categories").select("*").order("position"),
      supabase.from("menu_items").select("*").order("position"),
    ]);

  if (catError) throw catError;
  if (itemError) throw itemError;

  const cats = (categories ?? []) as DbCategory[];
  const list = (rows ?? []) as DbMenuItem[];
  const signed = await signImages(
    list.map((r) => r.image_path).filter((p): p is string => Boolean(p)),
  );

  const bySlug = new Map(cats.map((c) => [c.id, c.slug] as const));

  const items: MenuItem[] = list.map((row) => ({
    id: row.id,
    name: row.name,
    subtitle: row.subtitle ?? undefined,
    description: row.description,
    price: row.price === null ? null : Number(row.price),
    image: (row.image_path ? signed[row.image_path] : undefined) ?? FALLBACK_IMAGES[row.slug],
    category: (row.category_id ? bySlug.get(row.category_id) : undefined) ?? "plats",
    available: row.available,
    daily: row.daily,
  }));

  return { categories: cats, rows: list, items };
}

export function useMenuData() {
  return useQuery({ queryKey: ["menu-data"], queryFn: fetchMenuData, staleTime: 60_000 });
}