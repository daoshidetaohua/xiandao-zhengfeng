// 仙道争锋 — Service Worker v3
// 全网络优先，保证最新代码
const CACHE_NAME = 'xiandao-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // 全部网络优先，失败才读缓存
  event.respondWith(
    fetch(event.request).then(function(response) {
      // 成功就缓存
      var resClone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(event.request, resClone);
      });
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
