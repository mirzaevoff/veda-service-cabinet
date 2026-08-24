/**
 * Firebase web-конфиг для push-уведомлений (FCM).
 * Значения — из NEXT_PUBLIC_* env (Firebase Console → Project Settings → Web app;
 * VAPID — Cloud Messaging → Web configuration → Generate key pair).
 * Веб-приложение должно быть в ТОМ ЖЕ Firebase-проекте, что и service-account бэкенда.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const firebaseVapidKey =
  process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

/** Настроен ли Firebase (иначе push-слой тихо выключен, in-app лента работает как есть) */
export function hasFirebaseConfig(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      firebaseVapidKey
  );
}

/** Конфиг как query-строка — передаётся в service worker (он не видит process.env) */
export function firebaseConfigQuery(): string {
  return new URLSearchParams(firebaseConfig).toString();
}
