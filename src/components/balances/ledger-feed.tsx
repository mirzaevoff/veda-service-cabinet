"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ChevronLeft,
  ChevronRight,
  Link2,
  Search,
  ScrollText,
  ShieldCheck,
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
import type { LedgerEntry, LedgerList } from "@/lib/api";
import { balancesApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LEDGER_TYPE_STYLES, formatLedgerAmount } from "./ledger-format";
import { LinkPaymentDialog } from "./link-payment-dialog";

/** Финансы → Транзакции: глобальный фид движений баланса */
export function LedgerFeed() {
  const t = useTranslations("Transactions");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.balancesManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [recognized, setRecognized] = useState<"" | "yes" | "no">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [sort, setSort] = useState<SortValue>("createdAt:desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LedgerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [linkEntry, setLinkEntry] = useState<LedgerEntry | null>(null);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, type, source, recognized, dateFrom, dateTo, amountMin, amountMax, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await balancesApi.ledger({
        page,
        search: debouncedSearch || undefined,
        type: type || undefined,
        source: source || undefined,
        recognized: recognized ? recognized === "yes" : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        amountMin: amountMin ? Number(amountMin) : undefined,
        amountMax: amountMax ? Number(amountMax) : undefined,
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
  }, [page, debouncedSearch, type, source, recognized, dateFrom, dateTo, amountMin, amountMax, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await
    void load();
  }, [load]);

  async function audit() {
    setAuditing(true);
    try {
      const r = await balancesApi.audit();
      toast.success(
        t("auditDone", {
          backfilled: r.backfilled,
          recognized: r.recognized,
          healed: r.entitiesHealed,
        })
      );
      void load();
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setAuditing(false);
    }
  }

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const activeFilters: ActiveFilter[] = [];
  if (type)
    activeFilters.push({ key: "type", label: t(`type.${type}`), onRemove: () => setType("") });
  if (source)
    activeFilters.push({ key: "source", label: t(`source.${source}`), onRemove: () => setSource("") });
  if (recognized)
    activeFilters.push({
      key: "recognized",
      label: recognized === "yes" ? t("recognizedYes") : t("recognizedNo"),
      onRemove: () => setRecognized(""),
    });
  if (dateFrom || dateTo)
    activeFilters.push({
      key: "dates",
      label: `${dateFrom || "…"} — ${dateTo || "…"}`,
      onRemove: () => {
        setDateFrom("");
        setDateTo("");
      },
    });
  if (amountMin || amountMax)
    activeFilters.push({
      key: "amount",
      label: `${amountMin || "…"} — ${amountMax || "…"}`,
      onRemove: () => {
        setAmountMin("");
        setAmountMax("");
      },
    });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("title")} description={t("description")}>
        {canManage && (
          <Button variant="outline" onClick={audit} disabled={auditing} className="gap-2">
            {auditing ? <Spinner className="size-4" /> : <ShieldCheck className="size-4" />}
            {t("runAudit")}
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-4">
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
              setType("");
              setSource("");
              setRecognized("");
              setDateFrom("");
              setDateTo("");
              setAmountMin("");
              setAmountMax("");
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("filterType")}</Label>
              <Select
                value={type || "any"}
                items={{
                  any: t("anyType"),
                  topup: t("type.topup"),
                  correction: t("type.correction"),
                  audit: t("type.audit"),
                }}
                onValueChange={(v) => setType(v === "any" ? "" : (v as string))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyType")}</SelectItem>
                  <SelectItem value="topup">{t("type.topup")}</SelectItem>
                  <SelectItem value="correction">{t("type.correction")}</SelectItem>
                  <SelectItem value="audit">{t("type.audit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("filterSource")}</Label>
              <Select
                value={source || "any"}
                items={{
                  any: t("anySource"),
                  bank: t("source.bank"),
                  manual: t("source.manual"),
                  audit: t("source.audit"),
                }}
                onValueChange={(v) => setSource(v === "any" ? "" : (v as string))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anySource")}</SelectItem>
                  <SelectItem value="bank">{t("source.bank")}</SelectItem>
                  <SelectItem value="manual">{t("source.manual")}</SelectItem>
                  <SelectItem value="audit">{t("source.audit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">{t("filterRecognized")}</Label>
              <Select
                value={recognized || "any"}
                items={{ any: t("anyRecognized"), yes: t("recognizedYes"), no: t("recognizedNo") }}
                onValueChange={(v) => setRecognized(v === "any" ? "" : (v as "yes" | "no"))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyRecognized")}</SelectItem>
                  <SelectItem value="yes">{t("recognizedYes")}</SelectItem>
                  <SelectItem value="no">{t("recognizedNo")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">{t("from")}</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">{t("to")}</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">{t("amountMin")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amountMin}
                  placeholder={t("amountPlaceholder")}
                  onChange={(e) => setAmountMin(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-muted-foreground">{t("amountMax")}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={amountMax}
                  placeholder={t("amountPlaceholder")}
                  onChange={(e) => setAmountMax(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          </FiltersDialog>
        </div>

        <ActiveFilterChips active={activeFilters} />

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
              <ScrollText className="size-[26px] text-primary" strokeWidth={1.75} />
            </div>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead field="createdAt" sort={sort} onSort={setSort}>
                      {t("colDate")}
                    </SortableTableHead>
                    <TableHead>{t("colEntity")}</TableHead>
                    <TableHead>{t("colType")}</TableHead>
                    <TableHead>{t("colPayer")}</TableHead>
                    <SortableTableHead field="amountTiyin" sort={sort} onSort={setSort} align="end">
                      {t("colAmount")}
                    </SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((e) => (
                    <TableRow
                      key={e.id}
                      className={cn(!e.recognized && "bg-warning-light/30")}
                    >
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {formatDate(e.createdAt)}
                      </TableCell>
                      <TableCell>
                        {e.legalEntityId ? (
                          <Link
                            href={`/legal-entities/${e.legalEntityId}`}
                            className="max-w-56 truncate font-medium transition-colors hover:text-primary"
                          >
                            {e.legalEntityName || e.legalEntityId}
                          </Link>
                        ) : (
                          <span className="text-sm text-warning">{t("unrecognized")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={LEDGER_TYPE_STYLES[e.type]}>
                          {t(`type.${e.type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48">
                        {e.payer ? (
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm">{e.payer.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {e.payer.inn}
                            </span>
                          </div>
                        ) : e.comment ? (
                          <span className="line-clamp-2 text-sm text-muted-foreground">
                            {e.comment}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              e.amountTiyin < 0 ? "text-destructive" : "text-success"
                            )}
                          >
                            {formatLedgerAmount(e, locale)}
                          </span>
                          {canManage && !e.recognized && (
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() => setLinkEntry(e)}
                              className="gap-1"
                            >
                              <Link2 className="size-3" />
                              {t("link")}
                            </Button>
                          )}
                        </div>
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

      <LinkPaymentDialog
        entry={linkEntry}
        onClose={() => setLinkEntry(null)}
        onLinked={() => {
          setLinkEntry(null);
          void load();
        }}
      />
    </div>
  );
}
