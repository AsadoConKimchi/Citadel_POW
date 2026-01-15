/**
 * Citadel POW - Service Worker
 * iOS 17+ PWA Push 알림 및 캐싱 지원
 */

const CACHE_NAME = 'citadel-pow-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/api.js',
  '/js/app.js',
  '/js/utils.js',
  '/js/notification.js',
  '/js/storage.js',
  '/js/timer.js',
  '/js/ui.js',
  '/js/media.js',
  '/js/donation.js',
  '/js/discord.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// 설치 이벤트 - 정적 자원 캐싱
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // 즉시 활성화
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache install failed:', error);
      })
  );
});

// 활성화 이벤트 - 이전 캐시 정리
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // 모든 클라이언트 즉시 제어
        return self.clients.claim();
      })
  );
});

// fetch 이벤트 - 네트워크 우선, 캐시 폴백
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청은 항상 네트워크로
  if (url.pathname.startsWith('/api/') ||
      url.hostname !== self.location.hostname) {
    return;
  }

  // 정적 자원은 캐시 우선
  if (request.method === 'GET') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          // 캐시가 있으면 반환, 없으면 네트워크 요청
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              // 성공적인 응답은 캐시에 저장
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, responseClone);
                  });
              }
              return networkResponse;
            })
            .catch(() => {
              // 네트워크 실패 시 캐시 반환
              return cachedResponse;
            });

          // 캐시가 있으면 즉시 반환하고 백그라운드에서 업데이트
          return cachedResponse || fetchPromise;
        })
    );
  }
});

// Push 알림 수신
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = {
    title: 'Citadel POW',
    body: 'POW 알림',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'pow-notification',
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (error) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'pow-notification',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    renotify: true,
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
    },
    actions: [
      {
        action: 'open',
        title: '열기',
      },
      {
        action: 'close',
        title: '닫기',
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // 앱 열기 또는 포커스
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((clientList) => {
      // 이미 열린 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// 알림 닫기 처리
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// 백그라운드 동기화 (향후 확장용)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-donations') {
    event.waitUntil(syncDonations());
  }
});

// 기부 기록 동기화 (오프라인 지원용)
async function syncDonations() {
  try {
    // IndexedDB에서 미전송 기부 기록 가져오기
    // 구현 예정
    console.log('[SW] Syncing donations...');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// 주기적 동기화 (향후 확장용)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'check-timer') {
    event.waitUntil(checkTimerStatus());
  }
});

// 타이머 상태 확인 (백그라운드)
async function checkTimerStatus() {
  try {
    // localStorage에서 타이머 상태 확인
    // iOS PWA에서는 제한적으로 동작
    console.log('[SW] Checking timer status...');
  } catch (error) {
    console.error('[SW] Timer check failed:', error);
  }
}

// 예약된 알림 타이머 ID 저장
let scheduledNotificationTimer = null;

// 메시지 수신 (클라이언트 → SW)
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    // 기존 예약 취소
    if (scheduledNotificationTimer) {
      clearTimeout(scheduledNotificationTimer);
      scheduledNotificationTimer = null;
    }

    const { title, body, delay } = event.data;
    scheduledNotificationTimer = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        tag: 'pow-timer-complete',
      });
      scheduledNotificationTimer = null;
    }, delay);
    console.log(`[SW] 알림 예약됨: ${Math.round(delay / 1000)}초 후`);
  }

  // 알림 취소 (POW 조기 종료 시)
  if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
    if (scheduledNotificationTimer) {
      clearTimeout(scheduledNotificationTimer);
      scheduledNotificationTimer = null;
      console.log('[SW] 예약된 알림 취소됨');
    }
  }
});

console.log('[SW] Service Worker loaded');
