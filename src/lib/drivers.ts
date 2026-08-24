import { supabase } from "@/integrations/supabase/client";
import type { DriverStatus } from "@/lib/delivery";

/**
 * Data access for the fleet module.
 *
 * Everything here targets the pre-existing backend (driver_profiles,
 * vehicles, driver_documents, driver_assignment_history, RPC
 * assign_driver_to_order / get_driver_fleet_stats, private bucket
 * driver-documents). No table, RPC or policy is created from the frontend.
 *
 * Reads use `select("*")` and normalise defensively, so an optional column
 * that a given environment doesn't expose degrades to null instead of
 * throwing. Writes only ever touch the columns listed in the payload types
 * below.
 */

export type AdminDriverStatus = DriverStatus | "suspended";

export type AdminDriver = {
  id: string;
  restaurant_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  status: AdminDriverStatus;
  notes: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  created_at: string | null;
};

export type Vehicle = {
  id: string;
  restaurant_id: string;
  driver_id: string | null;
  vehicle_type: string | null;
  brand: string | null;
  model: string | null;
  plate_number: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string | null;
};

export type DriverDocumentType = "id_card" | "driver_license";

export type DriverDocument = {
  id: string;
  restaurant_id: string;
  driver_id: string;
  document_type: DriverDocumentType | string;
  file_path: string | null;
  document_number: string | null;
  expires_at: string | null;
  created_at: string | null;
};

export type DriverAssignment = {
  id: string;
  driver_id: string;
  order_id: string;
  assignment_type: string | null;
  created_at: string | null;
  order_number: number | null;
  order_status: string | null;
  total_amount: number | null;
  currency: string | null;
};

export type FleetStats = {
  total_drivers: number;
  active_drivers: number;
  available_drivers: number;
  delivering_drivers: number;
  suspended_drivers: number;
  deliveries_today: number;
  deliveries_total: number;
};

export const DRIVER_STATUS_LABELS: Record<AdminDriverStatus, string> = {
  offline: "Hors ligne",
  available: "Disponible",
  proposed: "Proposition en cours",
  busy: "Occupé",
  delivering: "En livraison",
  suspended: "Suspendu",
};

export const DRIVER_STATUS_BADGE_CLASS: Record<AdminDriverStatus, string> = {
  offline: "bg-muted text-muted-foreground",
  available: "bg-emerald-100 text-emerald-700",
  proposed: "bg-amber-100 text-amber-700",
  busy: "bg-amber-100 text-amber-700",
  delivering: "bg-primary/10 text-primary",
  suspended: "bg-destructive/10 text-destructive",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  id_card: "Pièce d'identité",
  driver_license: "Permis de conduire",
};

export const VEHICLE_TYPES = ["moto", "scooter", "velo", "voiture", "tricycle"] as const;

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  moto: "Moto",
  scooter: "Scooter",
  velo: "Vélo",
  voiture: "Voiture",
  tricycle: "Tricycle",
};

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toDriver(row: Row): AdminDriver {
  return {
    id: String(row["id"]),
    restaurant_id: String(row["restaurant_id"] ?? ""),
    full_name: str(row["full_name"]) ?? "Livreur",
    phone: str(row["phone"]) ?? "",
    email: str(row["email"]),
    is_active: row["is_active"] !== false,
    status: (str(row["status"]) as AdminDriverStatus | null) ?? "offline",
    notes: str(row["notes"]),
    last_lat: num(row["last_lat"]),
    last_lng: num(row["last_lng"]),
    last_location_at: str(row["last_location_at"]),
    created_at: str(row["created_at"]),
  };
}

function toVehicle(row: Row): Vehicle {
  return {
    id: String(row["id"]),
    restaurant_id: String(row["restaurant_id"] ?? ""),
    driver_id: str(row["driver_id"]),
    vehicle_type: str(row["vehicle_type"]),
    brand: str(row["brand"]),
    model: str(row["model"]),
    plate_number: str(row["plate_number"]),
    color: str(row["color"]),
    is_active: row["is_active"] !== false,
    created_at: str(row["created_at"]),
  };
}

function toDocument(row: Row): DriverDocument {
  return {
    id: String(row["id"]),
    restaurant_id: String(row["restaurant_id"] ?? ""),
    driver_id: String(row["driver_id"] ?? ""),
    document_type: str(row["document_type"]) ?? "id_card",
    file_path: str(row["file_path"]),
    document_number: str(row["document_number"]),
    expires_at: str(row["expires_at"]),
    created_at: str(row["created_at"]),
  };
}

/** RLS already scopes every read to the caller's restaurant; the explicit filter keeps the query plan tenant-scoped, like fetchCustomers. */
export async function fetchDrivers(restaurantId: string): Promise<AdminDriver[]> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toDriver);
}

export async function fetchDriver(driverId: string): Promise<AdminDriver | null> {
  const { data, error } = await supabase.from("driver_profiles").select("*").eq("id", driverId).maybeSingle();
  if (error) throw error;
  return data ? toDriver(data as unknown as Row) : null;
}

/** Only the fields the admin UI is allowed to edit -- status transitions of an in-flight delivery stay owned by the dispatch engine. */
export type DriverUpdate = Partial<Pick<AdminDriver, "full_name" | "phone" | "notes" | "is_active">>;

export async function updateDriver(driverId: string, patch: DriverUpdate): Promise<void> {
  const { error } = await supabase.from("driver_profiles").update(patch).eq("id", driverId);
  if (error) throw error;
}

