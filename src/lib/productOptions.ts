import { supabase } from "@/lib/supabase-any";

export type SelectionType = "single" | "multiple";

export type OptionGroup = {
  id: string;
  product_id: string;
  restaurant_id: string;
  name: string;
  is_required: boolean;
  selection_type: SelectionType;
  min_select: number;
  max_select: number | null;
  sort_order: number;
};

export type ProductOption = {
  id: string;
  option_group_id: string;
  restaurant_id: string;
  name: string;
  extra_price: number;
  sort_order: number;
};

export type OptionGroupInput = {
  name: string;
  is_required: boolean;
  max_select: number;
};

export type ProductOptionInput = {
  name: string;
  extra_price: number;
};

export async function fetchOptionGroups(productId: string): Promise<OptionGroup[]> {
  const { data, error } = await supabase
    .from("product_option_groups")
    .select("id,product_id,restaurant_id,name,is_required,selection_type,min_select,max_select,sort_order")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OptionGroup[];
}

export async function fetchOptionsForGroups(groupIds: string[]): Promise<ProductOption[]> {
  if (groupIds.length === 0) return [];
  const { data, error } = await supabase
    .from("product_options")
    .select("id,option_group_id,restaurant_id,name,extra_price,sort_order")
    .in("option_group_id", groupIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductOption[];
}

/** `selection_type`/`min_select` are derived from `max_select`/`is_required` -- the form only ever asks for the latter two, matching the requested field set exactly. */
export async function createOptionGroup(restaurantId: string, productId: string, input: OptionGroupInput, sortOrder: number): Promise<string> {
  const { data, error } = await supabase
    .from("product_option_groups")
    .insert({
      restaurant_id: restaurantId,
      product_id: productId,
      name: input.name.trim(),
      is_required: input.is_required,
      min_select: input.is_required ? 1 : 0,
      max_select: input.max_select,
      selection_type: input.max_select > 1 ? "multiple" : "single",
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateOptionGroup(id: string, input: OptionGroupInput): Promise<void> {
  const { error } = await supabase
    .from("product_option_groups")
    .update({
      name: input.name.trim(),
      is_required: input.is_required,
      min_select: input.is_required ? 1 : 0,
      max_select: input.max_select,
      selection_type: input.max_select > 1 ? "multiple" : "single",
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteOptionGroup(id: string): Promise<void> {
  const { error } = await supabase.from("product_option_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function createOption(restaurantId: string, groupId: string, input: ProductOptionInput, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from("product_options")
    .insert({ restaurant_id: restaurantId, option_group_id: groupId, name: input.name.trim(), extra_price: input.extra_price, sort_order: sortOrder });
  if (error) throw error;
}

export async function updateOption(id: string, input: ProductOptionInput): Promise<void> {
  const { error } = await supabase.from("product_options").update({ name: input.name.trim(), extra_price: input.extra_price }).eq("id", id);
  if (error) throw error;
}

export async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase.from("product_options").delete().eq("id", id);
  if (error) throw error;
}
