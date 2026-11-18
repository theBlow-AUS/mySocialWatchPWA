/* Local notification clicks only. No push handler, polling, tokens or user data. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const scope = self.registration.scope;
    const existing = windows.find(client => client.url.startsWith(scope));
    if (existing) await existing.focus();
    else await self.clients.openWindow(scope);
  })());
});
