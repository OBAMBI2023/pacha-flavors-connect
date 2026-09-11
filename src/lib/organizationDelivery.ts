import { supabase } from "@/lib/supabase-any";
import type { Json } from "@/integrations/supabase/types";

export type DeliveryServiceLevel = "EXPRESS" | "SCHEDULED";
export type DeliveryStatus =
  | "pending"
  | "pending_pickup"
  | "assigned_pickup"
  | "picked_up"
  | "ready_for_delivery"
  | "assigned_delivery"
  | "in_transit"
  | "delivered"
  | "delivery_failed"
  | "cancelled"
  | "returned";

export type PickupPoint = {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizationDelivery = {
  id: string;
  organization_id: string;
  order_id: string;
  external_reference: string | null;
  delivery_provider: string;
  status: DeliveryStatus;
  customer_name: string;
  customer_phone: string;
  pickup_name: string;
  pickup_phone: string;
  pickup_address: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  destination_name: string;
  destination_phone: string;
  destination_address: string;
  destination_latitude: number | null;
  destination_longitude: number | null;
  package_description: string | null;
  package_weight: number | null;
  package_quantity: number;
  assigned_pickup_agent_id: string | null;
  assigned_delivery_agent_id: string | null;
  metadata: Json;
  service_level: DeliveryServiceLevel;
  scheduled_pickup_at: string | null;
  declared_value: number | null;
  cod_amount: number | null;
  delivery_instructions: string | null;
  pickup_point_id: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
  delivery_fee_calculation_method: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryStatusHistoryEntry = {
  id: string;
  from_status: DeliveryStatus | null;
  to_status: DeliveryStatus;
  note: string | null;
  created_at: string;
};

/** Mirrors signup_organization's own server-side normalization -- this copy is only for UX preview (e.g. showing the slug before submit), the RPC's own normalization is the actual source of truth. */
export function slugifyOrganizationName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Creates the organization + owner membership in one atomic call. Caller must already have a live Supabase Auth session (signUp/signIn done client-side first). */
export async function signupOrganization(name: string, slug: string): Promise<{ organization_id: string; slug: string }> {
  const { data, error } = await supabase.rpc("signup_organization", { p_name: name, p_slug: slug });
  if (error) throw error;
  return data as unknown as { organization_id: string; slug: string };
}

export type DeliveryQuote = {
  delivery_fee: number;
  delivery_distance_km: number | null;
  delivery_fee_calculation_method: string;
  service_level: DeliveryServiceLevel;
  indicative: true;
};

/** Read-only price preview -- never the source of truth, create_delivery always recomputes server-side. */
export async function quoteDelivery(input: {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  serviceLevel: DeliveryServiceLevel;
}): Promise<DeliveryQuote> {
  const { data, error } = await supabase.rpc("quote_delivery", {
    p_pickup_lat: input.pickupLat,
    p_pickup_lng: input.pickupLng,
    p_destination_lat: input.destinationLat,
    p_destination_lng: input.destinationLng,
    p_service_level: input.serviceLevel,
  } as never);
  if (error) throw error;
  return data as unknown as DeliveryQuote;
}

export type CreateDeliveryInput = {
  organizationId: string;
  orderId: string;
  externalReference?: string | undefined;
  customerName: string;
  customerPhone: string;
  pickupName: string;
  pickupPhone: string;
  pickupAddress: string;
  pickupLatitude?: number | undefined;
  pickupLongitude?: number | undefined;
  destinationName: string;
  destinationPhone: string;
  destinationAddress: string;
  destinationLatitude?: number | undefined;
  destinationLongitude?: number | undefined;
  packageDescription?: string | undefined;
  packageWeight?: number | undefined;
  packageQuantity: number;
  serviceLevel: DeliveryServiceLevel;
  scheduledPickupAt?: string | undefined;
  declaredValue?: number | undefined;
  codAmount?: number | undefined;
  deliveryInstructions?: string | undefined;
  pickupPointId?: string | undefined;
};

export type CreateDeliveryResult = {
  delivery_id: string;
  organization_id: string;
  order_id: string;
  status: DeliveryStatus;
  delivery_provider: string;
  service_level: DeliveryServiceLevel;
  scheduled_pickup_at: string | null;
  delivery_fee: number;
  delivery_distance_km: number | null;
  delivery_fee_calculation_method: string;
};

/** The final price in the result is always server-computed -- create_delivery never accepts a client-supplied fee. */
export async function createDelivery(input: CreateDeliveryInput): Promise<CreateDeliveryResult> {
  const { data, error } = await supabase.rpc("create_delivery", {
    p_organization_id: input.organizationId,
    p_order_id: input.orderId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_pickup_name: input.pickupName,
    p_pickup_phone: input.pickupPhone,
    p_pickup_address: input.pickupAddress,
    p_destination_name: input.destinationName,
    p_destination_phone: input.destinationPhone,
    p_destination_address: input.destinationAddress,
    p_external_reference: input.externalReference ?? null,
    p_pickup_latitude: input.pickupLatitude ?? null,
    p_pickup_longitude: input.pickupLongitude ?? null,
    p_destination_latitude: input.destinationLatitude ?? null,
    p_destination_longitude: input.destinationLongitude ?? null,
    p_package_description: input.packageDescription ?? null,
    p_package_weight: input.packageWeight ?? null,
    p_package_quantity: input.packageQuantity,
    p_service_level: input.serviceLevel,
    p_scheduled_pickup_at: input.scheduledPickupAt ?? null,
    p_declared_value: input.declaredValue ?? null,
    p_cod_amount: input.codAmount ?? null,
    p_delivery_instructions: input.deliveryInstructions ?? null,
    p_pickup_point_id: input.pickupPointId ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as CreateDeliveryResult;
}

export async function listOrganizationDeliveries(organizationId: string): Promise<OrganizationDelivery[]> {
  const { data, error } = await supabase.rpc("list_organization_deliveries", { p_organization_id: organizationId });
  if (error) throw error;
  return (data ?? []) as unknown as OrganizationDelivery[];
}

export async function getOrganizationDelivery(deliveryId: string): Promise<OrganizationDelivery | null> {
  const { data, error } = await supabase.rpc("get_organization_delivery", { p_delivery_id: deliveryId });
  if (error) throw error;
  return (data as unknown as OrganizationDelivery | null) ?? null;
}

export async function fetchDeliveryStatusHistory(deliveryId: string): Promise<DeliveryStatusHistoryEntry[]> {
  const { data, error } = await supabase
    .from("delivery_status_history")
    .select("id,from_status,to_status,note,created_at")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DeliveryStatusHistoryEntry[];
}

export async function listOrganizationPickupPoints(organizationId: string): Promise<PickupPoint[]> {
  const { data, error } = await supabase.rpc("list_organization_pickup_points", { p_organization_id: organizationId });
  if (error) throw error;
  return (data ?? []) as unknown as PickupPoint[];
}

export async function createPickupPoint(input: {
  organizationId: string;
  name: string;
  address: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  contactName?: string | undefined;
  contactPhone?: string | undefined;
}): Promise<PickupPoint> {
  const { data, error } = await supabase.rpc("create_pickup_point", {
    p_organization_id: input.organizationId,
    p_name: input.name,
    p_address: input.address,
    p_latitude: input.latitude ?? null,
    p_longitude: input.longitude ?? null,
    p_contact_name: input.contactName ?? null,
    p_contact_phone: input.contactPhone ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as PickupPoint;
}

/** Resolves the caller's own organization (the one they're an active member/owner of) -- mirrors useAuth's single-membership assumption, since a Phase 2B org owner has exactly one organization today. */
export async function fetchOwnOrganization(userId: string): Promise<{ id: string; name: string; slug: string } | null> {
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, organizations(id,name,slug)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as unknown as { organization_id: string; organizations: { id: string; name: string; slug: string } | null } | null;
  return row?.organizations ?? null;
}
