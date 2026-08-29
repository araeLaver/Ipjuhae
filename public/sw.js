/* 입주해 service worker — offline fallback only.
 * API/auth 요청은 절대 캐시하지 않는다. 페이지는 network-first,
 * 실패 시 오프라인 안내(/offline)를 보여준다. */
const CACHE = 'ipjuhae-v1'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/app-icon-256.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r || Response.error())
      )
    )
  }
})
