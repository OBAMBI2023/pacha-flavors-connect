import { supabase } from "@/integrations/supabase/client";
import type { PromotionType } from "@/lib/promotions";
import type { Customer } from "@/lib/customers-db";

export type PromoVisibility = "public" | "targeted" | "personal";

export type PromoCode = {
  id: string;
  restaurant_id: string;
  name: string;
  code: string;
  discount_type: PromotionType;
  discount_value: number | null;
  visibility: PromoVisibility;
  max_total_uses: number | null;
  max_uses_per_customer: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type PromoCodeInput = {
  name: string;
  code: string;
  discount_type: PromotionType;
  discount_value: number | null;
  visibility: PromoVisibility;
  max_total_uses: number | null;
  max_uses_per_customer: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export async function fetchPromoCodes(restaurantId: string): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("id,restaurant_id,name,code,discount_type,discount_value,visibility,max_total_uses,max_uses_per_customer,starts_at,ends_at,is_active")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromoCode[];
}

export async function createPromoCode(restaurantId: string, input: PromoCodeInput): Promise<string> {
  const { data, error } = await supabase
    .from("promo_codes")
    .insert({ restaurant_id: restaurantId, ...input })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updatePromoCode(id: string, input: PromoCodeInput): Promise<void> {
  const { error } = await supabase.from("promo_codes").update(input).eq("id", id);
  if (error) throw error;
}

export async function setPromoCodeActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("promo_codes").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deletePromoCode(id: string): Promise<void> {
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) throw error;
}

export function isDuplicateCodeError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("promo_codes_restaurant_code_unique");
}

export type PromoCodeTarget = { id: string; customer: Customer };

export async function fetchPromoCodeTargets(promoCodeId: string): Promise<PromoCodeTarget[]> {
  const { data, error } = await supabase
    .from("promo_code_targets")
    .select("id,customers(*)")
    .eq("promo_code_id", promoCodeId);
  if (error) throw error;
  return (data ?? [])
    .filter((row): row is typeof row & { customers: Customer } => Boolean(row.customers))
    .map((row) => ({ id: row.id, customer: row.customers as unknown as Customer }));
}

/** Deletes every existing target row for this promo code and inserts the given set -- simplest way to keep the picker's selection and the DB in sync without diffing. */
export async function replacePromoCodeTargets(promoCodeId: string, customerIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase.from("promo_code_targets").delete().eq("promo_code_id", promoCodeId);
  if (deleteError) throw deleteError;
  if (customerIds.length === 0) return;
  const { error: insertError } = await supabase
    .from("promo_code_targets")
    .insert(customerIds.map((customer_id) => ({ promo_code_id: promoCodeId, customer_id })));
  if (insertError) throw insertError;
}

export type PromoCodeValidation =
  | { valid: true; promoCodeId: string; discountAmount: number; waivesDelivery: boolean }
  | { valid: false; message: string };

/**
 * Checkout-facing preview only -- create_order() independently re-resolves
 * and re-validates the code server-side, so this call's numbers are never
 * trusted for the actual charge, only shown to the customer before they submit.
 */
export async function validatePromoCode(input: {
  restaurantSlug: string;
  code: string;
  phone: string;
  subtotal: number;
}): Promise<PromoCodeValidation> {
  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_slug: input.restaurantSlug,
    p_code: input.code,
    p_phone: input.phone,
    p_subtotal: input.subtotal,
  });
  if (error) throw error;
  const result = data as { valid: boolean; message: string | null; promo_code_id?: string; discount_amount?: number; waives_delivery?: boolean };
  if (!result.valid) return { valid: false, message: result.message ?? "Code promo invalide." };
  return {
    valid: true,
    promoCodeId: result.promo_code_id as string,
    discountAmount: Number(result.discount_amount ?? 0),
    waivesDelivery: Boolean(result.waives_delivery),
  };
}
