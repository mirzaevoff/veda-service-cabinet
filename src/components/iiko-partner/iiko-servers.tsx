"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  Search,
  ServerOff,
} from "lucide-react";
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
import { SortableTableHead } from "@/components/common/sortable-table-head";
import type { SortValue } from "@/components/common/sortable-table-head";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type {
  IikoServer,
  IikoServerEvent,
  IikoServerStatus,
  IikoServersList,
} from "@/lib/api";
import { iikoPartnerApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<IikoServerStatus, string> = {
  up: "bg-success-light text-success",
  down: "bg-destructive/10 text-destructive",
  maintenance: "bg-warning-light text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

/** Мониторинг серверов клиентов: зеркало портала + история переходов */
export function IikoServers() {
  const t = useTranslations("IikoPartner.servers");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.iikoServersManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [status, setStatus] = useState<"" | IikoServerStatus>("");
  const [sort, setSort] = useState<SortValue>("pointName:asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IikoServersList | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<IikoServer | null>(null);
  const [events, setEvents] = useState<IikoServerEvent[] | null>(null);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, status, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await iikoPartnerApi.servers.list({
        page,
        search: debouncedSearch || undefined,
        status: status || undefined,
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
  }, [page, debouncedSearch, status, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const result = await iikoPartnerApi.servers.sync();
      if (result.partial) {
        toast.warning(t("syncPartial"));
      }
      toast.success(
        t("syncDone", {
          seen: result.seen,
          created: result.created,
          transitions: result.transitions,
        })
      );
      void load();
    } catch {
      toast.error(t("syncError"));
    } finally {
      setSyncing(false);
    }
  }

  async function openServer(server: IikoServer) {
    setSelected(server);
    setEvents(null);
    setEventsPage(1);
    try {
      const page = await iikoPartnerApi.servers.events(server.id, 1);
      setEvents(page.items);
      setEventsTotal(page.total);
    } catch {
      setEvents([]);
      setEventsTotal(0);
    }
  }

  async function loadMoreEvents() {
    if (!selected) return;
    const next = eventsPage + 1;
    try {
      const page = await iikoPartnerApi.servers.events(selected.id, next);
      setEvents((prev) => [...(prev ?? []), ...page.items]);
      setEventsPage(next);
    } catch {
      toast.error(tc("loadError"));
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

  return (
    <div className="flex flex-col gap-4">
      {/* Сводка */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["total", summary.total, ""],
              ["up", summary.up, "text-success"],
              ["down", summary.down, summary.down > 0 ? "text-destructive" : ""],
              [
                "maintenance",
                summary.maintenance,
                summary.maintenance > 0 ? "text-warning" : "",
              ],
            ] as const
          ).map(([key, value, color]) => (
            <div
              key={key}
              className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t(`summary.${key}`)}
              </span>
              <span className={cn("text-2xl font-bold tabular-nums", color)}>
                {value}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary?.lastSyncError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive duration-300 animate-in fade-in">
          <CircleAlert className="size-4 shrink-0" />
          {t("lastSyncError", { error: summary.lastSyncError })}
        </div>
      )}

      {/* Панель управления списком */}
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

        <Select
          value={status || "any"}
          items={{
            any: t("anyStatus"),
            up: t("status.up"),
            down: t("status.down"),
            maintenance: t("status.maintenance"),
            unknown: t("status.unknown"),
          }}
          onValueChange={(v) =>
            setStatus(v === "any" ? "" : (v as IikoServerStatus))
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("anyStatus")}</SelectItem>
            <SelectItem value="up">{t("status.up")}</SelectItem>
            <SelectItem value="down">{t("status.down")}</SelectItem>
            <SelectItem value="maintenance">{t("status.maintenance")}</SelectItem>
            <SelectItem value="unknown">{t("status.unknown")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="ms-auto flex items-center gap-2">
          {summary?.lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              {t("lastSync", { time: formatTime(summary.lastSyncAt) })}
            </span>
          )}
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
        </div>
      </div>

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
            <ServerOff className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead field="pointName" sort={sort} onSort={setSort}>
                    {t("colPoint")}
                  </SortableTableHead>
                  <TableHead>{t("colUid")}</TableHead>
                  <SortableTableHead field="version" sort={sort} onSort={setSort}>
                    {t("colVersion")}
                  </SortableTableHead>
                  <SortableTableHead field="status" sort={sort} onSort={setSort}>
                    {t("colStatus")}
                  </SortableTableHead>
                  <SortableTableHead
                    field="statusChangedAt"
                    sort={sort}
                    onSort={setSort}
                  >
                    {t("colStatusChanged")}
                  </SortableTableHead>
                  <SortableTableHead field="lastSeenAt" sort={sort} onSort={setSort}>
                    {t("colLastSeen")}
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((server) => (
                  <TableRow
                    key={server.id}
                    onClick={() => void openServer(server)}
                    className={cn(
                      "cursor-pointer",
                      server.status === "down" && "bg-destructive/5"
                    )}
                  >
                    <TableCell className="font-medium">
                      {server.pointName}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {server.uid}
                    </TableCell>
                    <TableCell className="tabular-nums">{server.version}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("shrink-0", STATUS_STYLES[server.status])}
                      >
                        {t(`status.${server.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatTime(server.statusChangedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatTime(server.lastSeenAt)}
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

      {/* Деталь сервера + история переходов */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6">{selected.pointName}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="secondary"
                    className={STATUS_STYLES[selected.status]}
                  >
                    {t(`status.${selected.status}`)}
                  </Badge>
                  {selected.status === "down" && selected.downSince && (
                    <span className="text-xs">
                      {t("downSince", { time: formatTime(selected.downSince) })}
                    </span>
                  )}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 pb-6">
                <dl className="flex flex-col gap-1 text-sm">
                  {(
                    [
                      [t("colUid"), selected.uid],
                      [t("clientId"), selected.clientId],
                      [t("colVersion"), selected.version],
                      [t("colStatusChanged"), formatTime(selected.statusChangedAt)],
                      [t("firstSeen"), formatTime(selected.firstSeenAt)],
                      [t("colLastSeen"), formatTime(selected.lastSeenAt)],
                    ] as const
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-baseline justify-between gap-4"
                      >
                        <dt className="shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-all text-right font-medium tabular-nums">
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>

                <section className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("history")}
                  </h4>
                  {!events ? (
                    <Skeleton className="h-20 rounded-lg" />
                  ) : events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("historyEmpty")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                        >
                          {event.from === null ? (
                            <span className="text-muted-foreground">
                              {t("firstAppeared")}
                            </span>
                          ) : (
                            <>
                              <Badge
                                variant="secondary"
                                className={STATUS_STYLES[event.from]}
                              >
                                {t(`status.${event.from}`)}
                              </Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLES[event.to]}
                          >
                            {t(`status.${event.to}`)}
                          </Badge>
                          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                            {formatTime(event.at)}
                          </span>
                        </div>
                      ))}
                      {events.length < eventsTotal && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void loadMoreEvents()}
                          className="self-start"
                        >
                          {t("loadMore")}
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
