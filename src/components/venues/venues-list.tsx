"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Link2,
  Network,
  RefreshCw,
  Search,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ActiveFilterChips,
  FiltersDialog,
  type ActiveFilter,
} from "@/components/common/filters-dialog";
import { SortableTableHead } from "@/components/common/sortable-table-head";
import type { SortValue } from "@/components/common/sortable-table-head";
import { PageHeader } from "@/components/shell/page-header";
import { useCurrentUser } from "@/components/common/current-user-provider";
import { type VenueStatus, type VenuesList } from "@/lib/api";
import { venuesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { VERSION_STATUS_STYLES } from "@/lib/iiko-version";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const VENUE_STATUS_STYLES: Record<VenueStatus, string> = {
  open: "bg-success-light text-success",
  closed: "bg-secondary text-muted-foreground",
  temporarily_closed: "bg-warning-light text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

/** Заведения клиентов: зеркало Customers портала iiko + привязка к нашим ЮЛ */
export function VenuesList() {
  const t = useTranslations("Venues");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.venuesManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [kind, setKind] = useState<"" | "rms" | "chain">("");
  const [linked, setLinked] = useState<"" | "yes" | "no">("");
  const [showInactive, setShowInactive] = useState(false);
  const [chainFilter, setChainFilter] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("chainId");
    const name = searchParams.get("chainName");
    return id ? { id, name: name ?? "" } : null;
  });
  const [sort, setSort] = useState<SortValue>("name:asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VenuesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, kind, linked, showInactive, chainFilter, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await venuesApi.list({
        page,
        search: debouncedSearch || undefined,
        kind: kind || undefined,
        chainId: chainFilter?.id,
        linked: linked ? linked === "yes" : undefined,
        active: showInactive ? undefined : true,
        sort,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- router/tc нестабильны
  }, [page, debouncedSearch, kind, linked, showInactive, chainFilter, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const result = await venuesApi.sync();
      if (result.partial) toast.warning(t("syncPartial"));
      toast.success(
        t("syncDone", {
          seen: result.seen,
          created: result.created,
          chains: result.chains,
          deactivated: result.deactivated,
        })
      );
      void load();
    } catch {
      toast.error(t("syncError"));
    } finally {
      setSyncing(false);
    }
  }

  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const summary = data?.summary;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const activeFilters: ActiveFilter[] = [];
  if (kind) {
    activeFilters.push({
      key: "kind",
      label: kind === "chain" ? t("kind.chain") : t("kind.rms"),
      onRemove: () => setKind(""),
    });
  }
  if (linked) {
    activeFilters.push({
      key: "linked",
      label: linked === "yes" ? t("filterLinkedYes") : t("filterLinkedNo"),
      onRemove: () => setLinked(""),
    });
  }
  if (showInactive) {
    activeFilters.push({
      key: "inactive",
      label: t("filterWithInactive"),
      onRemove: () => setShowInactive(false),
    });
  }
  if (chainFilter) {
    activeFilters.push({
      key: "chain",
      label: `${t("filterChain")}: ${chainFilter.name}`,
      onRemove: () => setChainFilter(null),
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} description={t("description")}>
        {canManage && (
          <Button
            variant="outline"
            onClick={sync}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("sync")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
        {/* Сводка */}
        {summary && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["rms", summary.rms],
                ["chains", summary.chains],
                ["linked", summary.linked],
              ] as const
            ).map(([key, value]) => (
              <div
                key={key}
                className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(`summary.${key}`)}
                </span>
                <span className="text-2xl font-bold tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        )}

        {summary?.lastListSyncError && (
          <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive duration-300 animate-in fade-in">
            <CircleAlert className="size-4 shrink-0" />
            {t("lastSyncError", { error: summary.lastListSyncError })}
          </div>
        )}

        {/* Панель списка */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-72 pl-9"
            />
          </div>

          <FiltersDialog
            active={activeFilters}
            onReset={() => {
              setKind("");
              setLinked("");
              setShowInactive(false);
              setChainFilter(null);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterKind")}
              </Label>
              <Select
                value={kind || "any"}
                items={{
                  any: t("anyKind"),
                  rms: t("kind.rms"),
                  chain: t("kind.chain"),
                }}
                onValueChange={(v) =>
                  setKind(v === "any" ? "" : (v as "rms" | "chain"))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyKind")}</SelectItem>
                  <SelectItem value="rms">{t("kind.rms")}</SelectItem>
                  <SelectItem value="chain">{t("kind.chain")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterLinked")}
              </Label>
              <Select
                value={linked || "any"}
                items={{
                  any: t("anyLinked"),
                  yes: t("filterLinkedYes"),
                  no: t("filterLinkedNo"),
                }}
                onValueChange={(v) =>
                  setLinked(v === "any" ? "" : (v as "yes" | "no"))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyLinked")}</SelectItem>
                  <SelectItem value="yes">{t("filterLinkedYes")}</SelectItem>
                  <SelectItem value="no">{t("filterLinkedNo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterActivity")}
              </Label>
              <Select
                value={showInactive ? "all" : "active"}
                items={{
                  active: t("filterOnlyActive"),
                  all: t("filterWithInactive"),
                }}
                onValueChange={(v) => setShowInactive(v === "all")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("filterOnlyActive")}</SelectItem>
                  <SelectItem value="all">{t("filterWithInactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FiltersDialog>

          {summary?.lastListSyncAt && (
            <span className="ms-auto text-xs text-muted-foreground">
              {t("lastSync", { time: formatTime(summary.lastListSyncAt) })}
            </span>
          )}
        </div>

        <ActiveFilterChips active={activeFilters} />

        {/* Таблица */}
        {!data ? (
          showSkeleton && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 rounded-lg animate-in fade-in duration-300" />
              <Skeleton className="h-64 rounded-lg animate-in fade-in duration-300" />
            </div>
          )
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
            <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
              <Store className="size-[26px] text-primary" strokeWidth={1.75} />
            </div>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="name" sort={sort} onSort={setSort}>
                      {t("colName")}
                    </SortableTableHead>
                    <SortableTableHead field="kind" sort={sort} onSort={setSort}>
                      {t("colKind")}
                    </SortableTableHead>
                    <SortableTableHead field="type" sort={sort} onSort={setSort}>
                      {t("colType")}
                    </SortableTableHead>
                    <SortableTableHead field="city" sort={sort} onSort={setSort}>
                      {t("colCity")}
                    </SortableTableHead>
                    <TableHead>{t("colEntity")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colVersion")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((venue) => (
                    <TableRow
                      key={venue.id}
                      onClick={() => router.push(`/venues/${venue.id}`)}
                      className={cn(
                        "cursor-pointer",
                        !venue.active && "opacity-55",
                        venue.server?.status === "down" && "bg-destructive/5"
                      )}
                    >
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{venue.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {venue.kind === "rms" && venue.chainName
                              ? venue.chainName
                              : venue.uid}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "gap-1",
                            venue.kind === "chain" &&
                              "bg-accent-light text-primary"
                          )}
                        >
                          {venue.kind === "chain" ? (
                            <Network className="size-3" />
                          ) : (
                            <Store className="size-3" />
                          )}
                          {t(`kind.${venue.kind}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {venue.type || "—"}
                      </TableCell>
                      <TableCell className="text-sm">{venue.city || "—"}</TableCell>
                      <TableCell>
                        {venue.legalEntity ? (
                          <span className="flex items-center gap-1.5 text-sm">
                            <Link2 className="size-3.5 shrink-0 text-success" />
                            <span className="max-w-44 truncate">
                              {venue.legalEntity.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {venue.kind === "rms" ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "shrink-0",
                              VENUE_STATUS_STYLES[venue.status]
                            )}
                          >
                            {t(`status.${venue.status}`)}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Показываем версию мониторинга (её и оценивает статус),
                          // иначе версию из карточки iiko нейтрально
                          const shown = venue.server?.version || venue.version;
                          const vs = venue.server?.versionStatus;
                          const attention = vs === "outdated" || vs === "critical";
                          if (!shown)
                            return <span className="text-sm text-muted-foreground">—</span>;
                          return (
                            <span
                              title={
                                attention && venue.server
                                  ? t("versionTip", { version: venue.server.latestVersion })
                                  : undefined
                              }
                              className={cn(
                                "rounded px-1.5 py-0.5 font-mono text-xs tabular-nums",
                                attention && vs
                                  ? VERSION_STATUS_STYLES[vs]
                                  : "bg-secondary text-muted-foreground"
                              )}
                            >
                              {shown}
                            </span>
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground tabular-nums">
                  {data.page} / {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label={tc("prevPage")}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={data.page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label={tc("nextPage")}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
