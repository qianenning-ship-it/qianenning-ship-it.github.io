/* SmartDoc OCR CDN cache. Do not cache app.html so Pages deploys still update. */
const CACHE = "smartdoc-ocr-v1";
const HOSTS = ["cdn.jsdelivr.net", "unpkg.com", "zxc88645.github.io"];
const HINT = /onnx|wasm|ffocr|tesseract|ppocr|ort-wasm|ocr-web|chi_sim|traineddata/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  const cacheable = HOSTS.indexOf(url.hostname) >= 0 || HINT.test(url.pathname + url.search);
  if (!cacheable) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) {
        try { await cache.put(req, res.clone()); } catch (e) { /* quota */ }
      }
      return res;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  })());
});
