/**
 * Mirrors the `driver_status` Postgres enum (offline / available / proposed
 * / busy / delivering -- see supabase/migrations/20260827000000_phase7_driver_dispatch.sql).
 * This is a read-only client-side reflection for the runtime, never a
 * second source of truth: nothing in partner-runtime writes driver_status
 * directly except the existing setDriverAvailability() call already in
 * livreur.tsx, and proposed/busy/delivering only ever change server-side
 * via the dispatch RPCs.
 */
export type DriverBusinessStatus = "offline" | "available" | "proposed" | "busy" | "delivering";

/** Derived, UI-facing presence -- never persisted, never business truth. */
export type DerivedPresence = "ONLINE" | "STALE" | "OFFLINE";

/** "offline" here means "no recent heartbeat", distinct from DriverBusinessStatus's "offline". */
export type HeartbeatFreshness = "fresh" | "stale" | "offline";

export type HeartbeatSnapshot = {
  /** epoch ms of the last *successful* updateDriverLocation() call, or null if none yet this session. */
  lastHeartbeatAt: number | null;
  /** epoch ms of the last attempt (success or failure) -- lets the UI distinguish "never tried" from "tried and failed". */
  lastAttemptAt: number | null;
  /** now - lastHeartbeatAt in ms, or null if there has never been a successful heartbeat. */
  ageMs: number | null;
  freshness: HeartbeatFreshness;
};
