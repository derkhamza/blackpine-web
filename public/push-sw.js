/* Web-push handlers, imported into the generated Workbox service worker via
   `workbox.importScripts` (see vite.config.ts). Kept as a plain static file so we
   don't have to switch the PWA off its generateSW strategy. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "Blackpine";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: data.tag || "blackpine",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.focus(); if ("navigate" in w) { try { w.navigate(url); } catch (e) {} } return; }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
