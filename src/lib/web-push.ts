"use client";

import type { Messaging } from "firebase/messaging";
import { notificationsApi } from "@/lib/api-authed";
import {
  firebaseConfig,
  firebaseConfigQuery,
  firebaseVapidKey,
  hasFirebaseConfig,
} from "@/lib/firebase-config";

const TOKEN_STORAGE_KEY = "vv:fcm-token";
const SW_URL = `/firebase-messaging-sw.js?${firebaseConfigQuery()}`;

let messagingPromise: Promise<Messaging | null> | null = null;

/** Поддерживает ли сам браузер web-push (без учёта конфига Firebase) */
export async function isBrowserPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window))
    return false;
  try {
    const { isSupported } = await import("firebase/messaging");
    return await isSupported();
  } catch {
    return false;
  }
}

/** Настроен ли Firebase на этой сборке (проброшены NEXT_PUBLIC_FIREBASE_*) */
export function isPushConfigured(): boolean {
  return hasFirebaseConfig();
}

/** Поддерживается ли web-push в этом окружении (браузер + SW + FCM + конфиг) */
export async function isPushSupported(): Promise<boolean> {
  if (!hasFirebaseConfig()) return false;
  return isBrowserPushSupported();
}

/** Текущее состояние разрешения на уведомления */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window))
    return "unsupported";
  return Notification.permission;
}

/** Включены ли пуши на этом устройстве (разрешение выдано и токен зарегистрирован) */
export function isPushEnabled(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  return (
    Notification.permission === "granted" &&
    !!localStorage.getItem(TOKEN_STORAGE_KEY)
  );
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!(await isPushSupported())) return null;
      const { initializeApp, getApps, getApp } = await import("firebase/app");
      const { getMessaging } = await import("firebase/messaging");
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }
  return messagingPromise;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SW_URL);
}

/**
 * Запросить разрешение (если нужно), получить FCM-токен и зарегистрировать устройство.
 * Возвращает true, если пуши подключены. `silent` — не запрашивать разрешение,
 * работать только если оно уже выдано (для тихого обновления токена при загрузке).
 */
export async function enablePush(silent = false): Promise<boolean> {
  if (!(await isPushSupported())) return false;

  if (Notification.permission !== "granted") {
    if (silent) return false;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) return false;

  try {
    const { getToken } = await import("firebase/messaging");
    const registration = await registerServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    await notificationsApi.registerDevice(token, "web");
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return true;
  } catch {
    return false;
  }
}

/** Отключить пуши: снять регистрацию токена на бэкенде и удалить его в FCM */
export async function disablePush(): Promise<void> {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (stored) {
    await notificationsApi.unregisterDevice(stored).catch(() => {});
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  try {
    const messaging = await getMessagingInstance();
    if (messaging) {
      const { deleteToken } = await import("firebase/messaging");
      await deleteToken(messaging).catch(() => {});
    }
  } catch {
    // игнорируем — токен на бэкенде уже снят
  }
}

/**
 * Пуши, пришедшие когда вкладка активна, система не показывает — рисуем свой тост.
 * Возвращает функцию отписки.
 */
export async function listenForegroundPush(
  onMessage: (title: string, body: string, data?: Record<string, string>) => void
): Promise<() => void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  const { onMessage: onFcmMessage } = await import("firebase/messaging");
  return onFcmMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "";
    const body = payload.notification?.body ?? "";
    if (title || body) onMessage(title, body, payload.data);
  });
}
