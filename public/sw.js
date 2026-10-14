// ============================================================================
// Morning Weather 8AM - Service Worker (public/sw.js)
// Web Push 알림 수신 및 알림 클릭 시 앱 오픈/포커스 처리
// ============================================================================

self.addEventListener("install", (event) => {
  // 새 서비스 워커를 대기 없이 즉시 활성화
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 활성화된 즉시 모든 클라이언트 제어권 획득
  event.waitUntil(self.clients.claim());
});

// Web Push 이벤트 수신 핸들러
self.addEventListener("push", (event) => {
  let payload = {
    title: "☀️ 모닝 웨더 8AM 브리핑",
    body: "오늘의 날씨 정보가 도착했습니다. 탭하여 확인하세요!",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: "morning-weather-briefing",
    url: "/",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
      };
    } catch (err) {
      // JSON 파싱 실패 시 텍스트 그대로 본문에 사용
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag || "morning-weather-briefing",
    renotify: true,
    requireInteraction: false,
    vibrate: [150, 80, 150],
    data: {
      url: payload.url || "/",
      timestamp: Date.now(),
    },
    actions: [
      {
        action: "open",
        title: "상세 날씨 보기",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// 푸시 알림 클릭 시 앱 창 포커스 또는 새 창 오픈 처리
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열려 있는 탭이 있다면 포커스 이동
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        // 열려 있는 탭이 없다면 새 창 열기
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
