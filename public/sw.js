const CACHE_NAME = 'twinlink-pwa-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
  '/pwa-icon.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Manejar recepción de archivos desde el menú Compartir de Android (Web Share Target API)
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const mediaFiles = formData.getAll('media');

          if (mediaFiles && mediaFiles.length > 0) {
            const cache = await caches.open('twinlink-shared-files');
            // Limpiar descargas compartidas anteriores
            const keys = await cache.keys();
            for (const key of keys) {
              await cache.delete(key);
            }

            for (let i = 0; i < mediaFiles.length; i++) {
              const file = mediaFiles[i];
              if (file && file.name) {
                const response = new Response(file, {
                  headers: {
                    'x-file-name': encodeURIComponent(file.name),
                    'x-file-type': file.type || 'application/octet-stream'
                  }
                });
                await cache.put(`/shared-file-${i}`, response);
              }
            }
          }
        } catch (err) {
          console.error('Error procesando archivos compartidos en SW:', err);
        }
        return Response.redirect('/?shared=true', 303);
      })()
    );
    return;
  }

  // Only handle GET requests, bypass for Supabase/Firestore real-time connections
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('supabase.co')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached and update in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      });
    })
  );
});
