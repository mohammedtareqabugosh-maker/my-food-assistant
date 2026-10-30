const CACHE_NAME = "my-food-assistant-v6";
const FILES = ["./", "./index.html", "./food-supabase-sync.js", "./manifest.webmanifest", "./icons/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(FILES.map(async file => {
      try {
        const response = await fetch(file, { cache: "no-cache" });
        if (response.ok) await cache.put(file, response);
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("my-food-assistant-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        return (await caches.match("./index.html")) || Response.error();
      }
      return Response.error();
    }
  })());
});
