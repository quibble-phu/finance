const cacheName = 'mymoney-v1';
const appShellFiles = [
    './',
    './index.html',
    './dashboard.html',
    './account.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
    self.skipWaiting();
    e.waitUntil((async () => {
        const cache = await caches.open(cacheName);
        console.log('[Service Worker] Caching all: app shell and content');
        await cache.addAll(appShellFiles);
    })());
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== cacheName) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // 🚨 กฎเหล็ก: ข้ามการ Cache ข้อมูลจาก Firebase Firestore, Auth และ Method ที่ไม่ใช่ GET
    if (e.request.url.includes('firestore.googleapis.com') ||
        e.request.url.includes('identitytoolkit.googleapis.com') ||
        e.request.url.includes('securetoken.googleapis.com') ||
        e.request.method !== 'GET') {
        return; // ปล่อยผ่านไปเลย ให้ต่อเน็ตตามปกติ
    }

    // สำหรับไฟล์อื่นๆ ให้ดึงจาก Cache ก่อน (รวมถึงไฟล์จาก CDN ด้วย)
    e.respondWith((async () => {
        const cachedResponse = await caches.match(e.request);
        if (cachedResponse) {
            return cachedResponse; // เจอใน Cache เอาไปใช้เลย
        }

        // ถ้าไม่เจอใน Cache ค่อยวิ่งไปโหลดจากเน็ต แล้วเอามาเซฟเก็บไว้
        try {
            const networkResponse = await fetch(e.request);
            // เซฟลง Cache เฉพาะ response ที่สมบูรณ์แบบ 200 หรือแบบ opaque (CDN แบบ no-cors)
            // ไฟล์ที่มีปัญหาหรือล้มเหลวจะไม่เซฟลง Cache
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                const cache = await caches.open(cacheName);
                cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
        } catch (error) {
            console.log('Fetch failed, offline mode:', error);
        }
    })());
});