"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { UserActivitySession } from "@/lib/api";
import { adminApi } from "@/lib/api-authed";
import { formatMinutes } from "@/lib/format";

const PAGE = 8;

/** Грубый разбор User-Agent в «Браузер · ОС» */
function deviceLabel(ua: string): string {
  if (!ua) return "";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod|iOS/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return [browser, os].filter(Boolean).join(" · ");
}

/** Диапазон периода: «3 сент, 14:20 – 15:10» или с датами, если разные дни */
function formatRange(startIso: string, endIso: string, locale: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  const dayFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year:
      start.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) {
    return `${dayFmt.format(start)}, ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  }
  return `${dayFmt.format(start)} ${timeFmt.format(start)} – ${dayFmt.format(end)} ${timeFmt.format(end)}`;
}

/** Периоды активности пользователя (GET /users/:id/sessions) */
export function UserSessions({ userId }: { userId: string }) {
  const t = useTranslations("AdminUsers.sessions");
  const locale = useLocale();
  const [items, setItems] = useState<UserActivitySession[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadPage = useCallback(
    async (p: number) => {
      const res = await adminApi.users.sessions(userId, { page: p, limit: PAGE });
      setTotal(res.total);
      setItems((prev) => (p === 1 ? res.items : [...(prev ?? []), ...res.items]));
    },
    [userId]
  );

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- сброс при смене пользователя */
    setItems(null);
    setPage(1);
    setFailed(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    adminApi.users
      .sessions(userId, { page: 1, limit: PAGE })
      .then((res) => {
        if (cancelled) return;
        setTotal(res.total);
        setItems(res.items);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function more() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      await loadPage(next);
      setPage(next);
    } catch {
      // тихо — журнал не критичен
    } finally {
      setLoadingMore(false);
    }
  }

  if (failed) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-muted-foreground">
        {t("title")}
      </span>
      {!items ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((s) => {
            const device = deviceLabel(s.userAgent);
            return (
              <div
                key={s.id}
                className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {formatRange(s.startedAt, s.lastActivityAt, locale)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatMinutes(s.durationMinutes)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {device && (
                    <span className="flex items-center gap-1">
                      <MonitorSmartphone className="size-3.5" />
                      <span title={s.userAgent}>{device}</span>
                    </span>
                  )}
                  {s.ip && (
                    <span className="flex items-center gap-1 tabular-nums">
                      <Globe className="size-3.5" />
                      {s.ip}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {items.length < total && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              disabled={loadingMore}
              onClick={more}
            >
              {loadingMore ? <Spinner className="size-4" /> : t("more")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
