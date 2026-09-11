import { supabase } from "@/lib/supabase-any";

export type RestaurantStatus = "trial" | "active" | "suspended" | "archived";

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: RestaurantStatus;
  created_at: string;
  owner_user_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
};

export async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase.rpc("super_admin_list_tenants");
  if (error) throw error;
  return (data ?? []) as TenantRow[];
}

export type CreateTenantInput = {
  restaurant: {
    name: string;
    slug: string;
    phone?: string | null;
    whatsapp_phone?: string | null;
    email?: string | null;
    address?: string | null;
    commune?: string | null;
    city?: string | null;
    status?: RestaurantStatus;
  };
  admin: { name?: string | null; email: string; password: string };
  theme?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    background_color?: string | null;
    surface_color?: string | null;
    text_color?: string | null;
    font_family?: string | null;
    border_radius?: string | null;
  };
};

export type CreateTenantResult = {
  restaurant_id: string;
  name: string;
  slug: string;
  admin_email: string;
};

async function invokeTenantFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("super-admin-tenant", { body });
  if (error) {
    // FunctionsHttpError carries the raw Response on `context` -- the JSON
    // body (with the function's actual `error` message) must be read async;
    // fall back to the generic SDK message if the body isn't JSON.
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.json();
        if (parsed?.error) message = String(parsed.error);
      } catch {
        // body wasn't valid JSON -- keep the generic message
      }
    }
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as { error: string }).error));
  }
  return data as T;
}

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  return invokeTenantFunction<CreateTenantResult>({ action: "create", ...input });
}

export async function resetTenantPassword(restaurantId: string, newPassword: string): Promise<void> {
  await invokeTenantFunction<{ success: true }>({
    action: "reset_password",
    restaurant_id: restaurantId,
    new_password: newPassword,
  });
}

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_amount: number;
  currency: string;
  billing_period: string;
};

/** Every authenticated user can read plans (plans_select_authenticated) -- this is just the catalog, not a tenant's own subscription. */
export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from("plans").select("id,name,description,price_amount,currency,billing_period").eq("is_active", true).order("price_amount");
  if (error) throw error;
  return (data ?? []) as unknown as Plan[];
}

export type RestaurantSubscription = {
  restaurant_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
};

/** RLS-scoped read (restaurant_subscriptions_select_members, super admin included) -- no RPC needed for the read side, only the write. */
export async function fetchRestaurantSubscription(restaurantId: string): Promise<RestaurantSubscription | null> {
  const { data, error } = await supabase
    .from("restaurant_subscriptions")
    .select("restaurant_id,plan_id,status,current_period_end")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as RestaurantSubscription | null) ?? null;
}

/**
 * Super Admin-only. restaurant_subscriptions has no client-writable RLS
 * policy at all (by design -- see phase4/super_admin_tenant_fiche
 * migrations), so this RPC is the only path to change a tenant's plan.
 */
export async function setTenantPlan(restaurantId: string, planId: string): Promise<void> {
  const { error } = await supabase.rpc("super_admin_set_restaurant_plan", { _restaurant_id: restaurantId, _plan_id: planId });
  if (error) throw error;
}
