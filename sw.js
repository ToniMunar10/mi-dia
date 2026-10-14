// Mi Día — service worker
// The app shell is cached so the app opens without internet.
// data.json is always fetched fresh when online and falls back to the last copy offline.
const SHELL = "mi-dia-shell-v5";
const DATA = "mi-dia-data";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  if (url.pathname.endsWith("/data.json")) {
    // network first, cached copy when offline
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(DATA).then(c => c.put("data.json", copy)) } return res })
        .catch(() => caches.open(DATA).then(c => c.match("data.json")).then(r => r
          ? r.blob().then(b => new Response(b, {headers: {"content-type": "application/json", "x-mi-dia-cache": "1"}}))
          : Response.error()))
    );
    return;
  }

  // app shell: answer from cache at once, refresh it in the background
  e.respondWith(
    caches.open(SHELL).then(cache => cache.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res }).catch(() => hit);
      return hit || net;
    }))
  );
});
