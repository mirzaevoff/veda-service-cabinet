"use client";

import { useEffect, useRef, useState } from "react";
import { ticketsApi } from "@/lib/api-authed";
import { subscribe } from "@/lib/ticket-socket";

export const UNREAD_CHANGED_EVENT = "tickets-unread-changed";

/** Сообщить остальным частям UI, что счётчик непрочитанных изменился */
export function notifyUnreadChanged() {
  window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT));
}

/** Суммарные непрочитанные по тикетам: бейдж в навигации */
export function useUnreadTickets() {
  const [total, setTotal] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refetch = () => {
      ticketsApi
        .unreadCount()
        .then(({ total }) => setTotal(total))
        .catch(() => {});
    };
    const debounced = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(refetch, 400);
    };

    refetch();
    const offs = [
      subscribe("ticket:message", debounced),
      subscribe("ticket:updated", debounced),
    ];
    window.addEventListener(UNREAD_CHANGED_EVENT, debounced);
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener(UNREAD_CHANGED_EVENT, debounced);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return total;
}