/**
 * Suspend / reinstate. Suspension is deliberately only applied when the
 * driver isn't mid-delivery, so we never yank a driver out from under an
 * active course; reinstating drops them back to 'offline' and lets them go
 * available themselves from the driver app.
 */
export async function setDriverSuspended(driverId: string, suspended: boolean): Promise<void> {
  const query = supabase
    .from("driver_profiles")
    .update({ status: suspended ? "suspended" : "offline", is_active: !suspended })
    .eq("id", driverId);
  const { error } = suspended ? await query.in("status", ["available", "offline", "suspended"]) : await query;
  if (error) throw error;
}

/** Creates the real Supabase Auth account + driver_profiles row server-side (service_role is never exposed to the browser). */
export async function createDriverAccount(payload: {
  restaurant_id: string;
  full_name: string;
  phone: string;
  email: string;
  password: string;
  notes?: string | null;
}): Promise<{ driver_id: string }> {
  const { data, error } = await supabase.functions.invoke("admin-create-driver", {
    body: { action: "create", ...payload },
  });
  if (error) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message ?? error.message ?? "Impossible de créer le livreur.");
  }
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
  return data as { driver_id: string };
}

export async function resetDriverPassword(driverId: string, newPassword: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-create-driver", {
    body: { action: "reset_password", driver_id: driverId, new_password: newPassword },
  });
  if (error) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message ?? error.message ?? "Impossible de réinitialiser le mot de passe.");
  }
  if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error);
}

/* ---------------------------------------------------------------- vehicles */

export async function fetchVehicles(restaurantId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toVehicle);
}

export async function fetchDriverVehicles(driverId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toVehicle);
}

export type VehicleInput = {
  restaurant_id: string;
  driver_id: string | null;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  plate_number: string | null;
  color: string | null;
  is_active: boolean;
};

export async function createVehicle(input: VehicleInput): Promise<void> {
  const { error } = await supabase.from("vehicles").insert(input);
  if (error) throw error;
}

export async function updateVehicle(vehicleId: string, input: Partial<VehicleInput>): Promise<void> {
  const { error } = await supabase.from("vehicles").update(input).eq("id", vehicleId);
  if (error) throw error;
}

export async function deleteVehicle(vehicleId: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", vehicleId);
  if (error) throw error;
}

/* --------------------------------------------------------------- documents */

export async function fetchDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  const { data, error } = await supabase
    .from("driver_documents")
    .select("*")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toDocument);
}

/** driver-documents is a private bucket: files are only ever reachable through a short-lived signed URL. */
export async function signDocumentUrl(path: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from("driver-documents").createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadDriverDocumentFile(restaurantId: string, driverId: string, file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${restaurantId}/${driverId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("driver-documents").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export type DriverDocumentInput = {
  restaurant_id: string;
  driver_id: string;
  document_type: DriverDocumentType;
  file_path: string | null;
  document_number: string | null;
  expires_at: string | null;
};

export async function createDriverDocument(input: DriverDocumentInput): Promise<void> {
  const { error } = await supabase.from("driver_documents").insert(input);
  if (error) throw error;
}

export async function updateDriverDocument(documentId: string, input: Partial<DriverDocumentInput>): Promise<void> {
  const { error } = await supabase.from("driver_documents").update(input).eq("id", documentId);
  if (error) throw error;
}

export async function deleteDriverDocument(documentId: string): Promise<void> {
  const { error } = await supabase.from("driver_documents").delete().eq("id", documentId);
  if (error) throw error;
}

/* ----------------------------------------------------------------- history */

export async function fetchDriverHistory(driverId: string, limit = 50): Promise<DriverAssignment[]> {
  const { data, error } = await supabase
    .from("driver_assignment_history")
    .select("*, order:orders(order_number,status,total_amount,currency)")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<Row & { order?: Row | null }>).map((row) => ({
    id: String(row["id"]),
    driver_id: String(row["driver_id"] ?? ""),
    order_id: String(row["order_id"] ?? ""),
    assignment_type: str(row["assignment_type"]),
    created_at: str(row["created_at"]),
    order_number: num(row.order?.["order_number"]),
    order_status: str(row.order?.["status"]),
    total_amount: num(row.order?.["total_amount"]),
    currency: str(row.order?.["currency"]),
  }));
}

/* ------------------------------------------------------------------- stats */

export async function fetchFleetStats(restaurantId: string): Promise<FleetStats | null> {
  const { data, error } = await supabase.rpc("get_driver_fleet_stats", { p_restaurant_id: restaurantId });
  if (error) throw error;
  if (!data) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  if (!row) return null;
  return {
    total_drivers: num(row["total_drivers"]) ?? 0,
    active_drivers: num(row["active_drivers"]) ?? 0,
    available_drivers: num(row["available_drivers"]) ?? 0,
    delivering_drivers: num(row["delivering_drivers"]) ?? 0,
    suspended_drivers: num(row["suspended_drivers"]) ?? 0,
    deliveries_today: num(row["deliveries_today"]) ?? 0,
    deliveries_total: num(row["deliveries_total"]) ?? 0,
  };
}

/**
 * Manual assignment. The RPC is the ONLY write path -- it owns the order
 * update, the driver status transition and the assignment history row,
 * exactly like the automatic dispatch does. The frontend never touches
 * `orders` directly for assignment.
 */
export async function assignDriverToOrder(orderId: string, driverId: string): Promise<void> {
  const { error } = await supabase.rpc("assign_driver_to_order", { p_order_id: orderId, p_driver_id: driverId });
  if (error) throw error;
}
