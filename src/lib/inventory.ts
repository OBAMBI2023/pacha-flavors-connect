import { supabase } from "@/integrations/supabase/client";

export type MovementType = "IN" | "OUT" | "ADJUSTMENT";

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: "Entrée",
  OUT: "Sortie",
  ADJUSTMENT: "Ajustement",
};

export type StockStatus = "available" | "low" | "out_of_stock" | "not_tracked";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  available: "Disponible",
  low: "Stock faible",
  out_of_stock: "Épuisé",
  not_tracked: "Non suivi",
};

export type InventoryRecord = {
  id: string;
  restaurant_id: string;
  product_id: string;
  quantity: number;
  alert_threshold: number;
  tracking_enabled: boolean;
  updated_at: string;
};

const INVENTORY_COLUMNS = "id,restaurant_id,product_id,quantity,alert_threshold,tracking_enabled,updated_at";

export function computeStockStatus(
  inv: Pick<InventoryRecord, "tracking_enabled" | "quantity" | "alert_threshold"> | null | undefined,
): StockStatus {
  if (!inv || !inv.tracking_enabled) return "not_tracked";
  if (inv.quantity <= 0) return "out_of_stock";
  if (inv.quantity <= inv.alert_threshold) return "low";
  return "available";
}

export async function fetchInventoryForRestaurant(restaurantId: string): Promise<InventoryRecord[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select(INVENTORY_COLUMNS)
    .eq("restaurant_id", restaurantId);
  if (error) throw error;
  return (data ?? []) as InventoryRecord[];
}

export async function fetchInventoryForProduct(
  restaurantId: string,
  productId: string,
): Promise<InventoryRecord | null> {
  const { data, error } = await supabase
    .from("inventory")
    .select(INVENTORY_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;
  return (data as InventoryRecord | null) ?? null;
}

export async function setInventoryTracking(params: {
  restaurantId: string;
  productId: string;
  enabled: boolean;
  initialQuantity?: number;
  alertThreshold?: number;
}): Promise<InventoryRecord> {
  const { data, error } = await supabase.rpc("set_inventory_tracking", {
    p_restaurant_id: params.restaurantId,
    p_product_id: params.productId,
    p_enabled: params.enabled,
    p_initial_quantity: params.initialQuantity ?? 0,
    p_alert_threshold: params.alertThreshold ?? 0,
  });
  if (error) throw error;
  return data as unknown as InventoryRecord;
}

export async function setInventoryAlertThreshold(params: {
  restaurantId: string;
  productId: string;
  alertThreshold: number;
}): Promise<InventoryRecord> {
  const { data, error } = await supabase.rpc("set_inventory_alert_threshold", {
    p_restaurant_id: params.restaurantId,
    p_product_id: params.productId,
    p_alert_threshold: params.alertThreshold,
  });
  if (error) throw error;
  return data as unknown as InventoryRecord;
}

export async function recordInventoryMovement(params: {
  restaurantId: string;
  productId: string;
  movementType: MovementType;
  value: number;
  reason: string;
  note?: string | null;
}): Promise<InventoryRecord> {
  const rpcParams: Record<string, unknown> = {
    p_restaurant_id: params.restaurantId,
    p_product_id: params.productId,
    p_movement_type: params.movementType,
    p_value: params.value,
    p_reason: params.reason,
  };
  if (params.note) rpcParams["p_note"] = params.note;
  const { data, error } = await supabase.rpc(
    "record_inventory_movement",
    rpcParams as { p_restaurant_id: string; p_product_id: string; p_movement_type: string; p_value: number; p_reason: string },
  );
  if (error) throw error;
  return data as unknown as InventoryRecord;
}

export type MovementRecord = {
  id: string;
  restaurant_id: string;
  product_id: string;
  order_id: string | null;
  quantity: number;
  movement_type: MovementType;
  reason: string | null;
  note: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
};

const MOVEMENT_COLUMNS =
  "id,restaurant_id,product_id,order_id,quantity,movement_type,reason,note,created_by,created_by_name,created_at";

export type MovementFilters = {
  productId?: string;
  movementType?: MovementType;
  from?: string;
  to?: string;
};

export async function fetchMovements(restaurantId: string, filters?: MovementFilters): Promise<MovementRecord[]> {
  let query = supabase
    .from("inventory_movements")
    .select(MOVEMENT_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (filters?.productId) query = query.eq("product_id", filters.productId);
  if (filters?.movementType) query = query.eq("movement_type", filters.movementType);
  if (filters?.from) query = query.gte("created_at", filters.from);
  if (filters?.to) query = query.lte("created_at", filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MovementRecord[];
}

export type StockOverview = {
  trackedCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  movementsToday: number;
};

export async function fetchStockOverview(restaurantId: string): Promise<StockOverview> {
  const [inventory, movements] = await Promise.all([
    fetchInventoryForRestaurant(restaurantId),
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("inventory_movements")
        .select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startOfDay.toISOString());
      if (error) throw error;
      return count ?? 0;
    })(),
  ]);

  const tracked = inventory.filter((i) => i.tracking_enabled);
  return {
    trackedCount: tracked.length,
    lowStockCount: tracked.filter((i) => computeStockStatus(i) === "low").length,
    outOfStockCount: tracked.filter((i) => computeStockStatus(i) === "out_of_stock").length,
    movementsToday: movements,
  };
}
