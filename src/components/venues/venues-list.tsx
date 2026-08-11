"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  ExternalLink,
  Link2,
  Link2Off,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  ApiError,
  type IikoServerStatus,
  type LegalEntity,
  type Venue,
  type VenueStatus,
  type VenuesList,
} from "@/lib/api";
import {
  legalEntitiesApi,
  venuesApi,
  SessionExpiredError,
} from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SERVER_STATUS_STYLES: Record<IikoServerStatus, string> = {
  up: "bg-success-light text-success",
  down: "bg-destructive/10 text-destructive",
  maintenance: "bg-warning-light text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

const VENUE_STATUS_STYLES: Record<VenueStatus, string> = {
  open: "bg-success-light text-success",
  closed: "bg-secondary text-muted-foreground",
  temporarily_closed: "bg-warning-light text-warning",
};

/** Заведения клиентов: зеркало Customers портала iiko + привязка к нашим ЮЛ */
export function VenuesList() {
  const t = useTranslations("Venues");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.venuesManage);
  const canPickEntity = can(PERMISSIONS.legalEntitiesList);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [kind, setKind] = useState<"" | "rms" | "chain">("");
  const [linked, setLinked] = useState<"" | "yes" | "no">("");
  const [showInactive, setShowInactive] = useState(false);
  const [chainFilter, setChainFilter] = useState<{ id: string; name: string } | null>(null);
  const [sort, setSort] = useState<SortValue>("name:asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VenuesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Venue | null>(null);
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
                    <SortableTableHead
                      field="lastSeenAt"
                      sort={sort}
                      onSort={setSort}
                    >
                      {t("colLastSeen")}
                    </SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((venue) => (
                    <TableRow
                      key={venue.id}
                      onClick={() => setSelected(venue)}
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
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {formatTime(venue.lastSeenAt)}
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

      <VenueSheet
        venue={selected}
        canManage={canManage}
        canPickEntity={canPickEntity}
        formatTime={formatTime}
        onClose={() => setSelected(null)}
        onChanged={(updated) => {
          setSelected(updated);
          void load();
        }}
        onShowChainPoints={(chain) => {
          setSelected(null);
          setKind("rms");
          setChainFilter(chain);
        }}
      />
    </div>
  );
}

/** Деталь заведения: карточка iiko + привязка нашего ЮЛ */
function VenueSheet({
  venue,
  canManage,
  canPickEntity,
  formatTime,
  onClose,
  onChanged,
  onShowChainPoints,
}: {
  venue: Venue | null;
  canManage: boolean;
  canPickEntity: boolean;
  formatTime: (iso: string) => string;
  onClose: () => void;
  onChanged: (venue: Venue) => void;
  onShowChainPoints: (chain: { id: string; name: string }) => void;
}) {
  const t = useTranslations("Venues");
  const ts = useTranslations("IikoPartner.servers");
  const tc = useTranslations("Common");
  const [cardSyncing, setCardSyncing] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusUntil, setStatusUntil] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [entityQuery, setEntityQuery] = useState("");
  const debouncedEntityQuery = useDebouncedValue(entityQuery, 350);
  const [entityOptions, setEntityOptions] = useState<LegalEntity[] | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс пикера при смене заведения
    setPicking(false);
    setEntityQuery("");
    setEntityOptions(null);
  }, [venue?.id]);

  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    legalEntitiesApi
      .list({ search: debouncedEntityQuery || undefined, limit: 8 })
      .then((page) => {
        if (!cancelled) setEntityOptions(page.items);
      })
      .catch(() => {
        if (!cancelled) setEntityOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [picking, debouncedEntityQuery]);

  async function syncCard() {
    if (!venue) return;
    setCardSyncing(true);
    try {
      const updated = await venuesApi.syncCard(venue.id);
      onChanged(updated);
      toast.success(t("cardSynced"));
    } catch {
      toast.error(t("syncError"));
    } finally {
      setCardSyncing(false);
    }
  }

  async function link(legalEntityId: string | null) {
    if (!venue) return;
    setLinking(true);
    try {
      const updated = await venuesApi.linkLegalEntity(venue.id, legalEntityId);
      onChanged(updated);
      setPicking(false);
      toast.success(legalEntityId ? t("linked") : t("unlinked"));
    } catch (e) {
      if (e instanceof ApiError && e.code === "ER700") {
        toast.error(t("errors.ER700"));
      } else {
        toast.error(t("errors.generic"));
      }
    } finally {
      setLinking(false);
    }
  }

  async function setStatus(status: "temporarily_closed" | null) {
    if (!venue) return;
    setStatusBusy(true);
    try {
      const updated = await venuesApi.setStatus(
        venue.id,
        status,
        status && statusUntil ? new Date(statusUntil).toISOString() : null
      );
      onChanged(updated);
      setStatusDialogOpen(false);
      setStatusUntil("");
      toast.success(status ? t("markedClosed") : t("statusCleared"));
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setStatusBusy(false);
    }
  }

  const externalLinks = venue
    ? ([
        [t("hostingLink"), venue.hostingLink],
        [t("webLink"), venue.webLink],
      ] as const)
    : [];

  return (
    <Sheet open={!!venue} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {venue && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6">{venue.name}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1",
                    venue.kind === "chain" && "bg-accent-light text-primary"
                  )}
                >
                  {venue.kind === "chain" ? (
                    <Network className="size-3" />
                  ) : (
                    <Store className="size-3" />
                  )}
                  {t(`kind.${venue.kind}`)}
                </Badge>
                {venue.kind === "rms" && (
                  <Badge
                    variant="secondary"
                    className={VENUE_STATUS_STYLES[venue.status]}
                  >
                    {t(`status.${venue.status}`)}
                  </Badge>
                )}
                {venue.server && (
                  <Badge
                    variant="secondary"
                    className={SERVER_STATUS_STYLES[venue.server.status]}
                  >
                    {t("serverBadge", { status: ts(`status.${venue.server.status}`) })}
                  </Badge>
                )}
                {!venue.active && (
                  <Badge variant="secondary" className="text-muted-foreground">
                    {t("inactive")}
                  </Badge>
                )}
                {venue.chain && (
                  <span className="text-xs">
                    {t("inChain", { name: venue.chain.name })}
                  </span>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-6">
              {/* Временно не работает: ручной override */}
              {canManage && venue.kind === "rms" && (
                <section className="flex flex-col gap-2 rounded-lg border border-border p-4">
                  {venue.manualStatus ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm text-warning">
                        <Clock className="size-3.5 shrink-0" />
                        {venue.manualStatusUntil
                          ? t("tempClosedUntil", {
                              time: formatTime(venue.manualStatusUntil),
                            })
                          : t("tempClosedManual")}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={statusBusy}
                        onClick={() => void setStatus(null)}
                      >
                        {t("clearStatus")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">
                        {t("statusAutoHint")}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatusDialogOpen(true)}
                        className="gap-1.5"
                      >
                        <Clock className="size-3.5" />
                        {t("markClosed")}
                      </Button>
                    </div>
                  )}
                </section>
              )}

              {/* Наше ЮЛ */}
              <section className="flex flex-col gap-2.5 rounded-lg border border-border p-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                    <Building2 className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("ourEntity")}
                  </h4>
                </div>

                {venue.legalEntity ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      <Link2 className="size-3.5 shrink-0 text-success" />
                      <span className="truncate">{venue.legalEntity.name}</span>
                    </span>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={linking}
                        onClick={() => void link(null)}
                        className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Link2Off className="size-3.5" />
                        {t("unlink")}
                      </Button>
                    )}
                  </div>
                ) : picking ? (
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        autoFocus
                        value={entityQuery}
                        onChange={(e) => setEntityQuery(e.target.value)}
                        placeholder={t("entitySearchPlaceholder")}
                        className="pl-9"
                      />
                    </div>
                    {!entityOptions ? (
                      <Skeleton className="h-16 rounded-lg" />
                    ) : entityOptions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t("entityNotFound")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {entityOptions.map((entity) => (
                          <button
                            key={entity.id}
                            type="button"
                            disabled={linking}
                            onClick={() => void link(entity.id)}
                            className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                          >
                            <span className="min-w-0 truncate font-medium">
                              {entity.name}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {entity.taxId}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPicking(false)}
                      className="self-start"
                    >
                      {tc("cancel")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      {t("noEntity")}
                    </span>
                    {canManage && canPickEntity && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPicking(true)}
                        className="gap-1.5"
                      >
                        <Link2 className="size-3.5" />
                        {t("link")}
                      </Button>
                    )}
                  </div>
                )}
              </section>

              {/* Карточка iiko */}
              <section className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("iikoCard")}
                  </h4>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cardSyncing}
                      onClick={() => void syncCard()}
                      className="gap-1.5"
                    >
                      {cardSyncing ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      {t("syncCard")}
                    </Button>
                  )}
                </div>
                <dl className="flex flex-col gap-1 text-sm">
                  {(
                    [
                      [t("colUid"), venue.uid],
                      [t("clientId"), venue.iikoClientId],
                      [t("colType"), venue.type],
                      [t("colCity"), venue.city],
                      [t("address"), venue.address],
                      [t("phone"), venue.phone],
                      [t("email"), venue.email],
                      [t("emailForInvoices"), venue.emailForInvoices],
                      [t("manager"), venue.manager],
                      [t("iikoEntity"), venue.iikoLegalEntityName],
                      [t("iikoTaxId"), venue.iikoTaxId],
                      [t("version"), venue.version],
                    ] as const
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-baseline justify-between gap-4"
                      >
                        <dt className="shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-words text-right font-medium">
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>
                {externalLinks.some(([, url]) => url) && (
                  <div className="flex flex-wrap gap-2">
                    {externalLinks
                      .filter(([, url]) => url)
                      .map(([label, url]) => (
                        <a
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                        >
                          <ExternalLink className="size-3" />
                          {label}
                        </a>
                      ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {venue.cardSyncedAt
                    ? t("cardSyncedAt", { time: formatTime(venue.cardSyncedAt) })
                    : t("cardNotSynced")}
                </p>
              </section>

              {venue.kind === "chain" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onShowChainPoints({ id: venue.id, name: venue.name })
                  }
                  className="gap-2 self-start"
                >
                  <Store className="size-4" />
                  {t("showChainPoints")}
                </Button>
              )}
            </div>

            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{t("markClosed")}</DialogTitle>
                  <DialogDescription>{t("markClosedHint")}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="venue-status-until"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    {t("untilLabel")}
                  </Label>
                  <Input
                    id="venue-status-until"
                    type="datetime-local"
                    value={statusUntil}
                    onChange={(e) => setStatusUntil(e.target.value)}
                    className="w-fit"
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("untilHint")}
                  </span>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setStatusDialogOpen(false)}>
                    {tc("cancel")}
                  </Button>
                  <Button
                    onClick={() => void setStatus("temporarily_closed")}
                    disabled={statusBusy}
                  >
                    {statusBusy ? <Spinner className="size-4" /> : t("markClosedNow")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
