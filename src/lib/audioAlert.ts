/**
 * Synthesized ringtone for the driver's incoming-proposal alert -- a plain
 * OscillatorNode beep, not a bundled audio file, so there's no binary asset
 * to ship or manage.
 *
 * Mobile browsers (iOS Safari, Android Chrome) refuse to run an
 * AudioContext until it's created/resumed inside a real user gesture --
 * `unlockAudioContext` is meant to be called from exactly one such gesture
 * handler. `startRingtoneLoop` never tries to bypass that: if the context
 * isn't unlocked yet, it's a no-op, and the caller is expected to fall back
 * to a different alert channel (browser Notification) instead of pretending
 * sound is playing.
 */

let ctx: AudioContext | null = null;

function getOrCreateContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function unlockAudioContext(): void {
  const context = getOrCreateContext();
  if (context && context.state === "suspended") {
    void context.resume().catch(() => {});
  }
}

export function isAudioContextUnlocked(): boolean {
  return ctx !== null && ctx.state === "running";
}

export function getAudioContext(): AudioContext | null {
  return ctx;
}

function beep(context: AudioContext): void {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.02);
  gain.gain.linearRampToValueAtTime(0, now + 0.25);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.25);
}

/**
 * Starts a repeating beep every ~1.2s. Returns a stop function that must be
 * called to end the loop -- there is no other way to stop it, matching the
 * requirement that the ringtone never keeps playing once a proposal is
 * accepted/refused/expired.
 */
export function startRingtoneLoop(): () => void {
  if (!isAudioContextUnlocked() || !ctx) {
    return () => {};
  }
  const context = ctx;
  beep(context);
  const intervalId = window.setInterval(() => beep(context), 1200);
  return () => window.clearInterval(intervalId);
}
