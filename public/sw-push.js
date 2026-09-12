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

  const title = typeof payload.title === "string" ? payload.title : "SAOVIA Food";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // Matches the foreground Notification's own `tag` (the proposal id, set
    // in useDriverProposalAlert.ts, or the notification_events.id for the
    // general notification engine) so the OS coalesces the two into one
    // visible notification instead of showing both.
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url: typeof payload.url === "string" ? payload.url : "/" },
    // Tenant "nouvelle commande" alert only -- a plain array here is simply
    // ignored by platforms/browsers that don't support the Notification
    // vibrate option (no error, no feature check needed), so this never
    // needs to gate on capability detection itself.
    ...(payload.type === "NEW_ORDER" ? { vibrate: [200, 100, 200] } : {}),
  };

  // The notification engine (send-notification) already broadcasts the same
  // event over Realtime, which a focused tab renders as an in-app toast --
  // showing the OS notification too on top of that would be exactly the
  // "toast + notification système inutile" duplicate the notification
  // engine spec calls out. Only suppressed when a client is both open AND
  // focused (a backgrounded/hidden tab still gets the system notification,
  // same as before); any failure of this check just falls back to always
  // showing it, never the other way around.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => clients.some((client) => client.focused))
      .catch(() => false)
      .then((hasFocusedClient) => {
        if (hasFocusedClient) return;
        return self.registration.showNotification(title, options);
      }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
