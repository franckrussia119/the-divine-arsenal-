// Service worker : l'application s'ouvre vite et reste consultable hors connexion.
// Les données (/api) ne sont jamais mises en cache : elles viennent toujours du serveur.
const CACHE = "dac-v5";
const SHELL = ["/", "/index.html", "/css/style.css", "/js/content.js", "/js/api.js", "/js/app.js", "/img/logo.png", "/img/icon-192.png", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname === "/js/config.js") return;
  // réseau d'abord (toujours la dernière version), cache si pas de connexion
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && !url.pathname.startsWith("/files/")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === "navigate" ? caches.match("/index.html") : Response.error()))));
});
