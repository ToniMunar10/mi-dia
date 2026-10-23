// Mi Día — service worker
// The app shell is cached so the app opens without internet.
// data.json is always fetched fresh when online and falls back to the last copy offline.
const SHELL = "mi-dia-shell-v17";
const DATA = "mi-dia-data";
const CRESTS = "mi-dia-crests";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache so a new version never stores an old page
  e.waitUntil(caches.open(SHELL)
    .then(c => Promise.all(FILES.map(f => fetch(new Request(f, {cache: "reload"})).then(r => { if (r.ok) return c.put(f, r) }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA && k !== CRESTS).map(k => caches.delete(k))))
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

  // pages: network first (fresh version when online), cached copy offline
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put("./", copy)) } return res })
        .catch(() => caches.open(SHELL).then(c => c.match("./").then(r => r || c.match("./index.html"))))
    );
    return;
  }

  // team crests: cache first, stored the first time they are seen
  if (url.pathname.includes("/icons/escudos/")) {
    e.respondWith(caches.open(CRESTS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => { if (res.ok) c.put(e.request, res.clone()); return res }))));
    return;
  }

  // icons and manifest: cache first
  e.respondWith(caches.open(SHELL).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request))));
});
