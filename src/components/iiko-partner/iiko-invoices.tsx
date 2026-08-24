"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
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
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { IikoInvoiceKind, IikoInvoicesList } from "@/lib/api";
import { iikoPartnerApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { invoiceStatusStyle, formatAmount } from "./invoice-format";

/** Счета с портала iiko: под-табы «Клиентам» ($) / «Партнёру» (₽) */
export function IikoInvoices() {
  const t = useTranslations("IikoPartner.invoices");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();

  const canCustomer = can(PERMISSIONS.iikoInvoicesView);
  const canPartner = can(PERMISSIONS.iikoPartnerInvoicesView);
  const canManage =
    can(PERMISSIONS.iikoInvoicesManage) ||
    can(PERMISSIONS.iikoPartnerInvoicesManage);

  const kinds: IikoInvoiceKind[] = [
    ...(canCustomer ? (["customer"] as const) : []),
    ...(canPartner ? (["partner"] as const) : []),
  ];

  const [kind, setKind] = useState<IikoInvoiceKind>(kinds[0] ?? "customer");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [sort, setSort] = useState<SortValue>("issueDate:desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IikoInvoicesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс при смене вида/фильтров
    setPage(1);
  }, [kind, debouncedSearch, status, dateFrom, dateTo, showRemoved, sort]);

  // При смене вида сбрасываем статус-фильтр (у видов разные статусы)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс статуса при смене вида
    setStatus("");
  }, [kind]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await iikoPartnerApi.invoices.list({
        page,
        kind,
        search: debouncedSearch || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        all: showRemoved || undefined,
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
  }, [page, kind, debouncedSearch, status, dateFrom, dateTo, showRemoved, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    try {
      const r = await iikoPartnerApi.invoices.sync(false);
      toast.success(
        t("syncDone", { seen: r.seen, created: r.created, updated: r.updated })
      );
      void load();
    } catch {
      toast.error(t("syncError"));
    } finally {
      setSyncing(false);
    }
  }

  const formatDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(`${iso}T00:00:00`))
      : "—";

  const summary = data?.summary;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const currency = kind === "partner" ? "RUB" : "USD";
  const statusOptions = summary ? Object.keys(summary.byStatus) : [];

  const activeFilters: ActiveFilter[] = [];
  if (status) {
    activeFilters.push({
      key: "status",
      label: `${t("filterStatus")}: ${status}`,
      onRemove: () => setStatus(""),
    });
  }
  if (dateFrom || dateTo) {
    activeFilters.push({
      key: "dates",
      label: `${dateFrom || "…"} — ${dateTo || "…"}`,
      onRemove: () => {
        setDateFrom("");
        setDateTo("");
      },
    });
  }
  if (showRemoved) {
    activeFilters.push({
      key: "removed",
      label: t("filterWithRemoved"),
      onRemove: () => setShowRemoved(false),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Под-табы вида (только доступные) */}
      {kinds.length > 1 && (
        <div className="flex w-fit gap-1 rounded-lg bg-secondary p-1">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                kind === k
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>
      )}

      {/* Сводка */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("summaryTotal")}
            </span>
            <span className="text-2xl font-bold tabular-nums">{summary.total}</span>
          </div>
          <div className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("summaryAmount", { currency })}
            </span>
            <span className="text-2xl font-bold tabular-nums">
              {formatAmount(summary.amountByCurrency[currency] ?? 0, currency, locale)}
            </span>
          </div>
        </div>
      )}

      {summary?.lastSyncError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive duration-300 animate-in fade-in">
          <CircleAlert className="size-4 shrink-0" />
          {t("lastSyncError", { error: summary.lastSyncError })}
        </div>
      )}

      {/* Панель управления */}
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
            setStatus("");
            setDateFrom("");
            setDateTo("");
            setShowRemoved(false);
          }}
        >
          {statusOptions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterStatus")}
              </Label>
              <Select
                value={status || "any"}
                items={Object.fromEntries([
                  ["any", t("anyStatus")],
                  ...statusOptions.map((s) => [s, s]),
                ])}
                onValueChange={(v) => setStatus(v === "any" ? "" : (v as string))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyStatus")}</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("from")}
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("to")}
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(e) => setShowRemoved(e.target.checked)}
              className="size-4 accent-primary"
            />
            {t("filterWithRemoved")}
          </label>
        </FiltersDialog>

        <div className="ms-auto flex items-center gap-2">
          {summary?.lastSyncAt && (
            <span className="text-xs text-muted-foreground">
              {t("lastSync", {
                time: formatDate(summary.lastSyncAt.slice(0, 10)),
              })}
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
            <FileText className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colNumber")}</TableHead>
                  <TableHead>{t("colEntity")}</TableHead>
                  <TableHead>{t("colVenue")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <SortableTableHead field="issueDate" sort={sort} onSort={setSort}>
                    {t("colIssueDate")}
                  </SortableTableHead>
                  <SortableTableHead
                    field="amountMinor"
                    sort={sort}
                    onSort={setSort}
                    align="end"
                  >
                    {t("colAmount")}
                  </SortableTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((inv) => (
                  <TableRow
                    key={inv.id}
                    onClick={() =>
                      router.push(`/iiko-partner/invoices/${inv.id}`)
                    }
                    className={cn("cursor-pointer", !inv.active && "opacity-55")}
                  >
                    <TableCell className="font-mono text-xs">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 max-w-56 flex-col">
                        <span className="truncate font-medium">
                          {inv.legalEntityName || inv.endCustomer || "—"}
                        </span>
                        {inv.legalEntityTaxId && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {inv.legalEntityTaxId}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {inv.venue ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/venues/${inv.venue!.id}`);
                          }}
                          className="flex items-center gap-1.5 text-sm transition-colors hover:text-primary"
                        >
                          <Store className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="max-w-40 truncate">{inv.venue.name}</span>
                        </button>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={invoiceStatusStyle(inv.status)}
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {formatDate(inv.issueDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatAmount(inv.amountMinor, inv.currency, locale)}
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
  );
}
