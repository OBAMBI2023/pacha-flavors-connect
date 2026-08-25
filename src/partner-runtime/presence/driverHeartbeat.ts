import { useEffect, useState } from "react";
import type {
  HeartbeatFreshness,
  HeartbeatSnapshot,
} from "@/partner-runtime/presence/presenceTypes";

/**
 * Canonical home for the location-push cadence -- previously two local
 * consts in livreur.tsx. Moved here (livreur.tsx now imports them) so the
 * freshness thresholds below are derived from the exact same numbers that
 * drive the push loop, instead of a second, possibly-drifting copy.
 */
export const LOCATION_PUSH_INTERVAL_ACTIVE_MS = 15_000;
export const LOCATION_PUSH_INTERVAL_IDLE_MS = 45_000;

/** Fresh up to 2x the slower (idle) cadence -- tolerates one missed tick plus GPS/network jitter without flapping to STALE on every push. */
const FRESH_THRESHOLD_MS = LOCATION_PUSH_INTERVAL_IDLE_MS * 2;
/** Beyond this, a heartbeat that stopped arriving is treated as gone rather than merely late. */
const OFFLINE_THRESHOLD_MS = 5 * 60_000;

function classify(ageMs: number | null): HeartbeatFreshness {
  if (ageMs === null) return "offline";
  if (ageMs <= FRESH_THRESHOLD_MS) return "fresh";
  if (ageMs <= OFFLINE_THRESHOLD_MS) return "stale";
  return "offline";
}

type Listener = () => void;

/**
 * Pure client-side bookkeeping around the EXISTING updateDriverLocation()
 * calls in livreur.tsx's pushLocation() -- record*() methods only ever
 * store a timestamp, they never call Supabase themselves. This is not a
 * second heartbeat: nothing here triggers a geolocation read or a network
 * write; livreur.tsx still owns that, this module just observes it.
 *
 * The one timer this class owns (below) does no I/O -- it only re-notifies
 * subscribers every 5s so a mounted UI's `secondsSinceHeartbeat` can tick
 * up between pushes instead of looking frozen. It starts on first
 * subscriber and stops on last unsubscribe, so it can never outlive every
 * consumer (no phantom timer).
 */
class DriverHeartbeatTracker {
  private lastHeartbeatAt: number | null = null;
  private lastAttemptAt: number | null = null;
  private lastLoggedFreshness: HeartbeatFreshness | null = null;
  private readonly listeners = new Set<Listener>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /** Call right before attempting a location push (success or not is unknown yet). */
  recordAttempt(): void {
    this.lastAttemptAt = Date.now();
    this.recompute();
  }

  /** Call once updateDriverLocation() has actually resolved successfully. */
  recordSuccess(atMs: number = Date.now()): void {
    this.lastHeartbeatAt = atMs;
    this.lastAttemptAt = atMs;
    if (import.meta.env.DEV) console.info("[SAOVIA_RUNTIME] heartbeat=success");
    this.recompute();
  }

  /** Call when geolocation or updateDriverLocation() failed. lastHeartbeatAt is deliberately left untouched -- freshness ages naturally instead of jumping to "offline" on a single blip. */
  recordFailure(): void {
    this.recompute();
  }

  getSnapshot(): HeartbeatSnapshot {
    const ageMs = this.lastHeartbeatAt === null ? null : Date.now() - this.lastHeartbeatAt;
    return {
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastAttemptAt: this.lastAttemptAt,
      ageMs,
      freshness: classify(ageMs),
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    this.ensureTicking();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopTicking();
    };
  }

  private ensureTicking(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => this.recompute(), 5_000);
  }

  private stopTicking(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /** Recomputes freshness, logs only on an actual transition (never spammed every tick), then notifies subscribers. */
  private recompute(): void {
    const { freshness } = this.getSnapshot();
    if (import.meta.env.DEV && freshness !== this.lastLoggedFreshness && freshness === "stale") {
      console.info("[SAOVIA_RUNTIME] heartbeat=stale");
    }
    this.lastLoggedFreshness = freshness;
    for (const listener of this.listeners) listener();
  }
}

/** One tracker per browser tab -- every screen that reads heartbeat state shares it instead of tracking its own copy. */
export const driverHeartbeat = new DriverHeartbeatTracker();

export function useDriverHeartbeat(): HeartbeatSnapshot {
  const [snapshot, setSnapshot] = useState<HeartbeatSnapshot>(() => driverHeartbeat.getSnapshot());
  useEffect(() => {
    setSnapshot(driverHeartbeat.getSnapshot());
    return driverHeartbeat.subscribe(() => setSnapshot(driverHeartbeat.getSnapshot()));
  }, []);
  return snapshot;
}
