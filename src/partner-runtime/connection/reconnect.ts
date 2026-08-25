/**
 * Pure exponential-backoff scheduler -- no Supabase/network code here on
 * purpose, so it can be unit-tested in isolation (Phase 7) and reused by
 * anything in partner-runtime that needs a single, owned retry timer.
 *
 * This does NOT wrap or replace `@supabase/realtime-js`'s own socket-level
 * reconnection: connectionManager.ts owns exactly one RealtimeChannel and
 * uses this scheduler to decide when to re-create/re-subscribe *that*
 * channel after it errors out. There is deliberately only ever one timer
 * alive at a time (`schedule()` always cancels any previous one first), so
 * this can never race a second reconnect loop.
 */

/** 1s, 2s, 4s, 8s, 16s, 30s, 60s -- then holds at 60s. */
export const BACKOFF_STEPS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 60_000] as const;

export function backoffDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), BACKOFF_STEPS_MS.length - 1);
  return BACKOFF_STEPS_MS[index] ?? 60_000;
}

export class ReconnectScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;

  /** Attempts completed so far (reset() brings this back to 0). */
  get attemptCount(): number {
    return this.attempt;
  }

  /**
   * Cancels any pending retry and schedules a new one at the next backoff
   * step. Always the single owner of `this.timer` -- a call while a timer is
   * already pending replaces it rather than stacking a second one.
   */
  schedule(callback: () => void): void {
    this.cancel();
    const delay = backoffDelayMs(this.attempt);
    this.attempt += 1;
    this.timer = setTimeout(callback, delay);
  }

  /** Call on a successful (re)connection -- next schedule() starts back at 1s. */
  reset(): void {
    this.attempt = 0;
    this.cancel();
  }

  cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
