"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Landmark,
  RefreshCw,
  Repeat,
  Search,
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
import { DatePicker } from "@/components/common/date-picker";
import {
  ActiveFilterChips,
  FiltersDialog,
  type ActiveFilter,
} from "@/components/common/filters-dialog";
import { SortSelect } from "@/components/common/sort-select";
import type { SortValue } from "@/components/common/sortable-table-head";
import { useCurrentUser } from "@/components/common/current-user-provider";
import type { BankAccount, BankTransaction, Page } from "@/lib/api";
import { bankApi, SessionExpiredError } from "@/lib/api-authed";
import { PERMISSIONS } from "@/lib/permissions";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { useDelayed } from "@/hooks/use-delayed";
import { formatDay } from "@/lib/format";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatTiyin } from "./bank-money";

/** Транзакции: список с фильтрами + деталь в шторке */
export function BankTransactions({ accounts }: { accounts: BankAccount[] }) {
  const t = useTranslations("Bank.transactions");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const { can } = useCurrentUser();
  const canManage = can(PERMISSIONS.bankManage);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [account, setAccount] = useState("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortValue>("docDate:desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<BankTransaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BankTransaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const showSkeleton = useDelayed(loading && !data);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- сброс страницы при смене фильтров
    setPage(1);
  }, [debouncedSearch, account, direction, dateFrom, dateTo, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bankApi.transactions.list({
        page,
        search: debouncedSearch || undefined,
        account: account || undefined,
        direction: direction || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
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
  }, [page, debouncedSearch, account, direction, dateFrom, dateTo, sort]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setLoading до await осознанный
    void load();
  }, [load]);

  async function refreshDetails() {
    if (!selected) return;
    setRefreshing(true);
    try {
      const updated = await bankApi.transactions.refreshDetails(selected.id);
      setSelected(updated);
      toast.success(t("detailsRefreshed"));
    } catch {
      toast.error(t("genericError"));
    } finally {
      setRefreshing(false);
    }
  }

  const accountTitle = (id: string) =>
    accounts.find((a) => a.id === id)?.title ?? "—";

  const activeFilters: ActiveFilter[] = [];
  if (account) {
    activeFilters.push({
      key: "account",
      label: `${t("filterAccount")}: ${accountTitle(account)}`,
      onRemove: () => setAccount(""),
    });
  }
  if (direction) {
    activeFilters.push({
      key: "direction",
      label: direction === "in" ? t("directionIn") : t("directionOut"),
      onRemove: () => setDirection(""),
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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
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

        <SortSelect
          value={sort}
          options={[
            { value: "docDate:desc", label: t("sortNewest") },
            { value: "docDate:asc", label: t("sortOldest") },
            { value: "amount:desc", label: t("sortAmountDesc") },
            { value: "amount:asc", label: t("sortAmountAsc") },
          ]}
          onChange={setSort}
        />

        <FiltersDialog
          active={activeFilters}
          onReset={() => {
            setAccount("");
            setDirection("");
            setDateFrom("");
            setDateTo("");
          }}
        >
          {accounts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-muted-foreground">
                {t("filterAccount")}
              </Label>
              <Select
                value={account || "any"}
                items={Object.fromEntries([
                  ["any", t("anyAccount")],
                  ...accounts.map((a) => [a.id, a.title]),
                ])}
                onValueChange={(v) => setAccount(v === "any" ? "" : (v as string))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyAccount")}</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterDirection")}
            </Label>
            <Select
              value={direction || "any"}
              items={{
                any: t("anyDirection"),
                in: t("directionIn"),
                out: t("directionOut"),
              }}
              onValueChange={(v) =>
                setDirection(v === "any" ? "" : (v as "in" | "out"))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyDirection")}</SelectItem>
                <SelectItem value="in">{t("directionIn")}</SelectItem>
                <SelectItem value="out">{t("directionOut")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("filterPeriod")}
            </Label>
            <div className="flex items-center gap-2">
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder={t("from")} />
              <span className="text-muted-foreground">—</span>
              <DatePicker value={dateTo} onChange={setDateTo} placeholder={t("to")} />
            </div>
          </div>
        </FiltersDialog>

        {data && (
          <span className="ms-auto text-sm text-muted-foreground tabular-nums">
            {t("total", { count: data.total })}
          </span>
        )}
      </div>

      <ActiveFilterChips active={activeFilters} />

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {showSkeleton &&
            Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg animate-in fade-in duration-300" />
            ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center duration-450 animate-in fade-in">
          <div className="flex size-14 items-center justify-center rounded-lg bg-accent-light">
            <Landmark className="size-[26px] text-primary" strokeWidth={1.75} />
          </div>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((tx, i) => {
            const isIn = tx.direction === "in";
            const counterpartyName = isIn ? tx.name_dt : tx.name_ct;
            return (
              <button
                key={tx.id}
                type="button"
                onClick={() => setSelected(tx)}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-primary/40 duration-300 animate-in fade-in [animation-fill-mode:backwards]"
                style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    isIn ? "bg-success-light" : "bg-accent-light"
                  )}
                >
                  {isIn ? (
                    <ArrowDownLeft className="size-4.5 text-success" strokeWidth={1.75} />
                  ) : (
                    <ArrowUpRight className="size-4.5 text-primary" strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{counterpartyName || "—"}</span>
                    {tx.counterpartyTracked && (
                      <Badge variant="secondary" className="gap-1 bg-secondary text-muted-foreground">
                        <Repeat className="size-3" />
                        {t("internal")}
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {tx.purpose || "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDay(tx.docDate, locale)} · {accountTitle(tx.bankAccountId)}
                    {tx.num && ` · №${tx.num}`}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    isIn ? "text-success" : ""
                  )}
                >
                  {isIn ? "+" : "−"}
                  {formatTiyin(tx.amount)}
                </span>
              </button>
            );
          })}

          {totalPages > 1 && (
            <div className="mt-2 flex items-center justify-center gap-3">
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
      )}

      {/* Деталь транзакции */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6">
                  {selected.direction === "in" ? "+" : "−"}
                  {formatTiyin(selected.amount)} {t("soum")}
                </SheetTitle>
                <SheetDescription>
                  {formatDay(selected.docDate, locale)} ·{" "}
                  {accountTitle(selected.bankAccountId)}
                  {selected.num && ` · №${selected.num}`}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-6">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {(
                    [
                      [t("payer"), `${selected.name_dt || "—"}`],
                      [t("payerDetails"), [selected.inn_dt && `ИНН ${selected.inn_dt}`, selected.acc_dt, selected.mfo_dt && `МФО ${selected.mfo_dt}`].filter(Boolean).join(" · ")],
                      [t("receiver"), `${selected.name_ct || "—"}`],
                      [t("receiverDetails"), [selected.inn_ct && `ИНН ${selected.inn_ct}`, selected.acc_ct, selected.mfo_ct && `МФО ${selected.mfo_ct}`].filter(Boolean).join(" · ")],
                      [t("purpose"), selected.purpose],
                      [t("purpCode"), selected.purp_code],
                      [t("docType"), selected.dtype],
                      [t("bankId"), selected.b2_id],
                    ] as const
                  )
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label} className="col-span-2 grid grid-cols-subgrid">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 break-words">{value}</dd>
                      </div>
                    ))}
                </dl>

                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={refreshing}
                    onClick={refreshDetails}
                    className="gap-2 self-start"
                  >
                    {refreshing ? (
                      <Spinner className="size-4" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    {t("refreshDetails")}
                  </Button>
                )}

                {selected.detailsRaw && (
                  <pre className="max-h-60 overflow-auto rounded-lg bg-secondary p-3 text-xs">
                    {JSON.stringify(selected.detailsRaw, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
