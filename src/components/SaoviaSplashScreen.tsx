import { useEffect, useState } from "react";

/**
 * Hard safety cap: the splash always disappears by this point, even if
 * hydration is slow or something else goes wrong -- it must never stay
 * stuck on screen.
 */
const MAX_VISIBLE_MS = 2500;
/** Minimum time the splash stays up so the fade+scale entrance is actually
 * seen instead of flashing away the instant hydration completes (this app's
 * initial route data is already resolved server-side, so hydration alone
 * would otherwise hide it almost instantly). */
const MIN_VISIBLE_MS = 300;
/** Must match the exit transition's Tailwind `duration-*` class below. */
const EXIT_TRANSITION_MS = 300;

/**
 * Global PWA launch splash: full-screen, white, the official SAOVIA Food
 * mark (/favicon.png) centered with a fade+scale entrance. Mounted once at
 * the app root (see __root.tsx's RootComponent) so it only ever shows on the
 * very first load of the app -- TanStack Router's client-side navigation
 * never remounts the root, so it never reappears between routes.
 */
export function SaoviaSplashScreen() {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);

  // Two rAFs so the browser has actually painted the initial (opacity-0,
  // scaled-down) state before switching to the entered state -- otherwise
  // the transition has nothing to animate from.
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    const readyTimer = setTimeout(() => setExiting(true), MIN_VISIBLE_MS);
    const safetyTimer = setTimeout(() => setExiting(true), MAX_VISIBLE_MS);
    return () => {
      clearTimeout(readyTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => setRemoved(true), EXIT_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [exiting]);

  if (removed) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-300 ease-out ${
        exiting ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <img
        src="/favicon.png"
        alt="SAOVIA Food"
        width={160}
        height={160}
        className={`h-32 w-32 object-contain transition-all duration-500 ease-out sm:h-40 sm:w-40 ${
          entered ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      />
    </div>
  );
}
