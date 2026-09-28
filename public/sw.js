// Offline support for the Pre-Plan App.
//
// The app-shell cache holds ONLY same-origin application code (HTML, JS, CSS,
// fonts, icons). It must never store data: Supabase API responses, auth
// responses, and photos all live on *.supabase.co (a different origin) and are
// blocked by RULE 1; same-origin data requests are blocked by RULE 2.
//
// Any future OFFLINE building-data store must use a cache name that does NOT
// start with "preplan-cache" (e.g. "preplan-data-v1"), so that the sign-out
// wipe in AuthProvider.js deletes it while leaving this shell intact.
const CACHE_NAME = "preplan-cache-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

// The only request destinations that count as cacheable app CODE. A data
// request (fetch/XHR) has destination "" and is therefore never cached.
const CACHEABLE_DESTINATIONS = ["document", "script", "style", "font", "image", "worker", "manifest"];

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

// Store a response in the shell cache only if it is a successful, same-origin
// ("basic") response. Opaque/cross-origin responses are refused here too.
function saveToShell(request, response) {
  if (!response || !response.ok || response.type !== "basic") return;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // RULE 1 — Never touch cross-origin requests. Supabase API, auth, and photo
  // storage all live on a different origin, so they can never enter the cache.
  if (url.origin !== self.location.origin) return;

  // RULE 2 — Only same-origin APP CODE may be cached. Data-shaped requests
  // (destination "") fall through to the network and are never stored.
  if (!CACHEABLE_DESTINATIONS.includes(request.destination)) return;

  // Whole pages: network-first so content stays fresh, cache as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          saveToShell(request, response);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/")) || Response.error();
        })
    );
    return;
  }

  // Static code assets: saved copy first for speed, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fromNetwork = fetch(request)
        .then((response) => {
          saveToShell(request, response);
          return response;
        })
        .catch(() => cached);
      return cached || fromNetwork;
    })
  );
});
