import { useEffect } from "react";
import { startRingtoneLoop } from "@/lib/audioAlert";
import type { DriverPendingProposal } from "@/lib/delivery";

/**
 * Drives the audible/visual alert for an incoming proposal. No permission
 * request lives here -- that's requested contextually from the "Devenir
 * disponible" toggle in livreur.tsx, never blindly on mount. The ringtone
 * loop is started and stopped purely by whether `pendingProposal` is
 * present -- since it already becomes `null` on accept, refuse, and expiry
 * alike (all three flow through the same realtime-driven refresh in
 * useDriverProposals), the effect cleanup below stops the ringtone
 * identically in every case, with no separate "stop" logic required.
 */
export function useDriverProposalAlert(pendingProposal: DriverPendingProposal | null): void {
  useEffect(() => {
    if (!pendingProposal) return;

    const stopRingtone = startRingtoneLoop();

    // The ringtone is the primary, foreground-only alert -- a Notification
    // is only ever the backgrounded-tab fallback (page still alive, just
    // hidden), never claiming to replace audio while the tab is visible,
    // and never claiming to work with the screen locked / app fully
    // backgrounded -- that tier needs real Web Push (see the
    // push_subscriptions migration), not a page-context Notification.
    if (
      document.visibilityState === "hidden" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const notification = new Notification("🚴 Nouvelle course", {
        body: "Une nouvelle livraison vous est proposée.",
        tag: pendingProposal.proposal_id,
        data: {
          proposal_id: pendingProposal.proposal_id,
          order_id: pendingProposal.order_id,
          restaurant_id: pendingProposal.restaurant_id,
          restaurant_name: pendingProposal.restaurant_name,
          distance_km: pendingProposal.distance_km,
          amount: pendingProposal.total_amount,
          expires_at: pendingProposal.expires_at,
        },
      });
      // The page context that created this notification is, by definition,
      // already /livreur -- focusing the window is "reopen /livreur" here.
      // The "app not open at all" case is handled separately by sw-push.js's
      // notificationclick handler (clients.openWindow), unrelated to this.
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }

    return () => stopRingtone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on identity only, restarting per realtime-refetched object would glitch the tone
  }, [pendingProposal?.proposal_id]);
}
