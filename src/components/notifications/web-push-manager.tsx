"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { enablePush, listenForegroundPush } from "@/lib/web-push";

/**
 * Держит web-push в актуальном состоянии, пока пользователь залогинен:
 * — при входе тихо обновляет FCM-токен (если разрешение уже выдано);
 * — показывает тост для пушей, пришедших при активной вкладке (система их не рисует).
 * Ничего не делает, если Firebase не сконфигурирован или пуши не поддерживаются.
 */
export function WebPushManager() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;

  // Тихое обновление/регистрация токена при входе (без запроса разрешения)
  useEffect(() => {
    if (!userId) return;
    void enablePush(true);
  }, [userId]);

  // Тост для пушей на активной вкладке
  useEffect(() => {
    if (!userId) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    void listenForegroundPush((title, body) => {
      toast(title || body, body && title ? { description: body } : undefined);
    }).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
