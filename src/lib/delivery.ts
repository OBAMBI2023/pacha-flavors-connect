import { supabase } from "@/integrations/supabase/client";
import type { PaymentMethod, PaymentStatus } from "@/lib/orders-db";

export type DriverStatus = "offline" | "available" | "proposed" | "busy" | "delivering";
export type DeliveryProposalStatus = "pending" | "accepted" | "rejected" | "expired" | "cancelled";
export type DeliveryDispatchStatus = "not_started" | "searching" | "assigned" | "no_driver_available";
export type DriverDeliveryStatus =
  | "assigned"
  | "going_to_pickup"
  | "arrived_at_restaurant"
  | "collecting"
  | "collected"
  | "en_route"
  | "arrived_at_customer"
  | "cash_collection"
  | "payment_confirmed"
  | "delivered";

export type DriverProfile = {
  id: string;
  restaurant_id: string;
  full_name: string;
  phone: string;
  is_active: boolean;
  status: DriverStatus;
  last_lat: number | null;
  last_lng: number | null;
  last_location_at: string | null;
};

export type DeliveryProposal = {
  id: string;
  order_id: string;
  restaurant_id: string;
  driver_id: string;
  distance_km: number | null;
  status: DeliveryProposalStatus;
  sent_at: string;
  expires_at: string;
  responded_at: string | null;
};

/**
 * Curated payload from `get_driver_pending_proposal()` -- deliberately
 * excludes any customer data. Only the restaurant name, order number,
 * distance, and expiry are needed to accept or refuse. `restaurant_id` is
 * included solely to carry in the background-notification `data` payload
 * (per the notification spec), not for any client-side lookup.
 */
export type DriverPendingProposal = {
  proposal_id: string;
  order_id: string;
  order_number: number;
  restaurant_id: string;
  restaurant_name: string;
  distance_km: number | null;
  expires_at: string;
  total_amount: number;
  currency: string;
};

export type DriverActiveDeliveryItem = { product_name: string; quantity: number };

/** Curated payload from `get_driver_active_delivery()` -- customer contact/address only ever appears here, after assignment. */
export type DriverActiveDelivery = {
  order_id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_commune: string | null;
  fulfillment_type: "delivery" | "pickup";
  total_amount: number;
  currency: string;
  status: string;
  restaurant_name: string;
  items: DriverActiveDeliveryItem[];
  driver_delivery_status: DriverDeliveryStatus | null;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
};

/** The driver's own row -- RLS (driver_profiles_select_own) only ever lets this resolve `id = auth.uid()`. */
export async function fetchOwnDriverProfile(userId: string): Promise<DriverProfile | null> {
  const { data, error } = await supabase.from("driver_profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as unknown as DriverProfile | null;
}

/**
 * Driver-controlled availability toggle. Going 'offline' does not touch an
 * in-flight 'proposed'/'delivering' state -- a driver can't opt out from
 * under a proposal or an active delivery by flipping this.
 */
export async function setDriverAvailability(driverId: string, available: boolean): Promise<void> {
  const { error } = await supabase
    .from("driver_profiles")
    .update({ status: available ? "available" : "offline" })
    .eq("id", driverId)
    .in("status", ["available", "offline"]);
  if (error) throw error;
}

export async function updateDriverLocation(driverId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase
    .from("driver_profiles")
    .update({ last_lat: lat, last_lng: lng, last_location_at: new Date().toISOString() })
    .eq("id", driverId);
  if (error) throw error;
}

/** Tenant-side read of a driver's last known position -- RLS (driver_profiles_select_tenant_staff) already scopes this to the caller's own restaurant. */
export async function fetchDriverPosition(
  driverId: string,
): Promise<{ lat: number | null; lng: number | null; last_location_at: string | null }> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("last_lat,last_lng,last_location_at")
    .eq("id", driverId)
    .maybeSingle();
  if (error) throw error;
  return { lat: data?.last_lat ?? null, lng: data?.last_lng ?? null, last_location_at: data?.last_location_at ?? null };
}

