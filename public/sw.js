// Offline support for the Pre-Plan App.
//
// Pages  : try the network first, fall back to the saved copy when there is
//          no signal, so crews always get something on screen.
// Assets : serve the saved copy immediately for speed, and quietly refresh
//          it in the background while there is signal.
//
// Requests to Supabase are left alone entirely (different origin), so logging
// in and loading data always talk to the real server when signal exists.
const CACHE_NAME = "preplan-cache-v2";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function saveToCache(request, response) {
  if (!response || !response.ok || response.type === "opaque") return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Whole pages: network first so content stays fresh when signal exists.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          saveToCache(request, response);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/")) || Response.error();
        })
    );
    return;
  }

  // Scripts, styles, icons: saved copy first, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fromNetwork = fetch(request)
        .then((response) => {
          saveToCache(request, response);
          return response;
        })
        .catch(() => cached);

      return cached || fromNetwork;
    })
  );
});
