/* global importScripts, firebase, clients */
// Service worker для web-push (FCM). Конфиг Firebase передаётся в query-строке
// при регистрации (SW не видит process.env). Мажор firebase-compat здесь должен
// совпадать с мажором пакета `firebase` в приложении (сейчас 10.x).
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
);

const params = new URLSearchParams(self.location.search);
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (
  config.apiKey &&
  config.projectId &&
  config.messagingSenderId &&
  config.appId
) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // Пуш, когда вкладка неактивна/закрыта → системное уведомление
  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || "Veda Service";
    const body = (payload.notification && payload.notification.body) || "";
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: payload.data || {},
      tag: (payload.data && payload.data.id) || undefined,
    });
  });
}

// Клик по уведомлению → фокус существующей вкладки или открытие deep-link
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Локаль берём из уже открытой вкладки (по умолчанию ru)
      let locale = "ru";
      for (const client of windows) {
        const match = new URL(client.url).pathname.match(/^\/(ru|en|uz)(\/|$)/);
        if (match) {
          locale = match[1];
          break;
        }
      }

      // Deep-link: явный url, либо по типу события (напр. тикеты)
      let path = data.url;
      if (!path) {
        if (data.type === "ticket" && data.id) {
          path = `/${locale}/tickets/${data.id}`;
        } else {
          path = `/${locale}`;
        }
      }

      const isAbsolute = /^https?:\/\//i.test(path);

      // Фокус первой same-origin вкладки + переход по адресу
      for (const client of windows) {
        if (!isAbsolute && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(path);
            } catch {
              /* межлокальный переход может отклониться — не критично */
            }
          }
          return;
        }
      }

      if (clients.openWindow) await clients.openWindow(path);
    })()
  );
});
