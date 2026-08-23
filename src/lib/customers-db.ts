import { supabase } from "@/integrations/supabase/client";

export type Customer = {
  id: string;
  restaurant_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  orders_count: number;
  total_spent: number;
  first_order_at: string | null;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerOrderSummary = {
  id: string;
  order_number: number;
  created_at: string;
  status: string;
  total_amount: number;
  currency: string;
  items_summary: string;
};

const PAGE_SIZE = 25;

/**
 * Public, anonymous checkout lookup -- returns a name only when the typed
 * phone exactly matches a known customer of this one tenant, so a
 * returning customer on a different device/browser still gets their name
 * prefilled (the localStorage-based prefill only covers the same device).
 * Never throws to the caller: a lookup failure must never block or alarm
 * checkout, it just means no prefill happens.
 */
export async function lookupCustomerName(slug: string, phone: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("lookup_customer_name", { p_slug: slug, p_phone: phone });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * RLS (customers_select_members, via has_restaurant_access) is the actual
 * security boundary; restaurant_id here is defense-in-depth and keeps the
 * query plan tenant-scoped, matching fetchRestaurantOrders's own pattern.
 */
export async function fetchCustomers(
  restaurantId: string,
  options: { search?: string; page?: number } = {},
): Promise<{ customers: Customer[]; total: number }> {
  const page = options.page ?? 0;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .eq("restaurant_id", restaurantId)
    .order("last_order_at", { ascending: false, nullsFirst: false });

  const search = options.search?.trim();
  if (search) {
    // Phone search matches digits-only too, so a customer typing "07 08"
    // still finds a normalized "0708..." row.
    const digits = search.replace(/[^0-9]/g, "");
    const orParts = [`full_name.ilike.%${search}%`, `email.ilike.%${search}%`];
    if (digits) orParts.push(`phone.ilike.%${digits}%`);
    else orParts.push(`phone.ilike.%${search}%`);
    query = query.or(orParts.join(","));
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { customers: (data ?? []) as unknown as Customer[], total: count ?? 0 };
}

export async function fetchCustomer(customerId: string): Promise<Customer | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
  if (error) throw error;
  return (data as unknown as Customer | null) ?? null;
}

export async function fetchCustomerOrderHistory(customerId: string): Promise<CustomerOrderSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,created_at,status,total_amount,currency,item_count")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    order_number: row.order_number,
    created_at: row.created_at,
    status: row.status,
    total_amount: Number(row.total_amount),
    currency: row.currency,
    items_summary: `${row.item_count} article(s)`,
  }));
}

export async function updateCustomer(
  customerId: string,
  input: { full_name?: string; email?: string | null; address?: string | null },
): Promise<void> {
  const { error } = await supabase.from("customers").update(input).eq("id", customerId);
  if (error) throw error;
}

/** Reassigns every order from sourceId onto targetId, folds the stats together, and deletes sourceId -- see merge_customers. */
export async function mergeCustomers(sourceId: string, targetId: string): Promise<void> {
  const { error } = await supabase.rpc("merge_customers", { p_source_id: sourceId, p_target_id: targetId });
  if (error) throw error;
}

/**
 * Builds a wa.me-ready number from the stored (locally-formatted, no
 * country code -- see normalize_phone in the DB) phone. Every tenant in
 * this system today is in Côte d'Ivoire, so 225 is prefixed directly rather
 * than plumbing country_code through the admin data-fetch chain for a
 * value that would always resolve to the same thing in practice; a number
 * already long enough to include a country code is left as-is.
 */
export function normalizePhoneForWhatsApp(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return digits.length <= 10 ? `225${digits.replace(/^0+/, "")}` : digits;
}
