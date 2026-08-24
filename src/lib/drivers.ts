import { supabase } from "@/integrations/supabase/client";

export type DriverStatus = "offline" | "available" | "proposed" | "busy" | "delivering" | "suspended";

export type Driver = {
  id: string;
  restaurant_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  phone_secondary: string | null;
  address: string | null;
  photo_path: string | null;
  date_of_birth: string | null;
  hired_at: string | null;
  internal_note: string | null;
  is_active: boolean;
  status: DriverStatus;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
  created_at: string;
  updated_at: string;
};

const DRIVER_COLUMNS =
  "id,restaurant_id,full_name,phone,email,phone_secondary,address,photo_path,date_of_birth,hired_at,internal_note,is_active,status,last_lat,last_lng,last_location_at,created_at,updated_at";

const PAGE_SIZE = 25;

/** Coarse bucket used for the admin filter pills/badges -- 'proposed' (mid-dispatch) folds into "En livraison" alongside 'delivering'; 'busy' is reserved and never actually set anywhere today. */
export type DriverStatusBucket = "available" | "on_delivery" | "offline" | "suspended";

export function driverStatusBucket(status: DriverStatus): DriverStatusBucket {
  if (status === "suspended") return "suspended";
  if (status === "available") return "available";
  if (status === "delivering" || status === "proposed" || status === "busy") return "on_delivery";
  return "offline";
}

export const DRIVER_STATUS_BUCKET_LABELS: Record<DriverStatusBucket, string> = {
  available: "Disponible",
  on_delivery: "En livraison",
  offline: "Hors ligne",
  suspended: "Suspendu",
};

export const DRIVER_STATUS_BUCKET_CLASSNAMES: Record<DriverStatusBucket, string> = {
  available: "bg-primary/10 text-primary",
  on_delivery: "bg-amber-100 text-amber-700",
  offline: "bg-muted text-muted-foreground",
  suspended: "bg-destructive/10 text-destructive",
};

export async function fetchDrivers(
  restaurantId: string,
  options: { search?: string; bucket?: DriverStatusBucket | "all"; page?: number } = {},
): Promise<{ drivers: Driver[]; total: number }> {
  const page = options.page ?? 0;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("driver_profiles").select(DRIVER_COLUMNS, { count: "exact" }).eq("restaurant_id", restaurantId);

  const search = options.search?.trim();
  if (search) {
    const digits = search.replace(/[^0-9]/g, "");
    const orParts = [`full_name.ilike.%${search}%`];
    orParts.push(digits ? `phone.ilike.%${digits}%` : `phone.ilike.%${search}%`);
    query = query.or(orParts.join(","));
  }

  if (options.bucket && options.bucket !== "all") {
    if (options.bucket === "available") query = query.eq("status", "available");
    else if (options.bucket === "on_delivery") query = query.in("status", ["delivering", "proposed", "busy"]);
    else if (options.bucket === "offline") query = query.eq("status", "offline");
    else if (options.bucket === "suspended") query = query.eq("status", "suspended");
  }

  const { data, error, count } = await query.order("full_name", { ascending: true }).range(from, to);
  if (error) throw error;
  return { drivers: (data ?? []) as unknown as Driver[], total: count ?? 0 };
}

export async function fetchDriver(driverId: string): Promise<Driver | null> {
  const { data, error } = await supabase.from("driver_profiles").select(DRIVER_COLUMNS).eq("id", driverId).maybeSingle();
  if (error) throw error;
  return (data as unknown as Driver | null) ?? null;
}

export type CreateDriverInput = {
  restaurant_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  phone_secondary?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  hired_at?: string | null;
  internal_note?: string | null;
};

export type CreateDriverResult = { driver_id: string; email_used: string; temp_password: string };

/** Calls the admin-create-driver Edge Function -- creates a real Supabase Auth account (drivers log in with email/password) plus the driver_profiles row in one step. The temp password is returned once and must be shown to the admin immediately; it is never retrievable again. */
export async function createDriver(input: CreateDriverInput): Promise<CreateDriverResult> {
  const { data, error } = await supabase.functions.invoke("admin-create-driver", { body: input });
  if (error) {
    const message = (data as { error?: string } | null)?.error ?? error.message;
    throw new Error(message);
  }
  return data as CreateDriverResult;
}

export async function updateDriver(
  driverId: string,
  input: Partial<
    Pick<Driver, "full_name" | "phone" | "phone_secondary" | "email" | "address" | "date_of_birth" | "hired_at" | "internal_note">
  >,
): Promise<void> {
  const { error } = await supabase.from("driver_profiles").update(input).eq("id", driverId);
  if (error) throw error;
}

export async function setDriverActive(driverId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("driver_profiles").update({ is_active: isActive }).eq("id", driverId);
  if (error) throw error;
}

export async function suspendDriver(driverId: string): Promise<void> {
  const { error } = await supabase.from("driver_profiles").update({ status: "suspended" }).eq("id", driverId);
  if (error) throw error;
}

