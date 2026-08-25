/**
 * SAOVIA Partner runtime -- public entry point.
 *
 * Phase 2: connection/ -- tracks the realtime link to SAOVIA.
 * Phase 3: presence/ -- heartbeat freshness (piggybacked on the existing
 * updateDriverLocation() push, no second timer) and derived ONLINE/STALE/
 * OFFLINE presence, layered on top of connection/ and the existing
 * driver_status business state.
 * Later: notifications/ (Web Push), exported from here the same way once built.
 */
export {
  ConnectionManager,
  partnerConnectionManager,
  usePartnerConnectionState,
  type PartnerConnectionState,
  type ConnectionManagerEvent,
} from "@/partner-runtime/connection/connectionManager";

export {
  driverHeartbeat,
  useDriverHeartbeat,
  LOCATION_PUSH_INTERVAL_ACTIVE_MS,
  LOCATION_PUSH_INTERVAL_IDLE_MS,
} from "@/partner-runtime/presence/driverHeartbeat";

export {
  derivePresence,
  inferDriverBusinessStatus,
  useDriverRuntimeStatus,
  type DriverRuntimeStatus,
} from "@/partner-runtime/presence/presenceManager";

export type {
  DriverBusinessStatus,
  DerivedPresence,
  HeartbeatFreshness,
  HeartbeatSnapshot,
} from "@/partner-runtime/presence/presenceTypes";
