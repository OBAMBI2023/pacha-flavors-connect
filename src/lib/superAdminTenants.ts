import { supabase } from "@/integrations/supabase/client";

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