/** Undoes a suspension -- back to 'available'. Reactivating a deactivated driver is a separate action (setDriverActive(id, true)); this only touches status. */
export async function unsuspendDriver(driverId: string): Promise<void> {
  const { error } = await supabase.from("driver_profiles").update({ status: "available" }).eq("id", driverId).eq("status", "suspended");
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export type VehicleType = "moto" | "scooter" | "voiture" | "tricycle" | "autre";

export type Vehicle = {
  id: string;
  restaurant_id: string;
  driver_id: string;
  vehicle_type: VehicleType;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  plate_number: string;
  chassis_number: string | null;
  photo_path: string | null;
  insurance_expires_at: string | null;
  inspection_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  moto: "Moto",
  scooter: "Scooter",
  voiture: "Voiture",
  tricycle: "Tricycle",
  autre: "Autre",
};

export type VehicleWithDriver = Vehicle & { driver_full_name: string };

export async function fetchVehicles(restaurantId: string, options: { driverId?: string } = {}): Promise<VehicleWithDriver[]> {
  let query = supabase
    .from("vehicles")
    .select("*, driver_profiles(full_name)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (options.driverId) query = query.eq("driver_id", options.driverId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, driver_full_name: row.driver_profiles?.full_name ?? "—" })) as VehicleWithDriver[];
}

export type VehicleInput = {
  driver_id: string;
  vehicle_type: VehicleType;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  plate_number: string;
  chassis_number?: string | null;
  photo_path?: string | null;
  insurance_expires_at?: string | null;
  inspection_expires_at?: string | null;
};

export async function createVehicle(restaurantId: string, input: VehicleInput): Promise<string> {
  const { data, error } = await supabase
    .from("vehicles")
    .insert({ restaurant_id: restaurantId, ...input })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateVehicle(vehicleId: string, input: Partial<VehicleInput>): Promise<void> {
  const { error } = await supabase.from("vehicles").update(input).eq("id", vehicleId);
  if (error) throw error;
}

export async function setVehicleActive(vehicleId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("vehicles").update({ is_active: isActive }).eq("id", vehicleId);
  if (error) throw error;
}

export function isDuplicateActiveVehicleError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("vehicles_one_active_per_driver");
}

// ---------------------------------------------------------------------------
// Documents (identity + license)
// ---------------------------------------------------------------------------

export type DriverDocumentKind = "identity" | "license";
export type IdentityDocumentType = "cni" | "passeport" | "carte_consulaire" | "autre";

export type DriverDocument = {
  id: string;
  restaurant_id: string;
  driver_id: string;
  kind: DriverDocumentKind;
  document_type: IdentityDocumentType | null;
  document_number: string | null;
  category: string | null;
  issued_at: string | null;
  expires_at: string | null;
  front_path: string | null;
  back_path: string | null;
  created_at: string;
  updated_at: string;
};

export const IDENTITY_DOCUMENT_TYPE_LABELS: Record<IdentityDocumentType, string> = {
  cni: "CNI",
  passeport: "Passeport",
  carte_consulaire: "Carte consulaire",
  autre: "Autre",
};

export type DocumentStatus = "valid" | "expiring_soon" | "expired" | "missing";

/**
 * ≤30 days out = "expiring soon", matching the brief's alert threshold.
 * `undefined` means no document row exists at all ("Manquant"); `null`
 * means the document exists but has no expiry date entered (nothing to
 * alert on, so "Valide").
 */
export function documentStatus(expiresAt: string | null | undefined): DocumentStatus {
  if (expiresAt === undefined) return "missing";
  if (expiresAt === null) return "valid";
  const days = (new Date(expiresAt).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_soon";
  return "valid";
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  valid: "Valide",
  expiring_soon: "Expire bientôt",
  expired: "Expiré",
  missing: "Manquant",
};

export const DOCUMENT_STATUS_CLASSNAMES: Record<DocumentStatus, string> = {
  valid: "bg-primary/10 text-primary",
  expiring_soon: "bg-amber-100 text-amber-700",
  expired: "bg-destructive/10 text-destructive",
  missing: "bg-muted text-muted-foreground",
};

export async function fetchDriverDocuments(driverId: string): Promise<DriverDocument[]> {
  const { data, error } = await supabase.from("driver_documents").select("*").eq("driver_id", driverId);
  if (error) throw error;
  return (data ?? []) as unknown as DriverDocument[];
}

/** Restaurant-wide, for the cross-driver "Documents" admin section. */
export async function fetchAllDriverDocuments(restaurantId: string): Promise<DriverDocument[]> {
  const { data, error } = await supabase.from("driver_documents").select("*").eq("restaurant_id", restaurantId);
  if (error) throw error;
  return (data ?? []) as unknown as DriverDocument[];
}

export type DriverDocumentInput = {
  driver_id: string;
  kind: DriverDocumentKind;
  document_type?: IdentityDocumentType | null;
  document_number?: string | null;
  category?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  front_path?: string | null;
  back_path?: string | null;
};

export async function upsertDriverDocument(restaurantId: string, input: DriverDocumentInput): Promise<string> {
  const { data, error } = await supabase
    .from("driver_documents")
    .upsert({ restaurant_id: restaurantId, ...input }, { onConflict: "driver_id,kind" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** Restaurant-wide set of driver ids with at least one expired document (identity/license) or vehicle document (insurance/inspection) -- backs the "Documents expirés" filter with two small queries instead of any N+1. */
export async function fetchDriverIdsWithExpiredDocuments(restaurantId: string): Promise<Set<string>> {
  const today = new Date().toISOString().slice(0, 10);
  const [docsRes, vehiclesRes] = await Promise.all([
    supabase.from("driver_documents").select("driver_id").eq("restaurant_id", restaurantId).lt("expires_at", today),
    supabase
      .from("vehicles")
      .select("driver_id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .or(`insurance_expires_at.lt.${today},inspection_expires_at.lt.${today}`),
  ]);
  if (docsRes.error) throw docsRes.error;
  if (vehiclesRes.error) throw vehiclesRes.error;
  const ids = new Set<string>();
  for (const row of docsRes.data ?? []) ids.add((row as { driver_id: string }).driver_id);
  for (const row of vehiclesRes.data ?? []) ids.add((row as { driver_id: string }).driver_id);
  return ids;
}

// ---------------------------------------------------------------------------
// Storage (private bucket -- signed URLs only, never getPublicUrl)
// ---------------------------------------------------------------------------

export const DRIVER_DOCUMENTS_BUCKET = "driver-documents";

export async function uploadDriverFile(
  restaurantId: string,
  driverId: string,
  kind: "profile" | "vehicle" | "documents",
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${restaurantId}/${driverId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(DRIVER_DOCUMENTS_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return path;
}

/** Private bucket -- reads must go through a short-lived signed URL, never getPublicUrl. */
export async function getDriverFileUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(DRIVER_DOCUMENTS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Assignment history
// ---------------------------------------------------------------------------

export type DriverAssignmentType = "automatic" | "manual";

export type DriverAssignmentHistoryEntry = {
  id: string;
  order_id: string;
  previous_driver_id: string | null;
  new_driver_id: string | null;
  assignment_type: DriverAssignmentType;
  performed_by: string | null;
  created_at: string;
  order_number: number | null;
  customer_name: string | null;
  order_status: string | null;
  previous_driver_name: string | null;
  new_driver_name: string | null;
};

export async function fetchDriverAssignmentHistory(
  restaurantId: string,
  options: { driverId?: string | undefined; assignmentType?: DriverAssignmentType | undefined; page?: number | undefined } = {},
): Promise<{ entries: DriverAssignmentHistoryEntry[]; total: number }> {
  const page = options.page ?? 0;
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("driver_assignment_history")
    .select(
      "id,order_id,previous_driver_id,new_driver_id,assignment_type,performed_by,created_at," +
        "orders(order_number,customer_name,status)," +
        "previous_driver:driver_profiles!driver_assignment_history_previous_driver_id_fkey(full_name)," +
        "new_driver:driver_profiles!driver_assignment_history_new_driver_id_fkey(full_name)",
      { count: "exact" },
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (options.driverId) query = query.or(`previous_driver_id.eq.${options.driverId},new_driver_id.eq.${options.driverId}`);
  if (options.assignmentType) query = query.eq("assignment_type", options.assignmentType);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  const entries = (data ?? []).map((row: any) => ({
    id: row.id,
    order_id: row.order_id,
    previous_driver_id: row.previous_driver_id,
    new_driver_id: row.new_driver_id,
    assignment_type: row.assignment_type,
    performed_by: row.performed_by,
    created_at: row.created_at,
    order_number: row.orders?.order_number ?? null,
    customer_name: row.orders?.customer_name ?? null,
    order_status: row.orders?.status ?? null,
    previous_driver_name: row.previous_driver?.full_name ?? null,
    new_driver_name: row.new_driver?.full_name ?? null,
  }));
  return { entries, total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Manual assignment + fleet stats
// ---------------------------------------------------------------------------

export async function assignDriverToOrder(orderId: string, driverId: string): Promise<void> {
  const { error } = await supabase.rpc("assign_driver_to_order", { p_order_id: orderId, p_driver_id: driverId });
  if (error) throw error;
}

export type DriverFleetStats = {
  restaurant_id: string;
  period: { start_date: string; end_date: string };
  driver_status_counts: { active: number; available: number; on_delivery: number; offline: number; suspended: number };
  period_totals: {
    total_deliveries: number;
    completed: number;
    cancelled: number;
    in_progress: number;
    avg_delivery_minutes: number | null;
    success_rate: number | null;
  };
  by_driver: Array<{
    driver_id: string;
    full_name: string;
    status: DriverStatus;
    total_deliveries: number;
    completed: number;
    cancelled: number;
    in_progress: number;
    today: number;
    avg_delivery_minutes: number | null;
    success_rate: number | null;
  }>;
};

export async function fetchDriverFleetStats(startDate: Date, endDate: Date): Promise<DriverFleetStats> {
  const toDateInputValue = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { data, error } = await supabase.rpc("get_driver_fleet_stats", {
    p_start_date: toDateInputValue(startDate),
    p_end_date: toDateInputValue(endDate),
  });
  if (error) throw error;
  return data as unknown as DriverFleetStats;
}