/** null when the restaurant hasn't been geocoded yet -- never invented, same defensive shape as the dispatch engine's own coords check. */
export async function fetchRestaurantCoordinates(restaurantId: string): Promise<{ lat: number; lng: number } | null> {
  const { data, error } = await supabase.from("restaurants").select("lat,lng").eq("id", restaurantId).maybeSingle();
  if (error) throw error;
  return data?.lat != null && data?.lng != null ? { lat: data.lat, lng: data.lng } : null;
}

/** Reuses the same per-restaurant setting the dispatch engine already uses for "is this position fresh enough" -- one source of truth. */
export async function fetchDriverLocationFreshnessMinutes(restaurantId: string): Promise<number> {
  const { data } = await supabase
    .from("restaurant_settings")
    .select("driver_location_freshness_minutes")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data?.driver_location_freshness_minutes ?? 5;
}

export async function fetchDriverPendingProposal(): Promise<DriverPendingProposal | null> {
  const { data, error } = await supabase.rpc("get_driver_pending_proposal");
  if (error) throw error;
  return (data as unknown as DriverPendingProposal | null) ?? null;
}

export async function fetchDriverActiveDelivery(): Promise<DriverActiveDelivery | null> {
  const { data, error } = await supabase.rpc("get_driver_active_delivery");
  if (error) throw error;
  return (data as unknown as DriverActiveDelivery | null) ?? null;
}

export async function respondToProposal(
  proposalId: string,
  accept: boolean,
): Promise<{ proposal_id: string; status: string; order_id?: string }> {
  const { data, error } = await supabase.rpc("driver_respond_to_proposal", { p_proposal_id: proposalId, p_accept: accept });
  if (error) throw error;
  return data as unknown as { proposal_id: string; status: string; order_id?: string };
}

/**
 * The only way `driver_delivery_status` ever moves forward -- the RPC
 * enforces the full no-skip sequence and the cash-collection branch
 * server-side; this is a thin, unchecked wrapper.
 */
export async function advanceDeliveryStatus(
  orderId: string,
  newStatus: DriverDeliveryStatus,
): Promise<{ order_id: string; driver_delivery_status: DriverDeliveryStatus }> {
  const { data, error } = await supabase.rpc("driver_advance_delivery_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
  });
  if (error) throw error;
  return data as unknown as { order_id: string; driver_delivery_status: DriverDeliveryStatus };
}

/**
 * `amountReceived` is only ever audit metadata -- the RPC always charges
 * `orders.total_amount` server-side, never a client-supplied figure.
 */
export async function confirmCashPayment(
  orderId: string,
  amountReceived: number | null,
): Promise<{ order_id: string; payment_status: PaymentStatus; driver_delivery_status: DriverDeliveryStatus }> {
  const { data, error } = await supabase.rpc(
    "driver_confirm_cash_payment",
    amountReceived === null ? { p_order_id: orderId } : { p_order_id: orderId, p_amount_received: amountReceived },
  );
  if (error) throw error;
  return data as unknown as { order_id: string; payment_status: PaymentStatus; driver_delivery_status: DriverDeliveryStatus };
}

export async function reportDeliveryIssue(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("driver_report_delivery_issue", { p_order_id: orderId, p_reason: reason });
  if (error) throw error;
}

/**
 * Tenant-side dashboard read: the most recent relevant (pending or accepted)
 * proposal per order, joined with the driver's name. RLS
 * (delivery_proposals_select_tenant_staff / driver_profiles_select_tenant_staff)
 * scopes this to the caller's own restaurant.
 */
export type DispatchProposalWithDriver = DeliveryProposal & { driver_name: string };

export async function fetchActiveProposalsForRestaurant(restaurantId: string): Promise<DispatchProposalWithDriver[]> {
  const { data, error } = await supabase
    .from("delivery_proposals")
    .select("*, driver:driver_profiles(full_name)")
    .eq("restaurant_id", restaurantId)
    .in("status", ["pending", "accepted"])
    .order("sent_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Array<DeliveryProposal & { driver: { full_name: string } | null }>).map((row) => ({
    ...row,
    driver_name: row.driver?.full_name ?? "Livreur",
  }));
}
