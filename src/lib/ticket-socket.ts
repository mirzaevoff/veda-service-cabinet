import { io, type Socket } from "socket.io-client";
import type { Ticket, TicketMessage } from "./api";
import { getAccessToken, refreshSession } from "./auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.vedavector.com";

export interface TypingEvent {
  ticketId: string;
  userId: string;
  name: string;
}

interface ServerEvents {
  "ticket:message": (message: TicketMessage) => void;
  "ticket:updated": (ticket: Ticket) => void;
  "ticket:created": (ticket: Ticket) => void;
  "ticket:typing": (event: TypingEvent) => void;
}

type EventName = keyof ServerEvents;

let socket: Socket | null = null;
const joinedRooms = new Set<string>();
let refreshingAuth = false;
const lastTypingSent = new Map<string, number>();

const TYPING_THROTTLE_MS = 2500;

function createSocket(): Socket {
  const s = io(API_URL, {
    auth: { token: getAccessToken() },
  });

  s.on("connect", () => {
    // После реконнекта комнаты нужно занимать заново
    for (const ticketId of joinedRooms) {
      s.emit("ticket:join", { ticketId });
    }
  });

  s.on("connect_error", (err) => {
    // Протухший access: один общий refresh и повтор подключения
    if (err.message === "ER208" && !refreshingAuth) {
      refreshingAuth = true;
      refreshSession()
        .then((tokens) => {
          s.auth = { token: tokens.accessToken };
          s.connect();
        })
        .catch(() => {
          // Сессия мертва — страницы получат SessionExpiredError по REST
        })
        .finally(() => {
          refreshingAuth = false;
        });
    }
  });

  return s;
}

export function getTicketSocket(): Socket {
  if (!socket) socket = createSocket();
  // Каждое обращение освежает токен для следующего handshake
  socket.auth = { token: getAccessToken() };
  if (socket.disconnected) socket.connect();
  return socket;
}

export function subscribe<E extends EventName>(
  event: E,
  handler: ServerEvents[E]
): () => void {
  const s = getTicketSocket();
  s.on(event, handler as never);
  return () => s.off(event, handler as never);
}

export function onConnectionChange(
  handler: (connected: boolean) => void
): () => void {
  const s = getTicketSocket();
  const up = () => handler(true);
  const down = () => handler(false);
  s.on("connect", up);
  s.on("disconnect", down);
  handler(s.connected);
  return () => {
    s.off("connect", up);
    s.off("disconnect", down);
  };
}

export function joinTicket(ticketId: string) {
  joinedRooms.add(ticketId);
  const s = getTicketSocket();
  if (s.connected) s.emit("ticket:join", { ticketId });
}

export function leaveTicket(ticketId: string) {
  joinedRooms.delete(ticketId);
  if (socket?.connected) socket.emit("ticket:leave", { ticketId });
}

export function sendTyping(ticketId: string) {
  const now = Date.now();
  if (now - (lastTypingSent.get(ticketId) ?? 0) < TYPING_THROTTLE_MS) return;
  lastTypingSent.set(ticketId, now);
  if (socket?.connected) socket.emit("ticket:typing", { ticketId });
}
