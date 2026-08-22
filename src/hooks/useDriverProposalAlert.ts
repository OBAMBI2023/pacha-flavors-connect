import { useEffect } from "react";
import { startRingtoneLoop } from "@/lib/audioAlert";
import type { DriverPendingProposal } from "@/lib/delivery";

/**
 * Drives the audible/visual alert for an incoming proposal. Requests
 * Notification permission once, lazily. The ringtone loop is started and
 * stopped purely by whether `pendingProposal` is present -- since it
 * already becomes `null` on accept, refuse, and expiry alike (all three
 * flow through the same realtime-driven refresh in useDriverProposals),
 * the effect cleanup below stops the ringtone identically in every case,
 * with no separate "stop" logic required.
 */
export function useDriverProposalAlert(pendingProposal: DriverPendingProposal | null): void {
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!pendingProposal) return;

    const stopRingtone = startRingtoneLoop();

    // The ringtone is the primary, foreground-only alert -- a Notification
    // is only ever the backgrounded-tab fallback, and only fired once per
    // proposal (tag dedupes), never claiming to replace audio while the
    // tab is actually visible.
    if (
      document.visibilityState === "hidden" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification("Nouvelle course", {
        body: `${pendingProposal.restaurant_name} · Commande #${pendingProposal.order_number}`,
        tag: pendingProposal.proposal_id,
      });
    }

    return () => stopRingtone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on identity only, restarting per realtime-refetched object would glitch the tone
  }, [pendingProposal?.proposal_id]);
}
