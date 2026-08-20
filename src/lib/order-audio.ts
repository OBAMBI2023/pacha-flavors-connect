const CHIME_SRC = "/sounds/new-order.wav";
const SOUND_PREF_KEY = "saovia:order-sound-enabled";
const REPEAT_INTERVAL_MS = 12_000;
const MAX_REPEATS = 5;

let audioEl: HTMLAudioElement | null = null;
let unlocked = false;
let repeatTimer: ReturnType<typeof setInterval> | null = null;
let repeatCount = 0;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio(CHIME_SRC);
    audioEl.preload = "auto";
  }
  return audioEl;
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
  } catch {
    // Ignore playback failures (autoplay policy, no user gesture yet, etc).
  }
}

/**
 * Starts playing the new-order chime and repeats it at a fixed interval,
 * capped at MAX_REPEATS, until `stopOrderChime` is called (order accepted,
 * refused, or otherwise acknowledged). Never overlaps multiple simultaneous
 * chimes even if several orders arrive in quick succession -- restarting the
 * repeat loop just resets the same single timer/element.
 */
export function playNewOrderChime(): void {
  if (!getSoundPreference()) return;
  stopOrderChime();
  repeatCount = 0;
  void playOnce();
  repeatTimer = setInterval(() => {
    repeatCount += 1;
    if (repeatCount >= MAX_REPEATS) {
      stopOrderChime();
      return;
    }
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
  repeatCount = 0;
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
  }
}
