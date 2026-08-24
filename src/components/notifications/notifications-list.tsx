"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/shell/page-header";
import { NotificationItem } from "./notification-item";
import type { AppNotification, NotificationsPage } from "@/lib/api";
import { notificationsApi, SessionExpiredError } from "@/lib/api-authed";
import { useRouter } from "@/i18n/navigation";
import { useDelayed } from "@/hooks/use-delayed";

/** Полная страница уведомлений: весь список с пагинацией */
export function NotificationsList() {
  const t = useTranslations("Notifications");
  const tc = useTranslations("Common");
  const router = useRouter();

  const [page, setPage] = useState<NotificationsPage | null>(null);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDelayed(loading && items.length === 0);

  const load = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const result = await notificationsApi.list({ page: pageNum, limit: 20 });
        setPage(result);
        setItems((prev) =>
          pageNum === 1 ? result.items : [...prev, ...result.items]
        );
      } catch (e) {
        if (e instanceof SessionExpiredError) router.replace("/login");
        else toast.error(tc("loadError"));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны
    []
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await
    void load(1);
  }, [load]);

  function markRead(n: AppNotification) {
    if (n.readAt) return;
    notificationsApi
      .read(n.id)
      .then(() => {
        setItems((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x
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

  const unread = page?.unread ?? 0;
  const hasMore = page ? items.length < page.total : false;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} description={t("pageDescription")}>
        {unread > 0 && (
          <Button variant="outline" onClick={markAll} className="gap-2">
            <CheckCheck className="size-4" />
            {t("readAll")}
          </Button>
        )}
      </PageHeader>

      {items.length === 0 ? (
        showSkeleton ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg animate-in fade-in duration-300" />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
              <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
                <Bell className="size-[26px] text-primary" strokeWidth={1.75} />
              </div>
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            </div>
          )
        )
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n, i) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onSeen={markRead}
              className="rounded-lg border border-border p-4 duration-300 animate-in fade-in [animation-fill-mode:backwards]"
              style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
            />
          ))}
          {hasMore && (
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => void load((page?.page ?? 1) + 1)}
              className="mt-2 self-center gap-2"
            >
              {loading ? <Spinner className="size-4" /> : t("loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
