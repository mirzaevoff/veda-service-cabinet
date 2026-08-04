"use client";

import { useEffect, useRef, useState } from "react";
import type { Ticket, TicketMessage } from "@/lib/api";
import {
  joinTicket,
  leaveTicket,
  onConnectionChange,
  subscribe,
  type TypingEvent,
} from "@/lib/ticket-socket";

interface TicketRoomHandlers {
  onMessage?: (message: TicketMessage) => void;
  onUpdated?: (ticket: Ticket) => void;
  onTyping?: (event: TypingEvent) => void;
  /** Срабатывает на каждый (ре)коннект — момент дозагрузить пропущенное */
  onConnect?: () => void;
}

/** Живые обработчики без пере-подписки на каждый рендер */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function useSocketConnected() {
  const [connected, setConnected] = useState(true);
  useEffect(() => onConnectionChange(setConnected), []);
  return connected;
}

export function useTicketRoom(
  ticketId: string | null,
  handlers: TicketRoomHandlers
) {
  const latest = useLatest(handlers);

  useEffect(() => {
    if (!ticketId) return;

    joinTicket(ticketId);

    const offs = [
      subscribe("ticket:message", (m) => {
        if (m.ticketId === ticketId) latest.current.onMessage?.(m);
      }),
      subscribe("ticket:updated", (t) => {
        if (t.id === ticketId) latest.current.onUpdated?.(t);
      }),
      subscribe("ticket:typing", (e) => {
        if (e.ticketId === ticketId) latest.current.onTyping?.(e);
      }),
      onConnectionChange((connected) => {
        if (connected) latest.current.onConnect?.();
      }),
    ];

    return () => {
      leaveTicket(ticketId);
      offs.forEach((off) => off());
    };
  }, [ticketId, latest]);
}

export function useTicketListEvents(handlers: {
  onCreated?: (ticket: Ticket) => void;
  onUpdated?: (ticket: Ticket) => void;
  onMessage?: (message: TicketMessage) => void;
}) {
  const latest = useLatest(handlers);

  useEffect(() => {
    const offs = [
      subscribe("ticket:created", (t) => latest.current.onCreated?.(t)),
      subscribe("ticket:updated", (t) => latest.current.onUpdated?.(t)),
      subscribe("ticket:message", (m) => latest.current.onMessage?.(m)),
    ];
    return () => offs.forEach((off) => off());
  }, [latest]);
}
