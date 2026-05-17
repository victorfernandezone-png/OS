// Víctor OS — Service Worker
// Estrategia: Network-first para HTML (siempre sirve la versión más nueva),
// Cache-first para assets estáticos (iconos, fuentes).
// Cambia el número de versión cada vez que hagas un deploy para forzar actualización.
const CACHE_VERSION = 'victorOS-v3';
const STATIC_ASSETS = [
  './manifest.json'
  // NO cacheamos index.html aquí — siempre va a la red
];

// ── INSTALL: precachea solo assets estáticos ──────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()) // activa el nuevo SW inmediatamente
  );
});

// ── ACTIVATE: borra cachés de versiones anteriores ────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // toma control de todas las pestañas
  );
});

// ── FETCH: lógica diferenciada por tipo de recurso ────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ignora peticiones cross-origin (Google Fonts, CDNs, APIs)
  if (url.origin !== self.location.origin) return;

  // Para index.html y '/' → siempre red primero, caché solo si offline
  if (url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('index.html')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Para el resto (manifest, iconos) → caché primero
  e.respondWith(cacheFirst(e.request));
});

// Network-first: intenta la red, si falla usa caché
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request, { cache: 'no-store' });
    // Guarda en caché solo si la respuesta es válida
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    // Sin red — devuelve versión cacheada si existe
    const cached = await caches.match(request);
    return cached || new Response('Sin conexión', { status: 503 });
  }
}

// Cache-first: usa caché, si no existe va a la red
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Sin conexión', { status: 503 });
  }
}
