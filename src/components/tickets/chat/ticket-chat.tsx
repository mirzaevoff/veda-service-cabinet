"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { ChatHeader } from "./chat-header";
import { MessageBubble, type ChatMessage } from "./message-bubble";
import { MessageComposer } from "./message-composer";
import { TicketRating } from "./ticket-rating";
import { useTicketRoom } from "@/hooks/use-ticket-socket";
import { notifyUnreadChanged } from "@/hooks/use-unread-tickets";
import { ApiError, type Ticket, type TicketMessage } from "@/lib/api";
import { SessionExpiredError, ticketsApi } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDay } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import type { TypingEvent } from "@/lib/ticket-socket";

const NEAR_BOTTOM_PX = 80;
const TYPING_FADE_MS = 3000;

let tempCounter = 0;

export function TicketChat({ ticketId }: { ticketId: string }) {
  const t = useTranslations("Tickets.chat");
  const te = useTranslations("Tickets.errors");
  const locale = useLocale();
  const router = useRouter();
  const { user, can } = useCurrentUser();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [newBelow, setNewBelow] = useState(false);
  const [typers, setTypers] = useState<Map<string, { name: string; until: number }>>(
    new Map()
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prependingRef = useRef<{ height: number; top: number } | null>(null);
  const stickToBottomRef = useRef(true);

  const mergeMessages = useCallback(
    (incoming: TicketMessage[], mode: "append" | "prepend" | "replace") => {
      setMessages((prev) => {
        const base = mode === "replace" ? [] : prev;
        const seen = new Set(base.map((m) => m.id));
        const fresh = incoming.filter((m) => !seen.has(m.id));
        const merged =
          mode === "prepend" ? [...fresh, ...base] : [...base, ...fresh];
        return merged.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
    },
    []
  );

  // Начальная загрузка тикета и последних сообщений
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tk, msgs] = await Promise.all([
          ticketsApi.get(ticketId),
          ticketsApi.messages(ticketId, { page: 1 }),
        ]);
        if (cancelled) return;
        setTicket(tk);
        setTotal(msgs.total);
        mergeMessages([...msgs.items].reverse(), "replace");
        setInitialLoaded(true);
        ticketsApi.markRead(ticketId).then(notifyUnreadChanged).catch(() => {});
      } catch (e) {
        if (cancelled) return;
        if (e instanceof SessionExpiredError) router.replace("/login");
        else setNotFound(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId, mergeMessages, router]);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
    setNewBelow(false);
  }, []);

  // Скролл-позиционирование: вниз при старте/новых своих, коррекция при prepend
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prependingRef.current) {
      el.scrollTop =
        el.scrollHeight - prependingRef.current.height + prependingRef.current.top;
      prependingRef.current = null;
    } else if (stickToBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Реалтайм
  useTicketRoom(ticketId, {
    onMessage: (message) => {
      stickToBottomRef.current = isNearBottom();
      if (!stickToBottomRef.current && message.author.id !== user?.id) {
        setNewBelow(true);
      }
      // Сокет-событие заменяет optimistic-дубль? Нет: дедуп по id, temp-сообщения
      // имеют свои id и заменяются в submit; здесь просто добавляем недостающее
      mergeMessages([message], "append");
      if (message.author.id !== user?.id) {
        ticketsApi.markRead(ticketId).then(notifyUnreadChanged).catch(() => {});
      }
      setTypers((prev) => {
        if (!prev.has(message.author.id)) return prev;
        const next = new Map(prev);
        next.delete(message.author.id);
        return next;
      });
    },
    onUpdated: (updated) => setTicket(updated),
    onTyping: (event: TypingEvent) => {
      if (event.userId === user?.id) return;
      setTypers((prev) => {
        const next = new Map(prev);
        next.set(event.userId, {
          name: event.name,
          until: Date.now() + TYPING_FADE_MS,
        });
        return next;
      });
    },
    onConnect: () => {
      // После разрыва дотягиваем пропущенное
      ticketsApi
        .messages(ticketId, { page: 1 })
        .then((msgs) => {
          setTotal(msgs.total);
          stickToBottomRef.current = isNearBottom();
          mergeMessages([...msgs.items].reverse(), "append");
        })
        .catch(() => {});
    },
  });

  // Затухание typing-индикатора
  useEffect(() => {
    if (!typers.size) return;
    const id = setInterval(() => {
      setTypers((prev) => {
        const now = Date.now();
        const next = new Map(
          [...prev].filter(([, value]) => value.until > now)
        );
        return next.size === prev.size ? prev : next;
      });
    }, 500);
    return () => clearInterval(id);
  }, [typers.size]);

  // Пагинация вверх
  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length >= total) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    if (el) prependingRef.current = { height: el.scrollHeight, top: el.scrollTop };
    try {
      const nextPage = page + 1;
      const msgs = await ticketsApi.messages(ticketId, { page: nextPage });
      setPage(nextPage);
      setTotal(msgs.total);
      stickToBottomRef.current = false;
      mergeMessages([...msgs.items].reverse(), "prepend");
    } catch {
      prependingRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, messages.length, total, page, ticketId, mergeMessages]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !initialLoaded) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadOlder();
      },
      { root, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadOlder, initialLoaded]);

  // Отправка (optimistic)
  const send = useCallback(
    async (body: { text?: string; attachmentIds?: string[] }) => {
      if (!user) return false;
      const tempId = `tmp-${++tempCounter}`;
      const temp: ChatMessage = {
        id: tempId,
        ticketId,
        author: { id: user.id, name: user.name, phone: user.phone },
        text: body.text ?? "",
        type: "user",
        systemEvent: null,
        fromSupport: !!ticket && user.id !== ticket.author.id,
        attachments: [],
        createdAt: new Date().toISOString(),
        pending: true,
      };
      stickToBottomRef.current = true;
      setMessages((prev) => [...prev, temp]);
      try {
        const real = await ticketsApi.sendMessage(ticketId, body);
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempId);
          if (withoutTemp.some((m) => m.id === real.id)) return withoutTemp;
          return [...withoutTemp, real];
        });
        setTotal((prev) => prev + 1);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.code === "ER401") {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setTicket((prev) => (prev ? { ...prev, status: "closed" } : prev));
          toast.error(te("ER401"));
        } else if (e instanceof ApiError && e.code === "ER408") {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          toast.error(te("ER408"));
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...m, pending: false, failed: true } : m
            )
          );
        }
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ticket нужен только для fromSupport в temp-сообщении
    [ticketId, user, te]
  );

  const retryFailed = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      void send({ text: message.text || undefined });
    },
    [send]
  );

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-medium">{te("ER400")}</p>
        <Button variant="outline" size="sm" onClick={() => router.replace("/tickets")}>
          {t("back")}
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-14 rounded-lg" />
        <div className="flex flex-1 flex-col justify-end gap-2">
          <Skeleton className="h-16 w-2/3 rounded-lg" />
          <Skeleton className="h-16 w-1/2 self-end rounded-lg" />
          <Skeleton className="h-16 w-3/5 rounded-lg" />
        </div>
      </div>
    );
  }

  const isAuthor = user?.id === ticket.author.id;
  const isParticipant = !!ticket.participants?.some(
    (p) => p.user.id === user?.id
  );
  // Суппорт пишет только во взятые тикеты (ER408); автор — всегда в открытые
  const canWrite =
    ticket.status === "open" &&
    (isAuthor || (can(PERMISSIONS.ticketsAnswer) && isParticipant));
  const needsClaim =
    ticket.status === "open" &&
    !isAuthor &&
    can(PERMISSIONS.ticketsAnswer) &&
    !isParticipant;
  const activeTypers = [...typers.values()].map((v) => v.name);

  // Группировка: дата-разделители и имя автора у первого сообщения группы
  const rows: React.ReactNode[] = [];
  let prevDay = "";
  let prevAuthor = "";
  for (const message of messages) {
    const day = message.createdAt.slice(0, 10);
    if (day !== prevDay) {
      rows.push(
        <div key={`day-${day}`} className="my-2 flex items-center justify-center">
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {formatDay(message.createdAt, locale)}
          </span>
        </div>
      );
      prevDay = day;
      prevAuthor = "";
    }
    if (message.type === "system") {
      const name = message.author.name;
      const label =
        message.systemEvent === "ticket_reopened"
          ? t("systemReopened", { name })
          : message.systemEvent === "ticket_claimed"
            ? t("systemClaimed", { name })
            : message.systemEvent === "ticket_left"
              ? t("systemLeft", { name })
              : message.systemEvent === "ticket_severity_changed"
                ? t("systemSeverityChanged", { name })
                : t("systemClosed", { name });
      rows.push(
        <div
          key={message.id}
          className="my-1 flex items-center justify-center duration-300 animate-in fade-in"
        >
          <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {label}
          </span>
        </div>
      );
      prevAuthor = "";
      continue;
    }
    const own = message.author.id === user?.id;
    // Сервер сам анонимизирует поддержку для клиента (author.name = «Поддержка»)
    const authorLabel = message.author.name;
    rows.push(
      <MessageBubble
        key={message.id}
        message={message}
        own={own}
        showAuthor={message.author.id !== prevAuthor}
        authorLabel={authorLabel}
        onRetry={retryFailed}
      />
    );
    prevAuthor = message.author.id;
  }

  return (
    <div className="flex h-full flex-col duration-450 animate-in fade-in">
      <ChatHeader ticket={ticket} onUpdated={setTicket} />

      <div
        ref={scrollRef}
        onScroll={() => {
          stickToBottomRef.current = isNearBottom();
          if (stickToBottomRef.current) setNewBelow(false);
        }}
        className="relative flex-1 overflow-y-auto px-3 py-4 sm:px-5"
      >
        <div ref={topSentinelRef} />
        {loadingOlder && (
          <div className="flex justify-center py-2">
            <Spinner className="size-4 text-muted-foreground" />
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-2">{rows}</div>
      </div>

      <div className="relative">
        {newBelow && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-lg duration-300 animate-in fade-in slide-in-from-bottom-2"
          >
            <ArrowDown className="size-3.5" />
            {t("newMessages")}
          </button>
        )}
        {activeTypers.length > 0 && (
          <div className="absolute -top-6 left-5 text-xs text-muted-foreground duration-200 animate-in fade-in">
            {t("typing", { name: activeTypers.join(", ") })}
          </div>
        )}

        {canWrite ? (
          <MessageComposer ticketId={ticketId} onSend={send} />
        ) : needsClaim ? (
          <div className="flex items-center justify-center gap-3 border-t border-border bg-secondary/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {t("claimToWrite")}
            </span>
            <Button
              size="sm"
              onClick={() =>
                ticketsApi
                  .claim(ticketId)
                  .then(setTicket)
                  .catch(() => toast.error(te("generic")))
              }
            >
              {t("takeToWork")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 border-t border-border bg-secondary/50 px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" />
              {ticket.status === "closed" ? t("closedNotice") : t("readOnly")}
            </div>
            {ticket.status === "closed" && (
              <TicketRating
                ticket={ticket}
                isAuthor={isAuthor}
                onUpdated={setTicket}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
