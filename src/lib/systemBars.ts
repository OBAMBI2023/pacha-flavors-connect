import { useEffect } from "react";
import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

/**
 * Android status/navigation bar icon color for the native app (com.saovia.food),
 * chosen from the page background actually drawn behind the bars -- never from
 * the phone's own light/dark mode. The WebView runs edge-to-edge
 * (viewport-fit=cover), so the bars sit on top of our page; Capacitor's
 * SystemBars default ("DEFAULT") follows the phone's theme instead, which
 * gives white icons on our beige pages whenever the phone is in dark mode.
 *
 *   "light" = light background -> dark icons  (SystemBarsStyle.Light)
 *   "dark"  = dark background  -> white icons (SystemBarsStyle.Dark)
 *
 * Only changes icon appearance: insets/safe-area handling is untouched.
 * No-op in Chrome and the installed PWA (not a native platform).
 */
export type SystemBarsTone = "light" | "dark";

const DEFAULT_TONE: SystemBarsTone = "light";

// Every mounted useSystemBarsStyle() call, most recent last; the last one
// wins, and an empty list falls back to DEFAULT_TONE. React runs a child's
// effects before its parent's, so a page asking for "dark" mounts before the
// root's default sync -- resolving from this list (instead of each caller
// calling setStyle directly) keeps that ordering from ever overriding it.
const requests: { tone: SystemBarsTone }[] = [];
let appliedTone: SystemBarsTone | null = null;

function syncSystemBars(): void {
  if (!Capacitor.isNativePlatform()) return;
  const tone = requests[requests.length - 1]?.tone ?? DEFAULT_TONE;
  if (tone === appliedTone) return;
  appliedTone = tone;
  SystemBars.setStyle({
    style: tone === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch((error) => {
    // Let the next sync retry instead of believing this tone is applied.
    appliedTone = null;
    console.error("[system-bars] setStyle failed:", error);
  });
}

/** Mount once at the app root: applies the default "light" tone at startup
 * unless a page has already requested another one. */
export function useSystemBarsDefault(): void {
  useEffect(() => {
    syncSystemBars();
  }, []);
}

/** Requests a tone while the calling component is mounted (and while `tone`
 * keeps this value); the previous tone is restored on unmount/change. */
export function useSystemBarsStyle(tone: SystemBarsTone): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const request = { tone };
    requests.push(request);
    syncSystemBars();
    return () => {
      const index = requests.indexOf(request);
      if (index !== -1) requests.splice(index, 1);
      syncSystemBars();
    };
  }, [tone]);
}
