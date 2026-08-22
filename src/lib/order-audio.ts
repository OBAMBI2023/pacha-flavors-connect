const CHIME_SRC = "/sounds/new-order.wav";
const SOUND_PREF_KEY = "saovia:order-sound-enabled";
const REPEAT_INTERVAL_MS = 2_000;

let audioEl: HTMLAudioElement | null = null;
let unlocked = false;
let repeatTimer: ReturnType<typeof setInterval> | null = null;
let autoplayBlocked = false;
let blockedListener: (() => void) | null = null;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio(CHIME_SRC);
    audioEl.preload = "auto";
  }
  return audioEl;
}

/**
 * Creates and starts fetching the chime element as early as possible (e.g.
 * on dashboard mount) so the audio bytes are already in the browser's cache
 * by the time a real order arrives -- without this, the *first* chime of a
 * session pays for the network fetch, which is what reads as "slow to
 * start". Safe to call regardless of whether the tenant has sound enabled.
 */
export function preloadOrderAudio(): void {
  getAudioEl();
}

/**
 * Registers a callback fired (at most once per autoplay-blocked streak) when
 * the browser rejects a programmatic `.play()` call -- lets the UI surface a
 * one-time "click to enable sound" hint instead of failing silently forever.
 */
export function setAutoplayBlockedListener(fn: (() => void) | null): void {
  blockedListener = fn;
}

export function getSoundPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_PREF_KEY) === "true";
}

export function setSoundPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_PREF_KEY, enabled ? "true" : "false");
}

/**
 * Must run inside a real user gesture (click handler) the first time the
 * restaurateur turns alerts on -- browsers block `.play()` before that. A
 * silent play+immediate pause on the same element "unlocks" it so later,
 * fully programmatic calls (from a Realtime callback) succeed.
 */
export async function unlockOrderAudio(): Promise<void> {
  if (unlocked) return;
  const el = getAudioEl();
  try {
    el.muted = true;
    await el.play();
    el.pause();
    el.currentTime = 0;
    el.muted = false;
    unlocked = true;
  } catch {
    // Autoplay still blocked (e.g. no real gesture) -- next explicit play
    // attempt will simply fail silently, which is fine, not fatal.
  }
}

async function playOnce(): Promise<void> {
  const el = getAudioEl();
  try {
    el.currentTime = 0;
    await el.play();
    autoplayBlocked = false;
  } catch {
    // Autoplay policy, no user gesture yet, etc -- surface it once instead
    // of failing silently on every repeat tick.
    if (!autoplayBlocked) {
      autoplayBlocked = true;
      blockedListener?.();
    }
  }
}

/**
 * Starts playing the new-order chime and repeats it indefinitely at a fixed
 * interval until `stopOrderChime` is called -- which must only happen when
 * the tenant explicitly accepts or refuses the order, never merely from
 * opening/viewing it or closing a notification panel. Never overlaps
 * multiple simultaneous chimes even if several orders arrive in quick
 * succession or the caller re-triggers while already looping: restarting
 * just resets the same single timer/element.
 */
export function playNewOrderChime(): void {
  if (!getSoundPreference()) return;
  stopOrderChime();
  void playOnce();
  repeatTimer = setInterval(() => {
    void playOnce();
  }, REPEAT_INTERVAL_MS);
}

/** One-shot playback for the "test sound" control -- never repeats. */
export async function playTestChime(): Promise<void> {
  await unlockOrderAudio();
  await playOnce();
}

export function stopOrderChime(): void {
  if (repeatTimer) {
    clearInterval(repeatTimer);
    repeatTimer = null;
  }
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
}
