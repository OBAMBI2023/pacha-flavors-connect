/**
 * SAOVIA Partner runtime -- public entry point.
 *
 * Phase 2: connection/ -- tracks the realtime link to SAOVIA.
 * Phase 3: presence/ -- heartbeat freshness (piggybacked on the existing
 * updateDriverLocation() push, no second timer) and derived ONLINE/STALE/
 * OFFLINE presence, layered on top of connection/ and the existing
 * driver_status business state.
 * Phase 4: useDriverProposals.ts (src/hooks/) gained dev logging and a
 * catch-up refresh keyed off connection/ -- no new module here, the
 * existing hook was the right owner.
 * Phase 5: notifications/ -- Web Push subscribe/unsubscribe, triggered only
 * from the existing "Devenir disponible" toggle in livreur.tsx.
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

export {
  subscribe as subscribeToPush,
  unsubscribe as unsubscribeFromPush,
  getSubscription as getPushSubscription,
} from "@/partner-runtime/notifications/pushManager";

export type { PushSubscriptionState } from "@/partner-runtime/notifications/notificationTypes";
