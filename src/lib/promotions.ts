import { supabase } from "@/lib/supabase-any";

export type PromotionType = "fixed_amount" | "percentage" | "free_delivery";
export type PromotionStatus = "draft" | "active" | "inactive" | "expired";

export type Promotion = {
  id: string;
  restaurant_id: string;
  product_id: string;
  title: string;
  type: PromotionType;
  value: number | null;
  status: PromotionStatus;
  starts_at: string;
  ends_at: string;
};

export type PromotionInput = {
  product_id: string;
  title: string;
  type: PromotionType;
  value: number | null;
  starts_at: string;
  ends_at: string;
};

export async function fetchPromotions(restaurantId: string): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from("product_promotions")
    .select("id,restaurant_id,product_id,title,type,value,status,starts_at,ends_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Promotion[];
}

/** `status` defaults to 'draft' (the PromotionsPanel flow: create, then activate separately); the item editor's quick promotion toggle passes 'active' to create+activate in one step. Returns the new row's id. */
export async function createPromotion(restaurantId: string, input: PromotionInput, status: PromotionStatus = "draft"): Promise<string> {
  const { data, error } = await supabase
    .from("product_promotions")
    .insert({ restaurant_id: restaurantId, ...input, status })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updatePromotion(id: string, input: PromotionInput): Promise<void> {
  const { error } = await supabase.from("product_promotions").update(input).eq("id", id);
  if (error) throw error;
}

/** Only 'active' and 'inactive' are ever set directly by a tenant -- 'draft' is the creation default and 'expired' is a display-only derived status (see getDisplayStatus), never written back. */
export async function setPromotionStatus(id: string, status: "active" | "inactive"): Promise<void> {
  const { error } = await supabase.from("product_promotions").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deletePromotion(id: string): Promise<void> {
  const { error } = await supabase.from("product_promotions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * The stored status can lag reality: a row can still say 'active' after its
 * ends_at has passed (the backend never auto-flips it, it just stops
 * honoring it -- see get_active_promotion). This is display-only, never
 * written back.
 */
export function getDisplayStatus(promotion: Pick<Promotion, "status" | "ends_at">): PromotionStatus {
  if (promotion.status === "active" && new Date(promotion.ends_at).getTime() < Date.now()) return "expired";
  return promotion.status;
}

export function isDuplicateActivePromotionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("product_promotions_one_active_per_product");
}
