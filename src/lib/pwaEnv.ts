/**
 * Shared PWA-environment detection -- used by both the install prompt
 * (src/components/pwa/InstallPrompt.tsx) and the notification permission
 * card (src/components/notifications/NotificationPermissionCard.tsx), which
 * need the exact same "is this iOS Safari, not yet installed" gate. Kept in
 * its own module (rather than exported from a component file) so importing
 * these plain functions elsewhere doesn't break Vite Fast Refresh for the
 * component that first defined them.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIosDevice =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIosDevice;
}
