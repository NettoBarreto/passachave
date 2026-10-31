// Rede primeiro e cópia em cache como reserva: o app abre mesmo sem internet depois do primeiro acesso.
const CACHE = 'passachave-v1'
self.addEventListener('install', e => { self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()) })
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(e.request)
      .then(r => { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); return r })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./')))
  )
})
