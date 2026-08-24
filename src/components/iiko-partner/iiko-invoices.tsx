"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
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
import { useCurrentUser } from "@/components/common/current-user-provider";
import type {
  IikoInvoice,
  IikoInvoiceKind,
  IikoInvoicesList,
} from "@/lib/api";
import { iikoPartnerApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Цвет бейджа статуса счёта (портал даёт произвольные строки) */
function statusStyle(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("paid")) return "bg-success-light text-success";
  if (s.includes("cancel")) return "bg-secondary text-muted-foreground";
  if (s.includes("overdue")) return "bg-destructive/10 text-destructive";
  return "bg-warning-light text-warning";
}

/** amountMinor (÷100) в формате валюты */
function formatAmount(amountMinor: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toLocaleString(locale)} ${currency}`;
  }
}

/** Счета с партнёрского портала iiko: клиентские ($) и входящие (₽) */
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
  const bothKinds = canCustomer && canPartner;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [kind, setKind] = useState<"" | IikoInvoiceKind>("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [sort, setSort] = useState<SortValue>("issueDate:desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<IikoInvoicesList | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<IikoInvoice | null>(null);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, kind, status, currency, dateFrom, dateTo, showRemoved, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await iikoPartnerApi.invoices.list({
        page,
        search: debouncedSearch || undefined,
        kind: kind || undefined,
        status: status || undefined,
        currency: currency || undefined,
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
  }, [page, debouncedSearch, kind, status, currency, dateFrom, dateTo, showRemoved, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await
    void load();
  }, [load]);

  async function sync(full: boolean) {
    setSyncing(true);
    try {
      const r = await iikoPartnerApi.invoices.sync(full);
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

  const statusOptions = summary ? Object.keys(summary.byStatus) : [];

  const activeFilters: ActiveFilter[] = [];
  if (status) {
    activeFilters.push({
      key: "status",
      label: `${t("filterStatus")}: ${status}`,
      onRemove: () => setStatus(""),
    });
  }
  if (currency) {
    activeFilters.push({
      key: "currency",
      label: currency,
      onRemove: () => setCurrency(""),
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
      {/* Сводка */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("summaryTotal")}
            </span>
            <span className="text-2xl font-bold tabular-nums">{summary.total}</span>
          </div>
          {Object.entries(summary.amountByCurrency).map(([cur, amount]) => (
            <div
              key={cur}
              className="flex flex-col gap-0.5 rounded-lg border border-border p-4 duration-300 animate-in fade-in"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("summaryAmount", { currency: cur })}
              </span>
              <span className="text-2xl font-bold tabular-nums">
                {formatAmount(amount, cur, locale)}
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

        {/* Вид: только при обоих правах */}
        {bothKinds && (
          <Select
            value={kind || "any"}
            items={{
              any: t("anyKind"),
              customer: t("kind.customer"),
              partner: t("kind.partner"),
            }}
            onValueChange={(v) =>
              setKind(v === "any" ? "" : (v as IikoInvoiceKind))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyKind")}</SelectItem>
              <SelectItem value="customer">{t("kind.customer")}</SelectItem>
              <SelectItem value="partner">{t("kind.partner")}</SelectItem>
            </SelectContent>
          </Select>
        )}

        <FiltersDialog
          active={activeFilters}
          onReset={() => {
            setStatus("");
            setCurrency("");
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

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterCurrency")}
            </Label>
            <Select
              value={currency || "any"}
              items={{ any: t("anyCurrency"), USD: "USD", RUB: "RUB" }}
              onValueChange={(v) => setCurrency(v === "any" ? "" : (v as string))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyCurrency")}</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="RUB">RUB</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              {t("lastSync", { time: formatDate(summary.lastSyncAt.slice(0, 10)) })}
            </span>
          )}
          {canManage && (
            <Button
              variant="outline"
              onClick={() => void sync(false)}
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
                    onClick={() => setSelected(inv)}
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
                        <span className="flex items-center gap-1.5 text-sm">
                          <Store className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="max-w-40 truncate">{inv.venue.name}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyle(inv.status)}>
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

      <InvoiceSheet
        invoice={selected}
        onClose={() => setSelected(null)}
        onRefreshed={(updated) => setSelected(updated)}
      />
    </div>
  );
}

/** Деталь счёта: реквизиты + карточка invoice-info (плательщик/позиции) */
function InvoiceSheet({
  invoice,
  onClose,
  onRefreshed,
}: {
  invoice: IikoInvoice | null;
  onClose: () => void;
  onRefreshed: (inv: IikoInvoice) => void;
}) {
  const t = useTranslations("IikoPartner.invoices");
  const locale = useLocale();
  const [full, setFull] = useState<IikoInvoice | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс детали при смене счёта
    setFull(null);
    if (!invoice) return;
    let cancelled = false;
    iikoPartnerApi.invoices
      .get(invoice.id)
      .then((r) => {
        if (!cancelled) setFull(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  async function refresh() {
    if (!invoice) return;
    setRefreshing(true);
    try {
      const r = await iikoPartnerApi.invoices.get(invoice.id, true);
      setFull(r);
      onRefreshed(r);
      toast.success(t("cardRefreshed"));
    } catch {
      toast.error(t("syncError"));
    } finally {
      setRefreshing(false);
    }
  }

  const inv = full ?? invoice;
  const card = (full?.card ?? null) as {
    payerName?: string;
    payerUid?: string;
    legalEntity?: string;
    endCustomer?: string;
    items?: Record<string, string>[];
    subscription?: Record<string, string>;
  } | null;

  const formatDate = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(new Date(`${iso}T00:00:00`))
      : "—";

  return (
    <Sheet open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {inv && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 font-mono">{inv.invoiceNumber}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className={statusStyle(inv.status)}>
                  {inv.status}
                </Badge>
                <Badge variant="secondary" className="bg-secondary text-muted-foreground">
                  {t(`kind.${inv.kind}`)}
                </Badge>
                {!inv.active && (
                  <Badge variant="secondary" className="text-muted-foreground">
                    {t("removed")}
                  </Badge>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-5 px-4 pb-6">
              {/* Сумма */}
              <div className="flex items-baseline justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-4">
                <span className="text-sm text-muted-foreground">{t("colAmount")}</span>
                <span className="text-xl font-bold tabular-nums">
                  {formatAmount(inv.amountMinor, inv.currency, locale)}
                </span>
              </div>

              {/* Реквизиты */}
              <dl className="flex flex-col gap-1.5 text-sm">
                {(
                  [
                    [t("colEntity"), inv.legalEntityName],
                    [t("taxId"), inv.legalEntityTaxId],
                    [t("endCustomer"), inv.endCustomer],
                    [t("partnerLabel"), inv.partner],
                    [t("colIssueDate"), formatDate(inv.issueDate)],
                    [t("dueDate"), formatDate(inv.dueDate)],
                  ] as const
                )
                  .filter(([, v]) => v && v !== "—")
                  .map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="min-w-0 break-words text-right font-medium tabular-nums">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>

              {/* Наше заведение */}
              {inv.venue && (
                <Link
                  href="/venues"
                  className="flex items-center gap-2.5 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-light">
                    <Store className="size-4 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {inv.venue.name}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {inv.venue.uid}
                    </span>
                  </div>
                  <ChevronRight className="ms-auto size-4 shrink-0 text-muted-foreground" />
                </Link>
              )}

              {inv.description && (
                <section className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("descriptionLabel")}
                  </h4>
                  <p className="text-sm leading-relaxed break-words text-muted-foreground">
                    {inv.description}
                  </p>
                </section>
              )}

              {/* Карточка invoice-info */}
              <section className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("cardLabel")}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={refreshing}
                    onClick={() => void refresh()}
                    className="gap-1.5"
                  >
                    {refreshing ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    {t("refresh")}
                  </Button>
                </div>

                {!full ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : card && (card.payerName || card.items?.length) ? (
                  <div className="flex flex-col gap-3">
                    {card.payerName && (
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className="text-muted-foreground">{t("payer")}</span>
                        <span className="text-right font-medium">
                          {card.payerName}
                          {card.payerUid && (
                            <span className="block text-xs text-muted-foreground tabular-nums">
                              {card.payerUid}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {card.items && card.items.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {card.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                          >
                            {Object.values(item).map((v, j) => (
                              <span
                                key={j}
                                className={cn(
                                  j === 0
                                    ? "min-w-0 flex-1 truncate"
                                    : "shrink-0 text-muted-foreground tabular-nums"
                                )}
                              >
                                {v}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("cardEmpty")}</p>
                )}
              </section>

              {inv.invoiceId && (
                <a
                  href={`https://pp.iiko.ru/en/invoices/edit/${inv.invoiceId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ExternalLink className="size-3" />
                  {t("openOnPortal")}
                </a>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
