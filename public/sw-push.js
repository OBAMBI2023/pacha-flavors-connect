// Push-notification handler, spliced into the generated service worker via
// vite-plugin-pwa's `workbox.importScripts`. Wired up for real as of Phase 5
// (SAOVIA Partner runtime): supabase/functions/send-push sends this shape
// after a new delivery_proposals row appears (see
// supabase/migrations/20260825201401_delivery_proposals_notify_push_trigger.sql).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = typeof payload.title === "string" ? payload.title : "Le Pacha Restaurant";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Matches the foreground Notification's own `tag` (the proposal id, set
    // in useDriverProposalAlert.ts) so the OS coalesces the two into one
    // visible notification instead of showing both.
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url: typeof payload.url === "string" ? payload.url : "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
