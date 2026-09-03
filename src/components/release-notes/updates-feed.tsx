"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCheck, ChevronLeft, ChevronRight, Pin, Plus, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { ReleaseArea, ReleaseNotesPage, ReleaseStatus } from "@/lib/api";
import { releaseNotesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { notifyUpdatesUnreadChanged } from "@/hooks/use-unread-updates";
import { formatRelativeTime } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import { AreaBadge } from "./area-badge";

const ALL = "__all__";

export function UpdatesFeed() {
  const t = useTranslations("Updates");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.releaseNotesManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [area, setArea] = useState<string>(ALL);
  const [status, setStatus] = useState<ReleaseStatus>("published");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReleaseNotesPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, area, status]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await releaseNotesApi.list({
        page,
        search: debouncedSearch || undefined,
        area: area === ALL ? undefined : (area as ReleaseArea),
        status: canManage ? status : undefined,
      });
      if (result.items.length === 0 && result.page > 1) {
        setPage(1);
        return;
      }
      setData(result);
    } catch (e) {
      if (e instanceof SessionExpiredError) router.replace("/login");
      else toast.error(tc("loadError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, area, status, canManage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function readAll() {
    setMarkingAll(true);
    try {
      await releaseNotesApi.readAll();
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((n) => ({ ...n, read: true })) } : prev
      );
      notifyUpdatesUnreadChanged();
    } catch {
      toast.error(tc("loadError"));
    } finally {
      setMarkingAll(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const hasUnread = !!data?.items.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 duration-450 animate-in fade-in slide-in-from-bottom-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-64 pl-9"
          />
        </div>
        <Select
          value={area}
          items={{
            [ALL]: t("allAreas"),
            frontend: t("area.frontend"),
            api: t("area.api"),
            both: t("area.both"),
          }}
          onValueChange={(v) => setArea(v ?? ALL)}
        >
          <SelectTrigger className="h-9 w-auto min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-auto min-w-44">
            <SelectItem value={ALL}>{t("allAreas")}</SelectItem>
            <SelectItem value="frontend">{t("area.frontend")}</SelectItem>
            <SelectItem value="api">{t("area.api")}</SelectItem>
            <SelectItem value="both">{t("area.both")}</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Select
            value={status}
            items={{ published: t("statusPublished"), draft: t("statusDraft") }}
            onValueChange={(v) => setStatus((v ?? "published") as ReleaseStatus)}
          >
            <SelectTrigger className="h-9 w-auto min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="published">{t("statusPublished")}</SelectItem>
              <SelectItem value="draft">{t("statusDraft")}</SelectItem>
            </SelectContent>
          </Select>
        )}
        <div className="ms-auto flex items-center gap-2">
          {hasUnread && (
            <Button variant="ghost" size="sm" className="gap-1.5" disabled={markingAll} onClick={readAll}>
              <CheckCheck className="size-4" />
              {t("readAll")}
            </Button>
          )}
          {canManage && (
            <Button onClick={() => router.push("/updates/new")} className="gap-2">
              <Plus className="size-4" />
              {t("create")}
            </Button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Sparkles className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">
            {debouncedSearch || area !== ALL ? t("emptySearch") : t("empty")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => router.push(`/updates/${n.id}`)}
              className="flex flex-col gap-1.5 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 duration-450 animate-in fade-in"
            >
              <div className="flex flex-wrap items-center gap-2">
                {!n.read && n.status === "published" && (
                  <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={t("new")} />
                )}
                {n.pinned && <Pin className="size-3.5 shrink-0 text-primary" />}
                <span className="font-medium">{n.title}</span>
                {n.important && (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    {t("important")}
                  </Badge>
                )}
                {n.status === "draft" && (
                  <Badge variant="secondary" className="bg-secondary text-muted-foreground">
                    {t("statusDraft")}
                  </Badge>
                )}
              </div>
              {n.summary && (
                <span className="text-sm text-muted-foreground">{n.summary}</span>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <AreaBadge area={n.area} frontVersion={n.frontVersion} apiVersion={n.apiVersion} />
                <span>·</span>
                <span>
                  {n.publishedAt
                    ? formatRelativeTime(n.publishedAt, locale)
                    : formatRelativeTime(n.createdAt, locale)}
                </span>
                {n.tags.map((x) => (
                  <span key={x} className="rounded bg-secondary px-1.5 py-0.5">#{x}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            aria-label={tc("prevPage")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            aria-label={tc("nextPage")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
