import { supabase } from "@/lib/supabase-any";
import type { DeliveryServiceLevel, DeliveryStatus } from "@/lib/organizationDelivery";

export type DeliveryOrigin = "RESTAURANT" | "HORS_RESTAURANT";

/** Row shape of list_deliveries_for_dispatch() -- Super Admin only. */
export type DispatchDelivery = {
  id: string;
  organization_id: string;
  organization_name: string;
  origin: DeliveryOrigin;
  delivery_provider: string;
  service_level: DeliveryServiceLevel;
  order_id: string;
  external_reference: string | null;
  status: DeliveryStatus;
  pickup_name: string;
  pickup_address: string;
  destination_name: string;
  destination_address: string;
  scheduled_pickup_at: string | null;
  delivery_fee: number | null;
  delivery_distance_km: number | null;
  delivery_fee_calculation_method: string | null;
  assigned_pickup_agent_id: string | null;
  assigned_pickup_agent_name: string | null;
  assigned_delivery_agent_id: string | null;
  assigned_delivery_agent_name: string | null;
  created_at: string;
};

/** Super Admin only -- filters are applied server-side, all optional. */
export async function listDeliveriesForDispatch(filters?: {
  origin?: DeliveryOrigin | undefined;
  serviceLevel?: DeliveryServiceLevel | undefined;
  status?: DeliveryStatus | undefined;
}): Promise<DispatchDelivery[]> {
  const { data, error } = await supabase.rpc("list_deliveries_for_dispatch", {
    p_origin: filters?.origin ?? null,
    p_service_level: filters?.serviceLevel ?? null,
    p_status: filters?.status ?? null,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as DispatchDelivery[];
}

/** Row shape of list_saovia_agents_for_dispatch() -- Super Admin only. Vehicle info deliberately omitted: a SAOVIA agent can never structurally have a vehicles row (restaurant_id is NOT NULL there). */
export type SaoviaAgentForDispatch = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  is_active: boolean;
  active_missions_count: number;
};

export async function listSaoviaAgentsForDispatch(): Promise<SaoviaAgentForDispatch[]> {
  const { data, error } = await supabase.rpc("list_saovia_agents_for_dispatch");
  if (error) throw error;
  return (data ?? []) as unknown as SaoviaAgentForDispatch[];
}

export type DeliveryAssignmentRole = "pickup" | "delivery";
export type SaoviaAssignmentAction = "confirm_pickup" | "start_delivery" | "confirm_delivery";

export type AssignAgentResult = {
  delivery_id: string;
  agent_id: string;
  role: DeliveryAssignmentRole;
  status: string;
  previous_agent_id: string | null;
};

/** Unchanged assign_agent_to_delivery() -- reserved to is_super_admin(), never touched by this feature. */
export async function assignAgentToDelivery(deliveryId: string, agentId: string, role: DeliveryAssignmentRole): Promise<AssignAgentResult> {
  const { data, error } = await supabase.rpc("assign_agent_to_delivery", {
    p_delivery_id: deliveryId,
    p_agent_id: agentId,
    p_role: role,
  } as never);
  if (error) throw error;
  return data as unknown as AssignAgentResult;
}

/** Row shape of get_agent_assigned_deliveries() -- scoped to the calling SAOVIA agent's own missions only. */
export type AgentAssignedDelivery = {
  assignment_id: string;
  id: string;
  origin: DeliveryOrigin;
  delivery_provider: string;
  service_level: DeliveryServiceLevel;
  order_id: string;
  status: "proposed" | "accepted" | "rejected" | "completed" | "cancelled";
  delivery_status: DeliveryStatus;
  pickup_name: string;
  pickup_address: string;
  destination_name: string;
  destination_address: string;
  scheduled_pickup_at: string | null;
  delivery_fee: number | null;
  delivery_fee_calculation_method: string | null;
  role: DeliveryAssignmentRole;
  created_at: string;
};

export async function fetchAgentAssignedDeliveries(): Promise<AgentAssignedDelivery[]> {
  const { data, error } = await supabase.rpc("get_agent_assigned_deliveries");
  if (error) throw error;
  return (data ?? []) as unknown as AgentAssignedDelivery[];
}

export async function acceptSaoviaAssignment(assignmentId: string): Promise<{
  assignment_id: string;
  delivery_id: string;
  status: string;
  delivery_status: DeliveryStatus;
  role: DeliveryAssignmentRole;
}> {
  const { data, error } = await supabase.rpc("driver_accept_saovia_assignment" as never, { p_assignment_id: assignmentId } as never);
  if (error) throw error;
  return data as unknown as {
    assignment_id: string;
    delivery_id: string;
    status: string;
    delivery_status: DeliveryStatus;
    role: DeliveryAssignmentRole;
  };
}

export async function rejectSaoviaAssignment(assignmentId: string): Promise<{
  assignment_id: string;
  delivery_id: string;
  status: string;
  role: DeliveryAssignmentRole;
}> {
  const { data, error } = await supabase.rpc("driver_reject_saovia_assignment" as never, { p_assignment_id: assignmentId } as never);
  if (error) throw error;
  return data as unknown as {
    assignment_id: string;
    delivery_id: string;
    status: string;
    role: DeliveryAssignmentRole;
  };
}

export async function advanceSaoviaDelivery(
  assignmentId: string,
  action: SaoviaAssignmentAction,
): Promise<{
  assignment_id: string;
  delivery_id: string;
  delivery_status: DeliveryStatus;
  assignment_status: string;
  role: DeliveryAssignmentRole;
  action: SaoviaAssignmentAction;
}> {
  const { data, error } = await supabase.rpc("driver_advance_saovia_delivery" as never, {
    p_assignment_id: assignmentId,
    p_action: action,
  } as never);
  if (error) throw error;
  return data as unknown as {
    assignment_id: string;
    delivery_id: string;
    delivery_status: DeliveryStatus;
    assignment_status: string;
    role: DeliveryAssignmentRole;
    action: SaoviaAssignmentAction;
  };
}
