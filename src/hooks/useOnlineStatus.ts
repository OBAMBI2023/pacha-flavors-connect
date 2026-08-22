import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  // Always "online" for SSR and the first client render -- Node exposes a
  // bare `navigator` global (no `.onLine`), so reading it during the
  // initializer would render the offline banner on every server-rendered
  // page and mismatch the client's real hydration output. Corrected
  // immediately after mount, client-side only.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
