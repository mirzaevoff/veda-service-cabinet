"use client";

import { useEffect, useState } from "react";
import { releaseNotesApi } from "@/lib/api-authed";

export const UPDATES_UNREAD_CHANGED = "updates-unread-changed";

/** Сообщить UI, что число непрочитанных «Обновлений» изменилось */
export function notifyUpdatesUnreadChanged() {
  window.dispatchEvent(new Event(UPDATES_UNREAD_CHANGED));
}

/** Непрочитанные новости ленты «Обновления» — бейдж в навигации */
export function useUnreadUpdates() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      releaseNotesApi
        .unreadCount()
        .then(({ unread }) => !cancelled && setCount(unread))
        .catch(() => {});
    };
    refetch();
    window.addEventListener(UPDATES_UNREAD_CHANGED, refetch);
    // на всякий случай подтягиваем при возврате на вкладку
    const onVis = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener(UPDATES_UNREAD_CHANGED, refetch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return count;
}
