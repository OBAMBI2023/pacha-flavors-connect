import { useEffect, useRef } from "react";
import {
  usePartnerConnectionState,
  type PartnerConnectionState,
} from "@/partner-runtime/connection/connectionManager";
import { useDriverHeartbeat } from "@/partner-runtime/presence/driverHeartbeat";
import type {
  DerivedPresence,
  DriverBusinessStatus,
  HeartbeatSnapshot,
} from "@/partner-runtime/presence/presenceTypes";

/**
 * Combines three already-independent signals into one UI-facing presence
 * value. Pure function (no I/O, no React) so it's trivial to unit test in
 * Phase 7 and impossible to call from two competing places by accident.
 *
 * `driver_status` (business truth) is never derived FROM this -- this only
 * ever reads it, per Phase 3 section 6: connection state must never
 * automatically write driver_status.
 */
export function derivePresence(
  businessStatus: DriverBusinessStatus,
  connectionState: PartnerConnectionState,
  heartbeatFreshness: HeartbeatSnapshot["freshness"],
): DerivedPresence {
  if (businessStatus === "offline") return "OFFLINE";
  if (connectionState === "DISCONNECTED") return "OFFLINE";
  if (heartbeatFreshness === "offline") return "OFFLINE";
  if (
    heartbeatFreshness === "stale" ||
    connectionState === "CONNECTING" ||
    connectionState === "RECONNECTING"
  )
    return "STALE";
  return "ONLINE";
}

/**
 * Infers business status from data the driver dashboard already holds in
 * memory (useDriverProposals' pendingProposal/activeDelivery, the existing
 * `available` toggle) -- no new query, no new realtime subscription, and
 * never a second read of driver_profiles.status. This is a best-effort UI
 * reflection; dispatch's own server-side state remains authoritative.
 */
export function inferDriverBusinessStatus(input: {
  available: boolean;
  hasPendingProposal: boolean;
  hasActiveDelivery: boolean;
}): DriverBusinessStatus {
  if (input.hasActiveDelivery) return "delivering";
  if (input.hasPendingProposal) return "proposed";
  return input.available ? "available" : "offline";
}

export type DriverRuntimeStatus = {
  connectionState: PartnerConnectionState;
  presence: DerivedPresence;
  heartbeat: HeartbeatSnapshot;
  lastHeartbeatAt: number | null;
  secondsSinceHeartbeat: number | null;
};

/**
 * The Phase 3 "socle" for the driver UI: connectionState, presence,
 * lastHeartbeatAt, secondsSinceHeartbeat, all from one hook. Renders
 * nothing itself -- wiring an actual status pill onto this is a later
 * phase, per "ne pas encore refaire tout l'écran".
 */
export function useDriverRuntimeStatus(businessStatus: DriverBusinessStatus): DriverRuntimeStatus {
  const connectionState = usePartnerConnectionState();
  const heartbeat = useDriverHeartbeat();
  const presence = derivePresence(businessStatus, connectionState, heartbeat.freshness);

  const lastLoggedRef = useRef<DerivedPresence | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (lastLoggedRef.current === presence) return;
    lastLoggedRef.current = presence;
    console.info(`[SAOVIA_RUNTIME] presence=${presence.toLowerCase()}`);
  }, [presence]);

  return {
    connectionState,
    presence,
    heartbeat,
    lastHeartbeatAt: heartbeat.lastHeartbeatAt,
    secondsSinceHeartbeat: heartbeat.ageMs === null ? null : Math.floor(heartbeat.ageMs / 1000),
  };
}
