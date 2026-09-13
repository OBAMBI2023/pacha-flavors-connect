import { useEffect, useRef, useState } from "react";
import { buildWhatsAppUrl, SAOVIA_SUPPORT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

const DEFAULT_MESSAGE = "Bonjour SAOVIA 👋 Je souhaite avoir des informations.";

/**
 * Floating click-to-WhatsApp button for the public SAOVIA Food site
 * (food.saovia.net / "/"). Reuses the app's single WhatsApp helper
 * (buildWhatsAppUrl + SAOVIA_SUPPORT_WHATSAPP_NUMBER, see src/lib/whatsapp.ts)
 * instead of hardcoding a number or a different URL format -- that helper
 * already handles international numbers correctly (never blindly prepends
 * 225 to a number that already carries its own dial code).
 *
 * All motion is timeboxed (never a permanently-running loop) and skipped
 * entirely under prefers-reduced-motion, detected client-side only so the
 * server-rendered markup and the first client render match exactly (no
 * hydration mismatch/console warning).
 */
export function WhatsAppFloatingButton({
  phone = SAOVIA_SUPPORT_WHATSAPP_NUMBER,
  message = DEFAULT_MESSAGE,
}: {
  phone?: string;
  message?: string;
}) {
  const href = buildWhatsAppUrl(phone, message);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [entrance, setEntrance] = useState<"idle" | "pulse" | "bounce">("idle");
  const [ringing, setRinging] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Entrance sequence: a couple of gentle pulses right after mount, then one
  // small bounce once the page has settled -- both one-shot, never repeating.
  useEffect(() => {
    if (reducedMotion) return;
    setEntrance("pulse");
    const toBounce = setTimeout(() => setEntrance("bounce"), 1600);
    const toIdle = setTimeout(() => setEntrance("idle"), 2400);
    return () => {
      clearTimeout(toBounce);
      clearTimeout(toIdle);
    };
  }, [reducedMotion]);

  // Idle attention pulse: a brief ring every 8-12s, scheduled one timeout at a
  // time (not setInterval) so it never overlaps and stops cleanly on unmount.
  useEffect(() => {
    if (reducedMotion) return;
    let cancelled = false;
    const scheduleNext = () => {
      const delay = 8000 + Math.random() * 4000;
      idleTimeoutRef.current = setTimeout(() => {
        if (cancelled) return;
        setRinging(true);
        setTimeout(() => {
          if (!cancelled) setRinging(false);
        }, 1200);
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => {
      cancelled = true;
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [reducedMotion]);

  // Tooltip: appears once, 3s after mount, unless the visitor already closed it.
  useEffect(() => {
    if (tooltipDismissed) return;
    const t = setTimeout(() => setTooltipOpen(true), 3000);
    return () => clearTimeout(t);
  }, [tooltipDismissed]);

  return (
    <div
      className="fixed z-[100] bottom-[calc(20px+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6"
      role="complementary"
      aria-label="Contact WhatsApp"
    >
      {tooltipOpen && (
        <div className="absolute bottom-1/2 right-[calc(100%+12px)] flex translate-y-1/2 items-center">
          <div className="relative flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <span className="whitespace-nowrap">{"Besoin d'aide ? Écrivez-nous sur WhatsApp 👋"}</span>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => {
                setTooltipOpen(false);
                setTooltipDismissed(true);
              }}
              className="ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
            >
              ×
            </button>
            <span className="absolute left-full top-1/2 -translate-y-1/2 border-8 border-transparent border-l-white" aria-hidden="true" />
          </div>
        </div>
      )}

      {!reducedMotion && ringing && (
        <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/60" aria-hidden="true" />
      )}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Discuter avec SAOVIA sur WhatsApp"
        onClick={() => setTooltipOpen(false)}
        className={cn(
          "relative flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_20px_rgba(0,0,0,0.2)] outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#25D366] motion-safe:hover:scale-[1.08] motion-safe:active:scale-95",
          !reducedMotion && entrance === "pulse" && "motion-safe:animate-pulse",
          !reducedMotion && entrance === "bounce" && "motion-safe:animate-bounce",
        )}
      >
        <svg viewBox="0 0 32 32" className="h-8 w-8" fill="white" aria-hidden="true">
          <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.693 4.611 1.885 6.487L4 29l7.716-1.858A11.94 11.94 0 0 0 16.001 27C22.628 27 28 21.627 28 15S22.628 3 16.001 3zm0 21.8c-1.94 0-3.77-.51-5.36-1.4l-.384-.22-4.58 1.103 1.127-4.462-.25-.396A9.77 9.77 0 0 1 6.2 15c0-5.404 4.397-9.8 9.801-9.8 5.404 0 9.8 4.396 9.8 9.8 0 5.404-4.396 9.8-9.8 9.8zm5.36-7.34c-.294-.147-1.74-.858-2.01-.955-.27-.098-.467-.147-.664.147-.196.294-.76.955-.932 1.152-.171.196-.343.22-.637.073-.294-.147-1.24-.457-2.362-1.458-.873-.778-1.462-1.74-1.633-2.034-.171-.294-.018-.453.129-.6.132-.132.294-.343.44-.514.147-.171.196-.294.294-.49.098-.196.049-.368-.024-.514-.073-.147-.663-1.6-.909-2.192-.24-.577-.484-.5-.664-.51l-.566-.01c-.196 0-.514.073-.784.368-.27.294-1.03 1.007-1.03 2.456 0 1.45 1.055 2.85 1.202 3.046.147.196 2.077 3.172 5.034 4.447.703.303 1.252.484 1.68.62.706.225 1.348.193 1.855.117.566-.084 1.74-.712 1.985-1.4.245-.688.245-1.278.171-1.4-.073-.122-.27-.196-.564-.343z" />
        </svg>
      </a>
    </div>
  );
}
