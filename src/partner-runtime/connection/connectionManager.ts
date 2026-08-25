import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ReconnectScheduler } from "@/partner-runtime/connection/reconnect";

/**
 * App-level network state for the SAOVIA Partner runtime. Deliberately
 * separate from business/presence state (driver_profiles.status --
 * offline/available/proposed/busy/delivering, already in the schema) -- see
 * PartnerState in ../presence for that half. This state machine answers
 * only "is the realtime channel to SAOVIA alive", never "is this partner
 * open for missions".
 */
export type PartnerConnectionState = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "RECONNECTING";

export type ConnectionManagerEvent = {
  state: PartnerConnectionState;
  attempt: number;
};

type Listener = (event: ConnectionManagerEvent) => void;

/**
 * After this many consecutive failed (re)connect attempts (~= running the
 * full 1..60s backoff table more than once, several minutes of continuous
 * failure), the manager gives up and settles on DISCONNECTED instead of
 * scheduling another retry. `start()` resumes trying from scratch.
 */
const MAX_RECONNECT_ATTEMPTS = 8;

function devLog(state: PartnerConnectionState, attempt: number): void {
  if (!import.meta.env.DEV) return;
  // Matches the "[SAOVIA_RUNTIME]\nkey=value" shape from the spec -- one
  // line is friendlier in a real devtools console, same information.
  console.info(`[SAOVIA_RUNTIME] connection=${state}${attempt > 0 ? ` attempt=${attempt}` : ""}`);
}

/**
 * Owns exactly one Supabase Realtime channel, used purely as a heartbeat on
 * the shared socket (`supabase`'s single WebSocket, multiplexed across every
 * channel in the app -- this adds no new connection, no new server). Maps
 * that channel's subscribe-status lifecycle to the 4-state machine below,
 * and is the single place in the app allowed to retry it.
 *
 * Framework-agnostic on purpose (no React import except for the optional
 * `usePartnerConnection` hook at the bottom) so the same shape can back a
 * future AndroidPartnerRuntime (see Phase 9 notes) without a rewrite.
 */
export class ConnectionManager {
  private state: PartnerConnectionState = "DISCONNECTED";
  private channel: RealtimeChannel | null = null;
  private readonly scheduler = new ReconnectScheduler();
  private readonly listeners = new Set<Listener>();
  private started = false;
  /** True only while intentionally torn down via stop() -- distinguishes "we closed this" from "the socket dropped on us" so the CLOSED status doesn't get misread as a failure worth retrying. */
  private stopping = false;

  getState(): PartnerConnectionState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Idempotent -- calling start() while already started/connecting is a no-op. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    this.scheduler.reset();
    this.openChannel();
  }

  /** Tears down the channel and stops any pending retry. Safe to call repeatedly. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.stopping = true;
    this.scheduler.cancel();
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.setState("DISCONNECTED", 0);
  }

  private setState(next: PartnerConnectionState, attempt: number): void {
    if (this.state === next) return;
    this.state = next;
    devLog(next, attempt);
    for (const listener of this.listeners) listener({ state: next, attempt });
  }

  private openChannel(): void {
    this.setState(
      this.scheduler.attemptCount > 0 ? "RECONNECTING" : "CONNECTING",
      this.scheduler.attemptCount,
    );

    // Unique topic per attempt -- a channel object is cached by topic on the
    // client, so re-subscribing the *same* topic after a CLOSED/error can
    // hand back a stale, already-torn-down channel instead of a fresh one
    // (same reasoning as useRealtimeOrders.ts's per-mount random suffix).
    const topic = `partner-runtime-connection-${Math.random().toString(36).slice(2)}`;
    const channel = supabase.channel(topic, { config: { broadcast: { self: false } } });
    this.channel = channel;

    channel.subscribe((status) => {
      if (this.channel !== channel) return; // a newer attempt has already replaced this one

      if (status === "SUBSCRIBED") {
        this.scheduler.reset();
        this.setState("CONNECTED", 0);
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.handleDrop();
        return;
      }

      if (status === "CLOSED") {
        // Only a failure worth retrying if *we* didn't ask for the close.
        if (!this.stopping) this.handleDrop();
      }
    });
  }

  private handleDrop(): void {
    if (!this.started) return;
    // Null this.channel BEFORE removeChannel(), not after: removeChannel()
    // can synchronously re-fire this same channel's own subscribe callback
    // with status "CLOSED" (the underlying phx_close binding runs
    // synchronously), which would otherwise still see `this.channel ===
    // channel`, skip the "a newer attempt already replaced this one" guard,
    // and re-enter handleDrop() -> removeChannel() -> ... recursively until
    // the call stack overflows. Nulling first makes that re-entrant call a
    // clean no-op instead.
    const droppedChannel = this.channel;
    this.channel = null;
    if (droppedChannel) void supabase.removeChannel(droppedChannel);

    if (this.scheduler.attemptCount >= MAX_RECONNECT_ATTEMPTS) {
      this.scheduler.cancel();
      this.setState("DISCONNECTED", this.scheduler.attemptCount);
      this.started = false;
      return;
    }

    this.setState("RECONNECTING", this.scheduler.attemptCount);
    this.scheduler.schedule(() => {
      if (this.started) this.openChannel();
    });
  }
}

/**
 * One connection manager per browser tab -- every consumer (the future
 * livreur.tsx status pill, notifications, observability) shares the same
 * state instead of each opening its own heartbeat channel.
 */
export const partnerConnectionManager = new ConnectionManager();

/**
 * React adapter. Purely a state subscription -- it does NOT call start()/
 * stop() itself, so mounting a component that reads connection state can
 * never accidentally tear down another consumer's still-active connection.
 * Whichever integration owns the partner session lifecycle (Phase 6) is
 * responsible for calling partnerConnectionManager.start()/stop().
 */
export function usePartnerConnectionState(): PartnerConnectionState {
  return useSyncExternalStore(
    (onStoreChange) => partnerConnectionManager.subscribe(onStoreChange),
    () => partnerConnectionManager.getState(),
    () => "DISCONNECTED",
  );
}
