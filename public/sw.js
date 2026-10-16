// Service worker : ouverture rapide, consultation hors connexion et notifications sur le téléphone.
// Les données (/api) et les photos (/uploads) ne sont jamais mises en cache ici.
const CACHE = "dac-v14";
const SHELL = ["/", "/index.html", "/css/style.css", "/js/content.js", "/js/api.js", "/js/app.js", "/img/logo.png", "/img/icon-192.png", "/img/badge-96.png", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/") || url.pathname === "/js/config.js") return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && !url.pathname.startsWith("/files/")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("/index.html") : Response.error()))));
});

// ---------- notifications ----------
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: "École de disciples", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "École de disciples";
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, { body: d.body || "", icon: "/img/icon-192.png", badge: "/img/badge-96.png", tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || "#/" }, vibrate: [80, 40, 80] }),
    (self.navigator && self.navigator.setAppBadge && d.badge) ? self.navigator.setAppBadge(d.badge).catch(() => {}) : Promise.resolve(),
  ]));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || "#/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (new URL(c.url).origin === location.origin) { c.postMessage({ type: "open", url: hash }); return c.focus(); } }
    return self.clients.openWindow("/" + hash);
  }));
});
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil(fetch("/api/push/key").then((r) => r.json()).then(({ key }) => {
    const pad = "=".repeat((4 - key.length % 4) % 4), raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
  }).then((sub) => fetch("/api/push/subscribe", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) })).catch(() => {}));
});
