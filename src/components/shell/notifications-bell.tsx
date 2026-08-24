"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellRing, CheckCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { enablePush, isPushSupported, pushPermission } from "@/lib/web-push";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { NotificationItem } from "@/components/notifications/notification-item";
import type { AppNotification, NotificationsPage } from "@/lib/api";
import { notificationsApi } from "@/lib/api-authed";
import { Link } from "@/i18n/navigation";

export function NotificationsBell() {
  const t = useTranslations("Notifications");
  const [page, setPage] = useState<NotificationsPage | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Показываем промо «включить пуши», только если поддерживается и разрешение ещё не запрошено
  useEffect(() => {
    let cancelled = false;
    void isPushSupported().then((ok) => {
      if (!cancelled) setCanPrompt(ok && pushPermission() === "default");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOnPush() {
    setEnabling(true);
    try {
      const ok = await enablePush(false);
      if (ok) {
        toast.success(t("pushEnabled"));
        setCanPrompt(false);
      } else if (pushPermission() === "denied") {
        toast.error(t("pushBlocked"));
        setCanPrompt(false);
      } else {
        toast.error(t("pushFailed"));
      }
    } finally {
      setEnabling(false);
    }
  }

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

        {canPrompt && (
          <button
            type="button"
            onClick={turnOnPush}
            disabled={enabling}
            className="flex w-full items-center gap-3 border-b border-border bg-accent-light/40 px-4 py-3 text-left transition-colors hover:bg-accent-light/70"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
              {enabling ? (
                <Spinner className="size-4 text-primary" />
              ) : (
                <BellRing className="size-4 text-primary" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{t("enablePush")}</span>
              <span className="text-xs text-muted-foreground">
                {t("enablePushHint")}
              </span>
            </div>
            <span className="shrink-0 text-xs font-medium text-primary">
              {t("enable")}
            </span>
          </button>
        )}

        <div className="max-h-96 overflow-y-auto overscroll-contain">
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
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onSeen={markRead}
                  className="border-b border-border px-4 py-3 last:border-b-0"
                />
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 border-t border-border px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-accent-light/50"
          >
            {t("all")}
            <ChevronRight className="size-4" />
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
