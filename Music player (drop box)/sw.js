const CACHE_NAME = 'bgm-cache-v3'; // 更新到 v3

const ASSETS_TO_CACHE = [
    './',
    './index.html', 
    './manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim()); 
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 清除舊快取:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// 攔截網路請求：針對不同檔案給予「差別待遇」
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // 🛑 情況一：如果是我們自己網站的檔案 (index.html, manifest 等)
    // 策略：【網路優先 (Network First)】-> 確保永遠看到最新版網頁
    if (requestUrl.origin === location.origin) {
        event.respondWith(
            fetch(event.request).then((response) => {
                // 如果成功上網抓到新版，就順便更新快取
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            }).catch(() => {
                // 如果斷網了，就退而求其次拿快取裡的舊版來顯示
                return caches.match(event.request);
            })
        );
        return; // 結束這一回合
    }

    // 🛑 情況二：如果是外部網站的檔案 (例如 Dropbox 的音樂檔)
    // 策略：【快取優先 (Cache First)】-> 聽過一次就免流量
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                console.log('🎵 從快取讀取:', event.request.url);
                return cachedResponse;
            }

            return fetch(event.request).then((response) => {
                if (!response || (response.status !== 200 && response.type !== 'opaque')) {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                    console.log('💾 成功存入快取:', event.request.url);
                });
                return response;
            });
        }).catch(() => {
            console.log('連線失敗，且無快取可用。');
        })
    );
});