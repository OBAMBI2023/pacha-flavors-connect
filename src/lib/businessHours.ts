import { supabase } from "@/integrations/supabase/client";

/** 0 = Sunday .. 6 = Saturday -- matches JS Date.getDay() / Postgres extract(dow from ...), the same convention the get_restaurant_availability RPC uses. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  0: "Dimanche",
};

/** Display order (Monday first) -- the stored day_of_week values are unaffected. */
export const DAY_DISPLAY_ORDER: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export type BusinessHoursSlot = {
  id: string;
  restaurant_id: string;
  day_of_week: DayOfWeek;
  is_open: boolean;
  opening_time: string | null;
  closing_time: string | null;
};

export type BusinessHoursSlotInput = {
  day_of_week: DayOfWeek;
  is_open: boolean;
  opening_time: string | null;
  closing_time: string | null;
};

export type BusinessException = {
  id: string;
  restaurant_id: string;
  date: string;
  end_date: string | null;
  is_open: boolean;
  opening_time: string | null;
  closing_time: string | null;
  reason: string | null;
};

export type BusinessExceptionInput = {
  date: string;
  end_date: string | null;
  is_open: boolean;
  opening_time: string | null;
  closing_time: string | null;
  reason: string | null;
};

export type ManualOverrideMode = "automatic" | "open" | "closed";

export type RestaurantAvailability = {
  is_open: boolean;
  reason: "exception" | "manual" | "schedule" | "unconfigured" | "unknown";
  closes_at: string | null;
  next_opens_at: string | null;
};

export async function fetchBusinessHours(restaurantId: string): Promise<BusinessHoursSlot[]> {
  const { data, error } = await supabase
    .from("tenant_business_hours")
    .select("id,restaurant_id,day_of_week,is_open,opening_time,closing_time")
    .eq("restaurant_id", restaurantId)
    .order("day_of_week", { ascending: true })
    .order("opening_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BusinessHoursSlot[];
}

export async function createBusinessHoursSlot(restaurantId: string, input: BusinessHoursSlotInput): Promise<string> {
  const { data, error } = await supabase
    .from("tenant_business_hours")
    .insert({ restaurant_id: restaurantId, ...input })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateBusinessHoursSlot(id: string, input: BusinessHoursSlotInput): Promise<void> {
  const { error } = await supabase.from("tenant_business_hours").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteBusinessHoursSlot(id: string): Promise<void> {
  const { error } = await supabase.from("tenant_business_hours").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBusinessExceptions(restaurantId: string): Promise<BusinessException[]> {
  const { data, error } = await supabase
    .from("tenant_business_exceptions")
    .select("id,restaurant_id,date,end_date,is_open,opening_time,closing_time,reason")
    .eq("restaurant_id", restaurantId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BusinessException[];
}

export async function createBusinessException(restaurantId: string, input: BusinessExceptionInput): Promise<string> {
  const { data, error } = await supabase
    .from("tenant_business_exceptions")
    .insert({ restaurant_id: restaurantId, ...input })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateBusinessException(id: string, input: BusinessExceptionInput): Promise<void> {
  const { error } = await supabase.from("tenant_business_exceptions").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteBusinessException(id: string): Promise<void> {
  const { error } = await supabase.from("tenant_business_exceptions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchManualOverride(restaurantId: string): Promise<ManualOverrideMode> {
  const { data, error } = await supabase
    .from("restaurant_settings")
    .select("manual_override,manual_status")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.manual_override) return "automatic";
  return data.manual_status === "open" ? "open" : "closed";
}

export async function setManualOverride(restaurantId: string, mode: ManualOverrideMode): Promise<void> {
  const payload = mode === "automatic" ? { manual_override: false, manual_status: null } : { manual_override: true, manual_status: mode };
  const { error } = await supabase.from("restaurant_settings").update(payload).eq("restaurant_id", restaurantId);
  if (error) throw error;
}

export async function fetchAvailability(restaurantId: string): Promise<RestaurantAvailability> {
  const { data, error } = await supabase.rpc("get_restaurant_availability", { p_restaurant_id: restaurantId });
  if (error) throw error;
  return data as unknown as RestaurantAvailability;
}
