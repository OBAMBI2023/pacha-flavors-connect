import { useEffect, useState } from "react";
import { getAudioContext, isAudioContextUnlocked, unlockAudioContext } from "@/lib/audioAlert";

/**
 * Mounts a single, one-shot gesture listener that unlocks the shared
 * AudioContext on the first real user interaction anywhere on the page --
 * the browser-autoplay-policy-compliant way to make audio available before
 * a proposal actually arrives, without ever trying to play sound before a
 * gesture has happened.
 */
export function useAudioUnlock(): boolean {
  const [unlocked, setUnlocked] = useState(() => isAudioContextUnlocked());

  useEffect(() => {
    if (unlocked) return;

    function onGesture() {
      unlockAudioContext();
      const context = getAudioContext();
      // resume() is async -- reflect the real state once it settles rather
      // than assuming it's immediately "running".
      context?.addEventListener("statechange", () => setUnlocked(isAudioContextUnlocked()));
      setUnlocked(isAudioContextUnlocked());
    }

    document.addEventListener("pointerdown", onGesture, { capture: true, once: true });
    return () => document.removeEventListener("pointerdown", onGesture, { capture: true });
  }, [unlocked]);

  return unlocked;
}
