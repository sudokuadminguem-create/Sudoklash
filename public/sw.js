// Service worker of Sudoklash: makes the app installable and lets the solo mode start again
// without a connection. Nothing from /api/ is ever cached here — game state and answers always
// come from the server; offline grids are kept by the app itself (app/lib/offline-pack.ts).

const VERSION = "v2";
const SHELL = `sudoklash-shell-${VERSION}`;
const ASSETS = `sudoklash-assets-${VERSION}`;
const PRECACHE = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // One missing file must not block the installation of the worker.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("sudoklash-") && name !== SHELL && name !== ASSETS)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Fingerprinted build files never change: the cached copy is always right. */
const isImmutable = (path) => /^\/(assets|_next\/static)\//.test(path);

/** Same-origin file that is worth keeping for offline use. */
const isStaticFile = (path) =>
  isImmutable(path) || /\.(?:png|svg|ico|webp|woff2?|webmanifest|css|js)$/.test(path);

async function networkFirstPage(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).pathname === "/") cache.put("/", response.clone());
    return response;
  } catch (error) {
    // Offline: the app is a single page, so its last known shell serves every route.
    const cached = (await cache.match("/")) ?? (await cache.match(request));
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch((error) => {
      if (cached) return cached;
      throw error;
    });
  return cached ?? fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  if (request.mode === "navigate") event.respondWith(networkFirstPage(request));
  else if (isImmutable(url.pathname)) event.respondWith(cacheFirst(request));
  else if (isStaticFile(url.pathname)) event.respondWith(staleWhileRevalidate(request));
});

// Prepare assets fetched before the first worker took control. Never cache API or external data.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREPARE_OFFLINE" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((value) => {
    try {
      const url = new URL(value);
      return (
        url.origin === self.location.origin &&
        isStaticFile(url.pathname) &&
        !url.pathname.startsWith("/api/") &&
        url.pathname !== "/sw.js"
      );
    } catch {
      return false;
    }
  });
  event.waitUntil(
    caches.open(ASSETS).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});
