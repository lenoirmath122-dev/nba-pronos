// Service worker — rappels ciblés (Web Push, backlog "Rappels ciblés").
// Fichier JS brut servi tel quel depuis public/ (pas de bundling Next.js) :
// c'est une contrainte de la Push API, le service worker doit être un
// fichier statique atteignable à une URL fixe (/sw.js).
self.addEventListener("push", (event) => {
  let payload = { title: "NBA Pronos", body: "" };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // payload non-JSON : garde le titre/corps par défaut ci-dessus.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
