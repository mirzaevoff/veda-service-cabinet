"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import type { AppNotification, NotificationsPage } from "@/lib/api";
import { notificationsApi } from "@/lib/api-authed";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** [текст](url) + переносы строк — без сырого HTML */
function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = linkRe.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <a
        key={key++}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:text-accent-bright"
      >
        {match[1]}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function imageSrc(url: string) {
  return url.startsWith("/files/") ? `/api${url}` : url;
}

export function NotificationsBell() {
  const t = useTranslations("Notifications");
  const locale = useLocale();
  const [page, setPage] = useState<NotificationsPage | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const result = await notificationsApi.list({ page: pageNum, limit: 10 });
      setPage(result);
      setItems((prev) =>
        pageNum === 1 ? result.items : [...prev, ...result.items]
      );
    } catch {
      // тихо: колокольчик не должен ломать шапку
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState после await внутри load
    void load();
    const id = setInterval(() => {
      if (!open) void load();
    }, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const unread = page?.unread ?? 0;

  function markRead(notification: AppNotification) {
    if (notification.readAt) return;
    notificationsApi
      .read(notification.id)
      .then(() => {
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, readAt: new Date().toISOString() }
              : n
          )
        );
        setPage((prev) =>
          prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev
        );
      })
      .catch(() => {});
  }

  function markAll() {
    notificationsApi
      .readAll()
      .then(() => {
        const now = new Date().toISOString();
        setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
        setPage((prev) => (prev ? { ...prev, unread: 0 } : prev));
      })
      .catch(() => {});
  }

  const hasMore = page ? items.length < page.total : false;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load();
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("title")}
            className="relative"
          >
            <Bell className="size-4.5" />
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground tabular-nums duration-300 animate-in zoom-in-50">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-96 max-w-[92vw] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-semibold">{t("title")}</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={markAll}
              className="gap-1 text-muted-foreground"
            >
              <CheckCheck className="size-3.5" />
              {t("readAll")}
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              {loading ? (
                <Spinner className="size-5 text-muted-foreground" />
              ) : (
                <>
                  <div className="flex size-12 items-center justify-center rounded-lg bg-accent-light">
                    <Bell className="size-5 text-primary" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm text-muted-foreground">{t("empty")}</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {items.map((n) => (
                <div
                  key={n.id}
                  onMouseEnter={() => markRead(n)}
                  className={cn(
                    "flex flex-col gap-2 border-b border-border px-4 py-3 transition-colors last:border-b-0",
                    !n.readAt && "bg-accent-light/40"
                  )}
                >
                  {n.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageSrc(n.imageUrl)}
                      alt=""
                      loading="lazy"
                      className="max-h-40 w-full rounded-md object-cover"
                    />
                  )}
                  {n.text && (
                    <p className="whitespace-pre-wrap text-sm leading-5">
                      {renderMarkdown(n.text)}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(n.createdAt, locale)}
                    </span>
                    {n.button && (
                      <a
                        href={n.button.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="xs">
                          {n.button.text}
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() => void load((page?.page ?? 1) + 1)}
                  className="m-2 text-muted-foreground"
                >
                  {loading ? <Spinner className="size-4" /> : t("loadMore")}
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
